/**
 * 音频引擎 —— 音源加载 + 实时频谱分析。
 * 出于版权考虑音频不进入仓库：优先探测 public/assets/audio/ 下的本地音源，
 * 缺失时由入场仪式提供本地文件选择。任何 cut 都可以从 frame 取
 * 平滑后的 bass/mid/high 能量与节拍脉冲来驱动演出。
 */
const DEFAULT_CANDIDATES = [
  'assets/audio/echoes-of-longing.mp3',
  'assets/audio/echoes-of-longing.ogg',
  'assets/audio/echoes-of-longing.m4a',
  'assets/audio/song.mp3',
  'assets/audio/song.ogg',
];

export class AudioEngine {
  constructor() {
    this.el = new Audio();
    this.el.preload = 'auto';
    this.el.crossOrigin = 'anonymous';
    this.ctx = null;
    this.analyser = null;
    this.bins = null;

    // 供演出取用的实时数据（全部 0..1，已平滑）
    this.frame = { bass: 0, mid: 0, high: 0, level: 0, beat: 0 };
    this._bassAvg = 0;
  }

  /** 探测站内默认音源，找到返回 true。单次探测限时，避免弱网卡死启动流程 */
  async tryLoadDefault() {
    for (const url of DEFAULT_CANDIDATES) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
        clearTimeout(timer);
        const type = res.headers.get('content-type') || '';
        if (res.ok && !type.includes('text/html')) {
          this.el.src = url;
          return true;
        }
      } catch {
        /* 探测失败/超时视同缺失 */
      }
    }
    return false;
  }

  loadFile(file) {
    this.el.src = URL.createObjectURL(file);
  }

  /** 必须在用户手势内调用（入场仪式负责） */
  ensureGraph() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaElementSource(this.el);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.ctx.resume();
  }

  analyse(dt) {
    const f = this.frame;
    if (!this.analyser) {
      // 静默模式：能量缓慢归零，演出退化为纯时间驱动
      const k = Math.min(dt * 2, 1);
      f.bass += (0 - f.bass) * k;
      f.mid += (0 - f.mid) * k;
      f.high += (0 - f.high) * k;
      f.level = 0;
      f.beat = Math.max(0, f.beat - dt * 3);
      return f;
    }

    this.analyser.getByteFrequencyData(this.bins);
    const sr = this.ctx.sampleRate;
    const hzPerBin = sr / 2 / this.bins.length;
    const avg = (fromHz, toHz) => {
      const a = Math.max(1, Math.floor(fromHz / hzPerBin));
      const b = Math.min(this.bins.length - 1, Math.ceil(toHz / hzPerBin));
      let s = 0;
      for (let i = a; i <= b; i++) s += this.bins[i];
      return s / (b - a + 1) / 255;
    };

    const bass = avg(28, 180);
    const mid = avg(180, 1600);
    const high = avg(1600, 9000);
    const k = 1 - Math.pow(0.0018, dt); // 帧率无关的平滑
    f.bass += (bass - f.bass) * k;
    f.mid += (mid - f.mid) * k;
    f.high += (high - f.high) * k;
    f.level = f.bass * 0.5 + f.mid * 0.35 + f.high * 0.15;

    // 简易节拍：低频能量越过滑动均值阈值时触发脉冲，随后指数衰减
    this._bassAvg += (bass - this._bassAvg) * Math.min(dt * 1.2, 1);
    if (bass > this._bassAvg * 1.32 && bass > 0.22 && f.beat < 0.25) f.beat = 1;
    else f.beat = Math.max(0, f.beat - dt * 3.2);

    return f;
  }
}
