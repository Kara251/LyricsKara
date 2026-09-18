import { gsap } from 'gsap';

/**
 * 文字层工具 —— 歌词排演的基础件。
 * makeLine 把一句歌词逐字 span 化交给 cut 自由编舞；
 * ghostify 是「残响」机制：整句演出结束时不删除，而是克隆为
 * 半透明回声，缓慢上浮、模糊、消散 —— 声音停止后仍在回荡的部分。
 */

const linesRoot = () => document.getElementById('lines');
const ghostsRoot = () => document.getElementById('ghosts');

/**
 * 创建一句歌词的 DOM 结构。
 * @param {{jp?:string, zh?:string, className?:string}} opts
 * @returns {{root:HTMLElement, jpEl:HTMLElement|null, zhEl:HTMLElement|null, chars:HTMLElement[]}}
 */
export function makeLine({ jp = '', zh = '', className = '' } = {}) {
  const root = document.createElement('div');
  root.className = `lyric-line ${className}`.trim();

  let jpEl = null;
  const chars = [];
  if (jp) {
    jpEl = document.createElement('div');
    jpEl.className = 'jp';
    for (const ch of jp) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = ch === ' ' ? ' ' : ch;
      jpEl.appendChild(span);
      chars.push(span);
    }
    root.appendChild(jpEl);
  }

  let zhEl = null;
  if (zh) {
    zhEl = document.createElement('div');
    zhEl.className = 'zh';
    zhEl.textContent = zh;
    root.appendChild(zhEl);
  }

  linesRoot().appendChild(root);
  return { root, jpEl, zhEl, chars };
}

/**
 * 残响化：克隆一句歌词到 #ghosts 层并让它作为回声消散。
 * 原节点仍归 cut 所有（通常随后移除）。
 * @param {HTMLElement} lineRoot  makeLine 返回的 root
 * @param {{rise?:number, drift?:number, dur?:number, hold?:number}} opts
 */
export function ghostify(lineRoot, { rise = 90, drift = 0, dur = 6, hold = 0 } = {}) {
  const ghost = lineRoot.cloneNode(true);
  ghost.style.pointerEvents = 'none';
  ghostsRoot().appendChild(ghost);

  gsap.set(ghost, { opacity: 0.5 });
  gsap.to(ghost, {
    delay: hold,
    duration: dur,
    y: `-=${rise}`,
    x: `+=${drift}`,
    opacity: 0,
    filter: 'blur(10px)',
    ease: 'sine.out',
    onComplete: () => ghost.remove(),
  });
  return ghost;
}

/** 清空文字层（seek 或 cut 退场时使用） */
export function clearLines() {
  linesRoot().replaceChildren();
}

/** 清空残响层（一般只在整场 seek 时使用） */
export function clearGhosts() {
  ghostsRoot().replaceChildren();
}
