import './styles.css';
import '@fontsource/shippori-mincho/400.css';
import '@fontsource/shippori-mincho/700.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/nanum-myeongjo/400.css';

import { Stage } from './core/stage.js';
import { MasterClock } from './core/clock.js';
import { AudioEngine } from './core/audio.js';
import { Director } from './core/director.js';
import { Hud } from './core/hud.js';
import { PlayerBar } from './core/player.js';
import { Subtitle } from './core/subtitle.js';
import { initRotateGate } from './core/orientation.js';
import { runOpening } from './opening/opening.js';
import { SONG, LYRICS } from './data/lyrics.js';
import { buildTimeline } from './data/timeline.js';

// 不用顶层 await：旧移动浏览器不支持时会让整页脚本静默死亡
async function boot() {
  const params = new URLSearchParams(location.search);

  const stage = new Stage({
    canvas: document.getElementById('gl'),
    cineLayer: document.getElementById('cine-layer'),
  });
  const audio = new AudioEngine();
  const clock = new MasterClock(SONG.duration);
  const director = new Director({ stage, clock, audio });
  clock.onSeek((t) => director.handleSeek(t));

  // 横屏引导尽早挂载（在字体与素材加载之前即可遮罩）
  initRotateGate({ clock });

  // 音源探测与开场演出并行；点击光环时按 el.src 即时判定
  audio.tryLoadDefault().then((ok) => {
    if (!ok) console.warn('[main] 未找到站内音源，点击光环后将静默排演');
  });

  // 字体就绪后再装载导演与开场（标题排印、文字粒子需要栅格化字体）
  await document.fonts.ready;
  await director.load(buildTimeline());

  const hud = new Hud({ clock, director });
  if (params.get('hud') === '1') hud.show();
  const player = new PlayerBar({ clock });
  const subtitle = new Subtitle({ lyrics: LYRICS });
  let performanceStarted = false;

  /**
   * 进入播放器。
   * TODO: 开场 → 播放器的过渡演出待 Kara 分镜，目前直接起播（空时间轴黑场）。
   */
  function enterPlayer({ hasAudio }) {
    performanceStarted = true;
    if (hasAudio) clock.attachMedia(audio.el);
    const t0 = parseFloat(params.get('t') || '0');
    if (t0 > 0) clock.seek(t0);
    clock.play();
    player.activate();
  }

  // 开场演出直接使用 WebGL 舞台作背景，撤下黑场幕布
  stage.setVeil(0);

  if (params.get('silent') === '1') {
    // 跳过开场直接静默排演（开发与自动化验证用）
    enterPlayer({ hasAudio: false });
  } else {
    runOpening({ stage, audio, onDone: enterPlayer });
  }

  /* ---- 主循环 ---- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    clock.update(dt);
    const f = audio.analyse(dt);
    if (performanceStarted) {
      director.update(clock.t, dt, f);
      subtitle.update(clock.t);
    }
    hud.update();
    player.update();
    stage.render(dt, clock.t);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('[main] 启动失败', err);
});
