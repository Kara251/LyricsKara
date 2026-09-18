# 동경의 잔향 — Echoes of Longing

Blue Archive Ex.「Decagrammaton」篇 ED《憧れの残響 / Echoes of Longing》（Mitsukiyo × Yuno Yoshimi × DAZBEE）的**网页版静止系MAD**：不是歌词列表，而是以歌曲播放为时间轴的一场 4:28 实时演出。每句歌词是一个独立的"卡"（cut），拥有自己的分镜、镜头语言与文字演出。

> 当前状态：**开场演出已按 Kara 分镜实现**（标题升起 → 线段分裂 → 封面/Staff 拉出 → Malkuth 光环顺时针显现 → 点击后粉末消散入场）。歌词演出时间轴为空，待逐句分镜设计；开场 → 播放器的过渡演出待定。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
```

音源与图片素材放入 `public/assets/`（放置约定见 [public/assets/README.md](public/assets/README.md)）。没有任何素材也可以完整空放整场（静默排演模式）。

移动端竖屏时全屏显示「请横屏观看」遮罩并暂停演出，转为横屏自动恢复；桌面端窄窗口不受影响。

### 创作 HUD 与调试参数

| 操作 | 作用 |
| --- | --- |
| `H` | 显隐 HUD（时间码 / 当前 cut / seek 条） |
| `空格` | 播放 / 暂停 |
| `←` `→` | ±2s（按住 Shift ±10s） |
| `[` `]` | 跳到上 / 下一个 cut 边界 |
| `Enter` | 打点：记录当前时间（校对歌词时间轴用） |
| `⌫` | 撤销上一个打点 |
| `E` | 导出打点：按 LYRICS 顺序配 id，复制到剪贴板并打印到控制台 |
| `?t=95` | 直达 95 秒 |
| `?hud=1` | 启动即显示 HUD |
| `?silent=1` | 跳过入场仪式，直接静默排演（自动化验证用） |

## 架构：三层舞台 + 导演时间轴

```
WebGL 层   Three.js 场景（海面 / 光环 / 粒子 / 图像平面）
           + 后期管线（Bloom / 胶片颗粒 / 暗角 / 色差）
文字层     DOM 排印，逐字 span 化，GSAP 编舞；#ghosts 承载「残响」
电影层     letterbox / 闪帧 / 黑场幕布
```

- `src/core/` — 引擎四件套：`clock`（主时钟，无音频可自由走）、`audio`（音源加载 + bass/mid/high/beat 实时分析）、`director`（cut 生命周期调度，区间可重叠）、`stage`（三层舞台）；以及 `type`（逐字排印与残响工具）、`hud`（创作工作台）、`orientation`（移动端横屏引导）。
- `src/opening/` — 开场演出：`opening`（分镜编排与可调参数）、`malkuthHalo`（3D 棱面光环，角向顺时针显影/逆时针收回）、`dust`（粉末消散尘粒层）。
- `src/fx/` — 共享演出组件：`ocean`（暮色海面）、`grain`（胶片后期）、`imagePlane`（任意素材的视差 / 溶解 / RGB 分离管线）、`textParticles`（文字粒子聚散）。
- `src/cuts/` — 每卡一个文件。契约见 `base.js`：`init → enter → update(p, t, dt, audio) → exit → dispose`，`enter` 必须支持从任意时间点 seek 进入。
- `src/data/` — `lyrics.js`（歌词原料表，待填入官方词与译文）、`timeline.js`（分镜表）。

## 逐句创作流程

1. 在 `data/lyrics.js` 填入一句歌词（日文 / 中文 / 时间）
2. 在 `cuts/` 为它新建专属 cut 文件，自由设计演出（可复用 `fx/` 组件，也可完全另起炉灶）
3. 在 `data/timeline.js` 挂上这一卡
4. 用 HUD 的 `?t=` 与 `[` `]` 反复打磨这一卡，直到满意

## 部署（Cloudflare Pages）

本项目部署到 **`lyrics.kara251.com`**，托管在 Cloudflare Pages 上。

### 在 Cloudflare 控制台一次性配置

1. **创建 Pages 项目** → 连接 GitHub 仓库 `Kara251/Echoes-of-Longing`
2. **构建设置**

   | 字段 | 值 |
   | --- | --- |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | 22 |

3. **自定义域名** → 添加 `lyrics.kara251.com` → Cloudflare 会自动在 DNS 加 CNAME 记录

配置完成后，每次推送到 `main` 分支 Cloudflare Pages 自动构建并部署，通常 1 分钟内生效。`public/assets/` 中的素材随仓库提交并参与线上构建。
