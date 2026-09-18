import { Cut } from '../base.js';

/**
 * 主歌一前两句 · 文字演出（2D 不可操控）
 *
 * 位置：屏幕左 1/3、上下对称的一组；**竖排**（每句一列，字从上往下排）。
 * 按演唱停顿断行（原词里的 `/`），各列自左向右排布、且处于不同的初始高度；
 * 每列逐字自上而下淡入、句末整体淡出。
 * 演出状态是绝对时间 t 的纯函数（逐字 smoothstep 窗口），seek 安全。
 *
 * 时间/位置为初稿，随打点校对；常量集中在下方便于逐句打磨。
 * x = 列的水平位置（vw，越小越左）；top = 列顶起始高度（vh，各列不同）。
 */
const CHAR_DUR = 0.5; // 单字淡入时长
const CHAR_STAGGER = 0.1; // 逐字间隔（自上而下）
const DROP = 14; // 淡入时自上落入的位移（px）

const LAYOUTS = {
  'a1-1': [
    { text: '頬を撫でる風の', x: 8, top: 24, in: 22.4, out: [27.1, 27.9] },
    { text: '優しさに', x: 15.5, top: 40, in: 24.9, out: [27.3, 28.0] },
  ],
  'a1-2': [
    { text: '心はほどけて', x: 10, top: 26, in: 28.4, out: [31.1, 31.8] },
    { text: '混じり合う', x: 17.5, top: 42, in: 29.9, out: [31.3, 32.0] },
  ],
};

const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class LyricPhrases extends Cut {
  enter() {
    this.layout = LAYOUTS[this.def.id] || [];
    this.root = document.createElement('div');
    this.root.className = 'lyric-verse';

    this.phrases = this.layout.map((ph) => {
      const el = document.createElement('div');
      el.className = 'lyric-phrase';
      el.style.left = `${ph.x}vw`;
      el.style.top = `${ph.top}vh`;
      const chars = [...ph.text].map((c) => {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = c;
        el.appendChild(span);
        return span;
      });
      this.root.appendChild(el);
      return { ...ph, el, chars };
    });

    document.getElementById('lines').appendChild(this.root);
  }

  update(p, t) {
    for (const ph of this.phrases) {
      const out = 1 - smoothstep(ph.out[0], ph.out[1], t);
      for (let i = 0; i < ph.chars.length; i++) {
        const inK = smoothstep(ph.in + i * CHAR_STAGGER, ph.in + i * CHAR_STAGGER + CHAR_DUR, t);
        const a = inK * out;
        const span = ph.chars[i];
        span.style.opacity = a.toFixed(3);
        // 竖排：逐字自上而下落入
        span.style.transform = `translateY(${(-(1 - inK) * DROP).toFixed(1)}px)`;
      }
    }
  }

  exit() {
    this.root?.remove();
  }
}
