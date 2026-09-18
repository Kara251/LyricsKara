/**
 * 粉末消散 —— 内容区自右下向左上化为粉末时的尘粒层。
 * 2D canvas 覆盖在被 clip 的 DOM 之上：沿对角扫描前沿撒尘，
 * 尘粒带初速与风偏、受重力、随寿命淡出缩小。
 */
const COLORS = ['#eef0ff', '#b9bce0', '#8b8fc7', '#f4ecc8'];
const GRAVITY = 300; // px/s²
const MAX_ALIVE = 2600;

export class DustField {
  constructor(parent = document.getElementById('app')) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'opening-dust';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.parts = [];
    this._alive = true;
    this._last = performance.now();
    const loop = (now) => {
      if (!this._alive) return;
      const dt = Math.min((now - this._last) / 1000, 0.05);
      this._last = now;
      this._step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /**
   * 沿消散前沿撒尘。前沿定义：x/W + y/H = f 与视口的交线，
   * f 自 2（右下角）推进到 0（左上角）。
   */
  emitAlongFront(f, count = 18) {
    if (f <= 0 || f >= 2) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let x1, y1, x2, y2;
    if (f >= 1) {
      x1 = W; y1 = (f - 1) * H;
      x2 = (f - 1) * W; y2 = H;
    } else {
      x1 = f * W; y1 = 0;
      x2 = 0; y2 = f * H;
    }
    const room = MAX_ALIVE - this.parts.length;
    for (let i = 0; i < Math.min(count, room); i++) {
      const t = Math.random();
      this.parts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 14,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 14,
        vx: 50 + Math.random() * 130,
        vy: -40 + Math.random() * 90,
        life: 0.8 + Math.random() * 0.8,
        age: 0,
        size: 0.8 + Math.random() * 1.6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
  }

  _step(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const next = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = k * k * 0.9;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + 0.6 * k);
      ctx.fillRect(p.x, p.y, s, s);
      next.push(p);
    }
    ctx.globalAlpha = 1;
    this.parts = next;
  }

  dispose() {
    this.canvas.style.transition = 'opacity 0.5s ease';
    this.canvas.style.opacity = '0';
    setTimeout(() => {
      this._alive = false;
      this.canvas.remove();
    }, 550);
  }
}
