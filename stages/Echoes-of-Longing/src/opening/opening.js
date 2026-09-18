import { gsap } from 'gsap';
import { MalkuthHalo } from './malkuthHalo.js';
import { DustField } from './dust.js';

/**
 * 开场演出（Kara 分镜 2026-07-06；07-06 修订：
 * 抽屉式拉出 / 短线段 / 标题紧贴封面 / 页面 UI 主体英文）
 *
 *  1 「憧れの残響」于页面中部略下方由下往上淡入，停留 1s
 *  2 正中射出一小段竖线，双边内容像抽屉一样自线段后拉出（被中线裁切）：
 *    左 —— 封面；标题同时移至封面正上方（两者组成居中块，上下对称）
 *    右 —— Staff（英文）与「上一级」按钮
 *    双边同始同终；标题随后以 日/英/中/韩 轮播淡入淡出
 *  3 线段消失 → 光环中心点浮现 → 双边继续靠边让位
 *  4 让位完成后，光环轮廓自顶部顺时针、带加速度地发光显现
 *  5 光环下方浮现 Tap Halo to Continue，光环即入口
 *  6 点击：内容区自右下向左上化作粉末消散（光环除外），
 *    光环按入场逆序退场（轮廓逆时针收回 → 中点熄灭）
 *  7 onDone —— 进入播放器（过渡演出待定）
 *
 * 移动端适配：布局按启动时视口解算为像素；竖屏进入时等待转横屏再开演，
 * 开演后发生旋转/明显视口变化则整场重排重演（点击后不再重演）。
 */

/* ---- 可调参数（逐项打磨用） ---- */
const T = {
  titleIn: 1.8, // 标题升起淡入
  titleHold: 1.0, // 停留
  titleMove: 0.85, // 标题先行让位（移至封面位）
  lineDelay: 0.6, // 线段在标题让位后多久射出（保证不劈开标题）
  lineGrow: 0.5, // 线段生长
  split: 1.25, // 双边抽屉拉出
  carousel: 2.8, // 标题轮播每种语言的停留
  crossfade: 0.7, // 轮播交叉淡化时长
  lineOut: 0.4, // 线段消失
  dotIn: 0.35, // 中心点浮现
  dock: 0.85, // 双边继续靠边
  ringDraw: 1.45, // 轮廓顺时针显现（加速）
  tapIn: 0.6, // Tap 提示浮现
  dissolve: 1.9, // 粉末消散
  ringUndraw: 1.15, // 轮廓逆时针收回（减速）
  dotOut: 0.35, // 中点熄灭
};
const POS = {
  titleStartY: 0.54, // 标题初始纵向位置（×视口高，略低于正中）
  titleRise: 0.04, // 升起距离（×视口高）
  splitX: 0.31, // 分裂后左列中心（×视口宽；右列镜像）
  dockX: 0.22, // 靠边后左列中心（×视口宽；右列镜像）
  dockScale: 0.85, // 靠边时双边收缩，为光环让位
  coverW: [0.3, 0.48], // 封面尺寸 min(coverW[0]×vw, coverW[1]×vh)
  titleH: 0.075, // 标题块高（×视口高）
  titleGapMin: 14, // 标题与封面的间距下限（px）
  titleGap: 0.02, // 间距（×视口高）
};

const TITLES = [
  { cls: 'jp', text: '憧れの残響' },
  { cls: 'en', text: 'Echoes of Longing' },
  { cls: 'zh', text: '憧憬的残响' },
  { cls: 'kr', text: '동경의 잔향' },
];
const STAFF = [
  { role: 'Music', name: 'Mitsukiyo' },
  { role: 'Lyrics', name: 'Yuno Yoshimi (IOSYS)' },
  { role: 'Vocal', name: 'DAZBEE' },
];

function buildDom() {
  const root = document.createElement('div');
  root.id = 'opening';
  root.innerHTML = `
    <div id="op-line"></div>
    <div class="op-drawer left">
      <div id="op-cover"><img src="assets/img/cover.jpg" alt="Echoes of Longing cover art" draggable="false" /></div>
    </div>
    <div class="op-drawer right">
      <div id="op-staff">
        ${STAFF.map(
          (s) => `<div class="op-row"><span class="op-role">${s.role}</span><span class="op-name">${s.name}</span></div>`
        ).join('')}
        <p class="op-note">Blue Archive Ex. &ldquo;Decagrammaton&rdquo; ED</p>
        <a id="op-back" href="/" aria-label="Back to lyrics.kara251.com">&larr; lyrics.kara251.com</a>
      </div>
    </div>
    <div id="op-title">${TITLES.map(
      (t) => `<span class="lang ${t.cls}">${t.text}</span>`
    ).join('')}</div>
    <p id="op-tap">Tap Halo to Continue</p>
    <p id="op-hint">Space &mdash; play / pause &nbsp;&middot;&nbsp; tap or move &mdash; progress bar</p>
    <button id="op-hit" aria-label="Tap halo to continue"></button>
  `;
  document.getElementById('app').appendChild(root);
  return root;
}

/** 消散前沿 f（2→0）对应的 clip-path：保留前沿左上侧 */
function clipFor(f) {
  const p = (v) => `${(v * 100).toFixed(2)}%`;
  if (f >= 2) return 'none';
  if (f >= 1) {
    return `polygon(0% 0%, 100% 0%, 100% ${p(f - 1)}, ${p(f - 1)} 100%, 0% 100%)`;
  }
  return `polygon(0% 0%, ${p(f)} 0%, 0% ${p(f)})`;
}

export function runOpening({ stage, audio, onDone }) {
  const bloom0 = stage.bloom.strength;
  let tapped = false;
  let current = null; // 本次开演的句柄（供重排重演时清场）

  /** 竖屏触屏设备等横屏引导解除后再开演 */
  const canStart = () =>
    !(matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth);

  function start() {
    stage.resetCamera();
    const root = buildDom();
    const $ = (sel) => root.querySelector(sel);
    const line = $('#op-line');
    const title = $('#op-title');
    const cover = $('#op-cover');
    const coverImg = cover.querySelector('img');
    const staff = $('#op-staff');
    const tap = $('#op-tap');
    const hint = $('#op-hint');
    const hit = $('#op-hit');
    const langs = [...title.querySelectorAll('.lang')];

    const halo = new MalkuthHalo(stage.scene);
    let carousel = null;

    /* ---- 布局解算（标题贴封面组成居中块；像素基于当前视口） ---- */
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const coverSize = Math.min(POS.coverW[0] * vw, POS.coverW[1] * vh);
    const titleH = POS.titleH * vh;
    const gap = Math.max(POS.titleGapMin, POS.titleGap * vh);
    const blockTop = (vh - (titleH + gap + coverSize)) / 2;
    const titleY = blockTop + titleH / 2;
    const coverY = blockTop + titleH + gap + coverSize / 2;
    const leftX = POS.splitX * vw;
    const rightX = (1 - POS.splitX) * vw;
    const dockShift = (POS.splitX - POS.dockX) * vw;

    /* ---- 初始状态 ---- */
    gsap.set(title, {
      left: vw / 2,
      top: (POS.titleStartY + POS.titleRise) * vh,
      xPercent: -50,
      yPercent: -50,
      height: titleH,
      opacity: 0,
    });
    gsap.set(langs[0], { opacity: 1 });

    // 抽屉内容置于分裂后的位置，再整体推回中线之后（被 .op-drawer 裁切隐藏）
    gsap.set(cover, {
      left: leftX,
      top: coverY,
      xPercent: -50,
      yPercent: -50,
      width: coverSize,
      height: coverSize,
      x: vw / 2 - (leftX - coverSize / 2),
    });
    // 注意：#op-staff 的包含块是右抽屉（起点在 50vw），left 用抽屉局部坐标
    gsap.set(staff, { left: rightX - vw / 2, top: vh / 2, xPercent: -50, yPercent: -50 });
    const staffW = staff.offsetWidth;
    gsap.set(staff, { x: -(rightX - vw / 2 + staffW / 2) });

    // 靠边距离按内容宽度收敛：窄屏不把内容推出屏幕（光环在内容之下，允许重叠）
    const margin = 12;
    const dockShiftL = Math.max(
      0,
      Math.min(dockShift, leftX - margin - (Math.max(coverSize, title.offsetWidth) * POS.dockScale) / 2)
    );
    const dockShiftR = Math.max(
      0,
      Math.min(dockShift, vw - margin - rightX - (staffW * POS.dockScale) / 2)
    );

    /* ---- 入场时间轴 ---- */
    const tl = gsap.timeline();

    // 1 标题升起淡入 + 停留
    tl.to(title, {
      top: POS.titleStartY * vh,
      opacity: 1,
      duration: T.titleIn,
      ease: 'power2.out',
    });
    tl.to({}, { duration: T.titleHold });

    // 2 标题先行让位（快速移向封面位，彻底离开中线区）
    tl.add('depart');
    tl.to(
      title,
      { left: leftX, top: titleY, duration: T.titleMove, ease: 'power2.inOut' },
      'depart'
    );

    // 3 线段自正中向上下射出，双边同时像抽屉一样自线段后拉出（同始同终）
    tl.add('reveal', `depart+=${T.lineDelay}`);
    tl.to(line, { scaleY: 1, duration: T.lineGrow, ease: 'power4.out' }, 'reveal');
    tl.to(cover, { x: 0, duration: T.split, ease: 'power3.out' }, 'reveal');
    tl.to(staff, { x: 0, duration: T.split, ease: 'power3.out' }, 'reveal');

    // 拉出完成：撤下抽屉裁切（窄屏下右列可能宽于右半屏，继续裁切会切掉左缘）
    tl.call(() => root.classList.add('drawers-open'));

    // 标题开始多语言轮播
    tl.call(() => {
      carousel = gsap.timeline({ repeat: -1 });
      for (let i = 0; i < langs.length; i++) {
        const cur = langs[i];
        const next = langs[(i + 1) % langs.length];
        carousel
          .to(cur, { opacity: 0, duration: T.crossfade, ease: 'power1.inOut' }, `+=${T.carousel}`)
          .to(next, { opacity: 1, duration: T.crossfade, ease: 'power1.inOut' }, '<15%');
      }
    });

    // 3 线段消失，光环中点浮现，双边继续靠边让位
    tl.to(line, { opacity: 0, duration: T.lineOut, ease: 'power1.in' });
    tl.add(halo.showDot(T.dotIn));
    tl.add('dock');
    tl.to(
      cover,
      { x: -dockShiftL, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
      'dock'
    );
    tl.to(
      title,
      { left: leftX - dockShiftL, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
      'dock'
    );
    tl.to(
      staff,
      { x: dockShiftR, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
      'dock'
    );

    // 4 光环轮廓顺时针加速显现 + 辉光抬升
    tl.add('ring');
    tl.add(halo.draw(T.ringDraw), 'ring');
    tl.to(stage.bloom, { strength: 0.9, duration: T.ringDraw, ease: 'power2.in' }, 'ring');
    tl.to(stage.bloom, { strength: 0.6, duration: 0.8, ease: 'power2.out' });

    // 5 Tap 提示与操作说明，开放点击
    tl.to(tap, { opacity: 0.85, duration: T.tapIn, ease: 'power1.out' }, '<');
    tl.to(hint, { opacity: 0.45, duration: T.tapIn, ease: 'power1.out' }, '<0.2');
    tl.call(() => {
      halo.breathe();
      hit.classList.add('armed');
      gsap.to(tap, { opacity: 0.35, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
    });

    /* ---- 6 点击光环：粉末消散 + 光环逆序退场 ---- */
    async function onTap(e) {
      if (tapped || !hit.classList.contains('armed')) return;
      if (e.button !== undefined && e.button > 0) return;
      tapped = true;
      stopRelayout();
      hit.classList.remove('armed');
      carousel?.kill();
      gsap.killTweensOf(tap);

      // 浏览器手势内解锁音频（先播即停，正式起播交给播放器）
      let hasAudio = false;
      if (audio.el.src) {
        try {
          audio.ensureGraph();
          await audio.el.play();
          audio.el.pause();
          audio.el.currentTime = 0;
          hasAudio = true;
        } catch (err) {
          console.warn('[opening] 音频解锁失败，转静默排演', err);
        }
      }

      const dust = new DustField();
      await new Promise((resolve) => {
        const front = { f: 2 };
        gsap.to(front, {
          f: 0,
          duration: T.dissolve,
          ease: 'power1.inOut',
          onUpdate: () => {
            root.style.clipPath = clipFor(front.f);
            dust.emitAlongFront(front.f);
          },
          onComplete: resolve,
        });
      });
      root.style.visibility = 'hidden';

      await halo.undraw(T.ringUndraw);
      gsap.to(stage.bloom, { strength: bloom0, duration: T.ringUndraw, ease: 'power1.out' });
      await halo.hideDot(T.dotOut);

      dust.dispose();
      dispose(false);
      onDone({ hasAudio });
    }
    // click 为主，pointerup 兜底（个别移动浏览器 click 合成不可靠）；onTap 幂等
    hit.addEventListener('click', onTap);
    hit.addEventListener('pointerup', onTap);

    // 封面预解码，避免拉出瞬间的空白闪变
    coverImg.decode?.().catch(() => {});

    function dispose(restoreBloom = true) {
      tl.kill();
      carousel?.kill();
      gsap.killTweensOf([title, cover, staff, line, tap, hint]);
      gsap.killTweensOf(stage.bloom);
      halo.dispose();
      root.remove();
      if (restoreBloom) stage.bloom.strength = bloom0;
    }
    return { dispose };
  }

  /* ---- 横竖屏切换 / 视口突变：点击前整场重排重演 ----
     仅在方向翻转或视口大幅变化时触发；移动端地址栏收起那种
     小幅高度变化不重演，避免开场反复重放。 */
  let resizeTimer = 0;
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  function significantChange() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const flipped = w > h !== lastW > lastH;
    return flipped || Math.abs(w - lastW) > 60 || Math.abs(h - lastH) > Math.max(120, lastH * 0.25);
  }
  function onViewportChange() {
    if (tapped) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (tapped || !significantChange()) return;
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      current?.dispose();
      current = null;
      if (canStart()) current = start();
    }, 250);
  }
  function stopRelayout() {
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('orientationchange', onViewportChange);
  }
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);

  if (canStart()) current = start();
  // 竖屏触屏进入：横屏引导正在遮罩，转横屏触发 resize 后再开演
}
