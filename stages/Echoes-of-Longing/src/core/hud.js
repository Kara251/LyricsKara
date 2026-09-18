/**
 * 创作 HUD —— 逐卡打磨的工作台。
 * H 显隐 ・ 空格 播放/暂停 ・ ←/→ ±2s（Shift ±10s）・ [ / ] 跳上/下一个 cut 边界
 * Enter 打点（记录当前时间）・ ⌫ 撤销上一点 ・ E 导出打点（剪贴板 + 控制台）
 * URL 参数：?t=秒 直达时间点、?hud=1 显示、?silent=1 跳过入场直接静默排演
 *
 * 打点校对流程：播放中在每句歌词开头按 Enter，一遍唱完按 E——
 * 导出的行按 LYRICS 顺序配好 id，tOut 取下一点，粘回 data/lyrics.js 即可。
 */
import { LYRICS } from '../data/lyrics.js';

const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
};

export class Hud {
  constructor({ clock, director }) {
    this.clock = clock;
    this.director = director;

    const el = document.createElement('div');
    el.id = 'hud';
    el.hidden = true;
    el.innerHTML = `
      <div class="row">
        <span class="time">0:00.0 / 0:00.0</span>
        <input type="range" min="0" max="268" step="0.1" value="0" />
        <span class="cuts">—</span>
        <span class="marks"></span>
      </div>
      <div class="row keys">H 显隐 ・ 空格 播放/暂停 ・ ←→ ±2s（Shift ±10s）・ [ ] 跳卡 ・ Enter 打点 ・ ⌫ 撤点 ・ E 导出 ・ ?t=秒 直达</div>
    `;
    document.getElementById('app').appendChild(el);
    this.el = el;
    this.timeEl = el.querySelector('.time');
    this.cutsEl = el.querySelector('.cuts');
    this.marksEl = el.querySelector('.marks');
    this.range = el.querySelector('input');
    this.marks = [];

    this.range.addEventListener('input', () => {
      clock.seek(parseFloat(this.range.value));
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement && e.target !== this.range) return;
      switch (e.key) {
        case 'h':
        case 'H':
          el.hidden = !el.hidden;
          break;
        case ' ':
          e.preventDefault();
          clock.toggle();
          break;
        case 'ArrowLeft':
          clock.seek(clock.t - (e.shiftKey ? 10 : 2));
          break;
        case 'ArrowRight':
          clock.seek(clock.t + (e.shiftKey ? 10 : 2));
          break;
        case '[':
          this._jump(-1);
          break;
        case ']':
          this._jump(1);
          break;
        case 'Enter':
          this.marks.push(Math.round(this.clock.t * 100) / 100);
          this._flashMarks();
          break;
        case 'Backspace':
          this.marks.pop();
          this._flashMarks();
          break;
        case 'e':
        case 'E':
          this._exportMarks();
          break;
      }
    });
  }

  _flashMarks() {
    const last = this.marks.at(-1);
    this.marksEl.textContent = this.marks.length
      ? `打点 ${this.marks.length}/${LYRICS.length} @ ${fmt(last)}`
      : '';
  }

  _exportMarks() {
    if (!this.marks.length) return;
    const lines = this.marks
      .map((t, i) => {
        const id = LYRICS[i]?.id ?? `mark-${i + 1}`;
        const tOut = this.marks[i + 1] ?? Math.round(Math.min(t + 8, this.clock.duration) * 100) / 100;
        return `  { id: '${id}', tIn: ${t}, tOut: ${tOut} },`;
      })
      .join('\n');
    console.log(`// —— HUD 打点导出（${this.marks.length} 点）——\n${lines}`);
    navigator.clipboard?.writeText(lines).then(
      () => (this.marksEl.textContent = `已导出 ${this.marks.length} 点到剪贴板`),
      () => (this.marksEl.textContent = '已打印到控制台（剪贴板不可用）')
    );
  }

  _jump(dir) {
    const ts = this.director.boundaries;
    const t = this.clock.t;
    const next =
      dir > 0
        ? ts.find((b) => b > t + 0.05)
        : [...ts].reverse().find((b) => b < t - 0.05);
    if (next !== undefined) this.clock.seek(next);
  }

  show() {
    this.el.hidden = false;
  }

  update() {
    if (this.el.hidden) return;
    const { t, duration } = this.clock;
    this.timeEl.textContent = `${fmt(t)} / ${fmt(duration)}`;
    this.range.max = String(duration);
    if (document.activeElement !== this.range) this.range.value = String(t);
    const ids = this.director.activeIds;
    this.cutsEl.textContent = ids.length ? ids.join(' + ') : '—';
  }
}
