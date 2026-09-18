/**
 * 横屏引导 —— 演出为横向舞台设计。
 * 移动端（粗指针触屏）竖屏时全屏遮罩并暂停主时钟，转回横屏自动恢复；
 * 桌面端窄窗口不受影响。遮罩层级高于入场仪式，保证观众以横屏开场。
 */
export function initRotateGate({ clock }) {
  const el = document.getElementById('rotate-gate');
  const portrait = matchMedia('(orientation: portrait)');
  const coarse = matchMedia('(pointer: coarse)');

  let pausedByGate = false;

  function apply() {
    const block = portrait.matches && coarse.matches;
    el.hidden = !block;
    if (block) {
      if (clock.playing) {
        clock.pause();
        pausedByGate = true;
      }
    } else if (pausedByGate) {
      pausedByGate = false;
      clock.play();
    }
  }

  portrait.addEventListener('change', apply);
  coarse.addEventListener('change', apply);
  apply();
}
