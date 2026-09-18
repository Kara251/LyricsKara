/**
 * 歌词中文翻译字幕 —— 右下角、进度条右侧，始终淡入淡出当前句译文。
 * 独立于播放器控件常驻；随时间轴切换句子时交叉淡化。2D 不可操控。
 */
export class Subtitle {
  constructor({ lyrics }) {
    this.lyrics = lyrics;
    this.el = document.createElement('div');
    this.el.id = 'subtitle';
    document.getElementById('app').appendChild(this.el);
    this._pending = null; // 正在过渡到的文本
    this._timer = 0;
  }

  _activeText(t) {
    for (const l of this.lyrics) {
      if (t >= l.tIn && t < l.tOut && l.zh) return l.zh;
    }
    return '';
  }

  update(t) {
    const desired = this._activeText(t);
    if (desired === this._pending) return;
    this._pending = desired;
    // 交叉淡化：先淡出，再换字淡入
    this.el.dataset.show = '';
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this.el.textContent = desired;
      if (desired) this.el.dataset.show = '1';
    }, 260);
  }

  dispose() {
    clearTimeout(this._timer);
    this.el.remove();
  }
}
