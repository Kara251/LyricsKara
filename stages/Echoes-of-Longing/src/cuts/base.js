/**
 * Cut —— 一卡演出的契约。每句歌词（或每段器乐）对应一个独立的 cut 文件，
 * 在这里拥有完全的创作自由：三维场景、DOM 排印、后期参数、电影层全都可用。
 *
 * 生命周期：
 *   init()                    导演装载时调用一次：预载素材、构建 mesh（不上台）
 *   enter()                   进入 [tIn, tOut) 区间时调用；seek 进入也会调用，
 *                             因此必须能从任意时间点重建演出状态
 *   update(p, t, dt, audio)   每帧：p 为区间内进度 0..1，t 为全局秒，
 *                             audio 为 {bass, mid, high, level, beat}
 *   exit()                    离开区间/seek 离开时调用：把自己从舞台上撤干净
 *   dispose()                 整场销毁时释放 GPU 资源
 *
 * ctx = { stage, clock, audio }
 */
export class Cut {
  constructor(ctx, def) {
    this.ctx = ctx;
    this.def = def;
  }

  async init() {}
  enter() {}
  update(p, t, dt, audio) {}
  exit() {}
  dispose() {}
}
