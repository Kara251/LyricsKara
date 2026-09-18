/**
 * 生产环境播放器控件 —— 面向观众的最小控制条。
 * 底部：播放/暂停按钮 + 进度条（点按跳转）+ 时间码。
 * 显隐：鼠标移动即显、3s 无操作自隐（播放中）；触屏点空白处切换显隐；
 * 暂停时保持可见。空格播放/暂停由 HUD 的全局键监听承担（生产同样生效）。
 * 开场演出期间未激活，enterPlayer 后 activate()。
 */
const fmt = (t) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export class PlayerBar {
  constructor({ clock }) {
    this.clock = clock;
    this.active = false;
    this.visible = false;
    this._hideTimer = 0;

    const el = document.createElement('div');
    el.id = 'player';
    el.innerHTML = `
      <button id="pl-toggle" aria-label="Play / pause">&#9654;</button>
      <div id="pl-track" role="slider" aria-label="Progress"><div id="pl-fill"></div></div>
      <span id="pl-time">0:00 / 0:00</span>
    `;
    document.getElementById('app').appendChild(el);
    this.el = el;
    this.btn = el.querySelector('#pl-toggle');
    this.track = el.querySelector('#pl-track');
    this.fill = el.querySelector('#pl-fill');
    this.timeEl = el.querySelector('#pl-time');

    this.btn.addEventListener('click', () => {
      this.clock.toggle();
      this.btn.blur(); // 防止后续空格键触发按钮造成双重切换
      this._reveal();
    });
    this.track.addEventListener('pointerdown', (e) => {
      const rect = this.track.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      this.clock.seek(frac * this.clock.duration);
      this._reveal();
    });

    document.addEventListener('pointermove', (e) => {
      if (this.active && e.pointerType === 'mouse') this._reveal();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.active || e.pointerType === 'mouse') return;
      if (this.el.contains(e.target)) {
        this._reveal();
        return;
      }
      // 触屏：点空白处切换显隐
      this.visible ? this._hide() : this._reveal();
    });
  }

  activate() {
    this.active = true;
    this.el.dataset.active = '1';
    this._reveal();
  }

  _reveal() {
    if (!this.active) return;
    this.visible = true;
    this.el.dataset.visible = '1';
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (this.clock.playing) this._hide();
    }, 3000);
  }

  _hide() {
    this.visible = false;
    delete this.el.dataset.visible;
    clearTimeout(this._hideTimer);
  }

  update() {
    if (!this.active || !this.visible) return;
    const { t, duration, playing } = this.clock;
    this.fill.style.width = `${((t / Math.max(duration, 0.01)) * 100).toFixed(2)}%`;
    this.timeEl.textContent = `${fmt(t)} / ${fmt(duration)}`;
    this.btn.innerHTML = playing ? '&#10074;&#10074;' : '&#9654;';
  }
}
