import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGrainPass } from '../fx/grain.js';

/**
 * 三层舞台：
 *   1. WebGL 层（Three.js 场景 + Bloom / 胶片颗粒 / 暗角 / 色差后期）
 *   2. 文字层（DOM，见 core/type.js）
 *   3. 电影层（letterbox / 闪帧 / 黑场幕布）
 * cut 通过 stage.scene 挂载三维演出，通过 cine 系列方法控制电影层。
 */
export class Stage {
  constructor({ canvas, cineLayer }) {
    // 移动 GPU 上抗锯齿或高像素比可能导致上下文创建失败/掉帧，逐级退让
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    }
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d1f);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 0, 10);

    // 后期管线（Bloom 需要浮点渲染目标，个别设备不支持时降级直渲）
    this.post = true;
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.65, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.grain = createGrainPass();
      this.composer.addPass(this.grain);
    } catch (err) {
      console.warn('[stage] 后期管线不可用，降级为直接渲染', err);
      this.post = false;
      this.composer = null;
      this.bloom = { strength: 0.38 }; // 占位对象：演出对 bloom 的 tween 不致报错
      this.grain = { uniforms: { uTime: { value: 0 } } };
    }

    this._barTop = cineLayer.querySelector('.bar.top');
    this._barBottom = cineLayer.querySelector('.bar.bottom');
    this._veil = cineLayer.querySelector('#veil');
    this._flash = cineLayer.querySelector('#flash');

    // 画布尺寸以实际盒子为准（ResizeObserver 兜底错过的 resize 事件），
    // 且不让 three 写内联像素尺寸——canvas 永远按 CSS 铺满，
    // 避免视口变化后画布与视口错位（光环等 3D 内容偏心）。
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resetCamera() {
    if (this.camera.view?.enabled) this.camera.clearViewOffset();
    this.camera.position.set(0, 0, 10);
    this.camera.rotation.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.resize();
  }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
  }

  /* ---- 电影层 ---- */

  /** letterbox 收紧程度 0..1（0.12 ≈ 常规电影黑边） */
  setLetterbox(v) {
    const h = `${(v * 50).toFixed(2)}%`;
    this._barTop.style.height = h;
    this._barBottom.style.height = h;
  }

  /** 黑场幕布不透明度 0..1（开场/转场用） */
  setVeil(opacity, transition = '') {
    this._veil.style.transition = transition;
    this._veil.style.opacity = String(opacity);
  }

  /** 闪帧（默认闪白，可传色） */
  flash(color = '#fff', dur = 0.12, peak = 0.9) {
    const el = this._flash;
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = String(peak);
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${dur}s ease-out`;
      el.style.opacity = '0';
    });
  }

  render(dt, t) {
    if (!this.post) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.grain.uniforms.uTime.value = t;
    this.composer.render(dt);
  }
}
