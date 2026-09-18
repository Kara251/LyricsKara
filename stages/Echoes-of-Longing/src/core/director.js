import { clearGhosts, clearLines } from './type.js';

/**
 * 导演 —— 按时间轴调度 cut 的生命周期。
 * timeline 定义：[{ id, tIn, tOut, Cut }]，区间允许重叠（交叉转场/背景床）。
 * cut 契约见 cuts/base.js：init 预载 → enter 进场 → update 每帧 → exit 退场。
 * seek 后所有 cut 强制退场再按新时间进场，因此 enter() 必须能从任意时刻重建状态。
 */
export class Director {
  constructor(ctx) {
    this.ctx = ctx;
    this.defs = [];
    this.instances = new Map(); // id -> cut 实例
    this.active = new Set();
  }

  async load(defs) {
    this.defs = [...defs].sort((a, b) => a.tIn - b.tIn);
    // 目前 cut 数量有限，全部提前 init（预载素材、建 mesh）。
    // 将来 cut 变多可以改为按 tIn 滚动预载。
    for (const def of this.defs) {
      const cut = new def.Cut(this.ctx, def);
      await cut.init();
      this.instances.set(def.id, cut);
    }
  }

  /** 边界时间点列表（HUD 的跳卡快捷键用） */
  get boundaries() {
    const ts = new Set([0]);
    for (const d of this.defs) {
      ts.add(d.tIn);
      ts.add(d.tOut);
    }
    return [...ts].sort((a, b) => a - b);
  }

  get activeIds() {
    return [...this.active];
  }

  handleSeek(t) {
    for (const id of this.active) this.instances.get(id).exit();
    this.active.clear();
    clearLines();
    clearGhosts();
    // 进场交由下一帧 update 按 t 重新判定
  }

  update(t, dt, audio) {
    for (const def of this.defs) {
      const cut = this.instances.get(def.id);
      const inside = t >= def.tIn && t < def.tOut;
      const isActive = this.active.has(def.id);

      if (inside && !isActive) {
        this.active.add(def.id);
        cut.enter();
      } else if (!inside && isActive) {
        this.active.delete(def.id);
        cut.exit();
      }

      if (inside) {
        const p = (t - def.tIn) / (def.tOut - def.tIn);
        cut.update(p, t, dt, audio);
      }
    }
  }

  dispose() {
    for (const cut of this.instances.values()) {
      cut.exit?.();
      cut.dispose?.();
    }
    this.instances.clear();
    this.active.clear();
  }
}
