import { Cut } from '../base.js';

/**
 * 前奏 · Staff 字幕（0:00–0:22.2，Kara 分镜 2026-07-06）
 * 屏幕左侧、ED 式的职位表：淡蓝描边 + 白色内芯，分三批淡入淡出。
 * 2D 内容不可操控（pointer-events: none，不拦截殿堂的拖拽）。
 * 批次时机为时间驱动纯函数，seek 进入状态正确。
 */

/* ---- 批次与窗口（in0→in1 淡入，out0→out1 淡出）---- */
const BATCHES = [
  {
    window: [1.5, 3.0, 9.3, 10.6],
    groups: [
      { role: 'Music', names: ['Mitsukiyo'] },
      { role: 'Lyrics', names: ['Yuno Yoshimi (IOSYS)'] },
      { role: 'Vocal', names: ['DAZBEE'] },
    ],
  },
  {
    window: [11.2, 12.6, 15.9, 17.1],
    groups: [
      { role: 'Translation', names: ['Blue Archive', 'Kara251'] },
      { role: 'Ending Song', names: ['Blue Archive Ex. Decagrammaton ED'] },
    ],
  },
  {
    window: [17.7, 19.0, 21.0, 22.0],
    groups: [
      { role: 'Website Visual Design', names: ['Kara251', 'lyrics.kara251.com'] },
    ],
  },
];

const RISE = 14; // 淡入时的上浮距离（px）

const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class IntroCredits extends Cut {
  enter() {
    this.root = document.createElement('div');
    this.root.className = 'intro-credits';
    this.root.innerHTML = BATCHES.map(
      (batch) => `<div class="credit-batch">${batch.groups
        .map(
          (g) => `<div class="credit">
            <p class="credit-role">${g.role}</p>
            ${g.names.map((n) => `<p class="credit-name">${n}</p>`).join('')}
          </div>`
        )
        .join('')}</div>`
    ).join('');
    document.getElementById('app').appendChild(this.root);
    this.batchEls = [...this.root.querySelectorAll('.credit-batch')];
  }

  update(p, t) {
    BATCHES.forEach((batch, i) => {
      const [in0, in1, out0, out1] = batch.window;
      const vis = smoothstep(in0, in1, t) * (1 - smoothstep(out0, out1, t));
      const el = this.batchEls[i];
      el.style.opacity = vis.toFixed(3);
      el.style.transform = `translateY(${((1 - smoothstep(in0, in1, t)) * RISE).toFixed(1)}px)`;
      el.style.visibility = vis > 0.001 ? 'visible' : 'hidden';
    });
  }

  exit() {
    this.root?.remove();
  }
}
