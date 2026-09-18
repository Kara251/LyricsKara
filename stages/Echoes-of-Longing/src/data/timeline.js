import { IntroSanctum } from '../cuts/intro/sanctum.js';
import { IntroCredits } from '../cuts/intro/credits.js';
import { LyricPhrases } from '../cuts/a1/lines.js';

/**
 * 时间轴 —— 整场演出的分镜表。区间允许重叠（背景床 + 前景演出叠放）。
 * 逐句创作时在这里增卡：每句歌词一行，指向它专属的 cut。
 * 分镜与设计决策见 docs/design.md；歌词时间轴见 docs/lyrics.md。
 */
export function buildTimeline() {
  return [
    // 3D 世界：前奏钢铁殿堂 → 下降海平面 → 主歌一前两句（一镜到底）
    { id: 'intro-sanctum', tIn: 0, tOut: 32.5, Cut: IntroSanctum },
    { id: 'intro-credits', tIn: 0, tOut: 22.2, Cut: IntroCredits },
    // 主歌一前两句文字演出（左 1/3，2D）
    { id: 'a1-1', tIn: 22, tOut: 28, Cut: LyricPhrases },
    { id: 'a1-2', tIn: 28, tOut: 32, Cut: LyricPhrases },
    // —— 0:42 起（a1-3）的逐句 cut 待 Kara 分镜 ——
  ];
}
