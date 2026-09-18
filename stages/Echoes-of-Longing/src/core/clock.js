/**
 * 主时钟 —— 整场演出的唯一时间轴。
 * 有音频时锁定 audio.currentTime；无音频时自由走（静默排演模式），
 * 因此整场演出可以在没有任何素材的环境里完整空放（也是 CI 验证的基础）。
 */
export class MasterClock {
  constructor(duration = 268) {
    this.duration = duration; // 4:28
    this.t = 0;
    this.playing = false;
    this.media = null;
    this._seekListeners = [];
  }

  attachMedia(el) {
    this.media = el;
    el.addEventListener('loadedmetadata', () => {
      if (isFinite(el.duration) && el.duration > 0) this.duration = el.duration;
    });
  }

  play() {
    if (this.media) this.media.play();
    this.playing = true;
  }

  pause() {
    if (this.media) this.media.pause();
    this.playing = false;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  seek(t) {
    this.t = Math.min(Math.max(t, 0), this.duration);
    if (this.media) this.media.currentTime = this.t;
    for (const fn of this._seekListeners) fn(this.t);
  }

  onSeek(fn) {
    this._seekListeners.push(fn);
  }

  update(dt) {
    if (this.media) {
      this.t = this.media.currentTime;
      this.playing = !this.media.paused && !this.media.ended;
    } else if (this.playing) {
      this.t += dt;
      if (this.t >= this.duration) {
        this.t = this.duration;
        this.playing = false;
      }
    }
  }
}
