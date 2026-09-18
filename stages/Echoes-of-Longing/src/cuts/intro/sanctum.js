import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Cut } from '../base.js';
import { Sanctum } from '../../fx/sanctum.js';
import { SkyDome } from '../../fx/sky.js';
import { Sea } from '../../fx/sea.js';
import { Continent } from '../../fx/continent.js';
import { FallingField } from '../../fx/fall.js';

/**
 * 前奏 + 主歌一前两句的 3D 世界（0:00–0:32，Kara 分镜 2026-07-06 / 07-07）
 *
 * 一镜到底的连续 3D 舞台，相机全程可拖拽旋转（OrbitControls；禁缩放/平移；
 * 距离/注视/引导过渡由演出接管，方向交给用户）。所有淡入淡出与相机相位
 * 均由绝对时间 t 决定，seek 进入状态正确。
 *
 *  0:00–0:11  近景仰视：置身破碎的钢铁环带之间
 *  0:11–0:14.5 拉远到殿堂全景
 *  0:14.5–0:17 全景停留（真光环消散成粒子、钢铁环崩解）
 *  0:17–0:22  俯冲下降到海平面：海面与正在沉没的钢铁大陆自下方浮现
 *  0:22–0:28  海平面近景：钢铁大陆本体在侧（默认只见一小块），上方仍见
 *             坠落的殿堂碎块砸入海面激起涟漪；可视化阵风吹皱海面
 *  0:28–0:32  殿堂坠落物分解为更细的颗粒密密落海，涟漪相互交叠启奏
 *  0:31–0:32.4 世界整体淡出（交棒后续分镜）
 */

const SEA_Y = -70;
const CONTINENT_BASE_Y = SEA_Y + 24.5;

/* ---- 相机关键帧（可调） ---- */
const CAM = {
  nearTarget: new THREE.Vector3(0, -5.4, 0),
  nearRadius: 62,
  panoTarget: new THREE.Vector3(0, -7.2, 0),
  panoRadius: 124,
  panoPolar: THREE.MathUtils.degToRad(109),
  seaTarget: new THREE.Vector3(14, -68, 44),
  seaRadius: 74,
  seaPolar: THREE.MathUtils.degToRad(87),
  seaWideTarget: new THREE.Vector3(30, -68, 78),
  seaWideRadius: 150,
  seaWidePolar: THREE.MathUtils.degToRad(82),
  seaWideIn: 27.4,
  seaAzimuth: 1.05,
  pullIn: 11,
  pullOut: 14.5,
  descendIn: 17,
  descendOut: 22,
  frameShift: 0.16, // 近景/海景构图右移，左 1/3 留给字幕与歌词
};

const FADE = {
  sanctumIn: 2.5,
  skyIn: 4,
  seaIn: [16, 20.5],
  continentIn: [16.5, 21],
  fallIn: [20, 22],
  worldOut: [31.2, 32.4],
};

const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const lerpV = (out, a, b, k) => out.copy(a).lerp(b, k);

export class IntroSanctum extends Cut {
  enter() {
    const { stage } = this.ctx;
    const t0 = this.ctx.clock.t;

    this._bloom = stage.bloom
      ? { strength: stage.bloom.strength, threshold: stage.bloom.threshold, radius: stage.bloom.radius }
      : null;
    if (stage.bloom) {
      stage.bloom.strength = 0.18;
      stage.bloom.threshold = 0.93;
      stage.bloom.radius = 0.45;
    }

    this.sky = new SkyDome(stage.scene);
    this.sanctum = new Sanctum();
    stage.scene.add(this.sanctum.group);
    this.sea = new Sea(stage.scene, { y: SEA_Y });
    // 大陆起始应整体高于水线；沉没感来自贴近海面与极慢下沉，而不是开场半淹。
    this.continent = new Continent(stage.scene, { center: new THREE.Vector3(0, CONTINENT_BASE_Y, 0), radius: 95 });
    this.fall = new FallingField(stage.scene, { seaY: SEA_Y });

    this.ambient = new THREE.AmbientLight(0xd7e9f6, 0.72);
    this.hemi = new THREE.HemisphereLight(0xf6fcff, 0xd4e4f0, 1.48);
    this.dir = new THREE.DirectionalLight(0xffffff, 2.25);
    this.dir.position.set(36, 82, 28);
    this.fill = new THREE.DirectionalLight(0xe8f6ff, 1.65);
    this.fill.position.set(-28, -54, -36);
    stage.scene.add(this.ambient, this.hemi, this.dir, this.fill);

    this._pullPolar = null;
    this._descPolar = null;
    this._descAz = null;
    this._tmpTarget = new THREE.Vector3();

    // 初始相机就位（seek 直接落在正确相位）
    const cam = this._camAt(t0, stage.camera);
    stage.camera.position.set(
      cam.target.x + cam.radius * Math.sin(cam.polar) * Math.sin(cam.azimuth),
      cam.target.y + cam.radius * Math.cos(cam.polar),
      cam.target.z + cam.radius * Math.sin(cam.polar) * Math.cos(cam.azimuth)
    );

    this.controls = new OrbitControls(stage.camera, stage.renderer.domElement);
    this.controls.target.copy(cam.target);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.55;
  }

  /** 计算 t 时刻的相机布局（不含用户拖拽的自由方位） */
  _camAt(t, camera) {
    const target = this._tmpTarget;
    let radius;
    if (t < CAM.pullIn) {
      target.copy(CAM.nearTarget);
      radius = CAM.nearRadius;
    } else if (t < CAM.pullOut) {
      const k = smoothstep(CAM.pullIn, CAM.pullOut, t);
      lerpV(target, CAM.nearTarget, CAM.panoTarget, k);
      radius = THREE.MathUtils.lerp(CAM.nearRadius, CAM.panoRadius, k);
    } else if (t < CAM.descendIn) {
      target.copy(CAM.panoTarget);
      radius = CAM.panoRadius;
    } else if (t < CAM.descendOut) {
      const k = smoothstep(CAM.descendIn, CAM.descendOut, t);
      lerpV(target, CAM.panoTarget, CAM.seaTarget, k);
      radius = THREE.MathUtils.lerp(CAM.panoRadius, CAM.seaRadius, k);
    } else if (t < CAM.seaWideIn) {
      target.copy(CAM.seaTarget);
      radius = CAM.seaRadius;
    } else {
      const k = smoothstep(CAM.seaWideIn, 30.6, t);
      lerpV(target, CAM.seaTarget, CAM.seaWideTarget, k);
      radius = THREE.MathUtils.lerp(CAM.seaRadius, CAM.seaWideRadius, k);
    }
    // 用于 enter() 初始就位的 polar/azimuth（运行期由 controls 管理）
    const polar =
      t < CAM.pullIn
        ? THREE.MathUtils.degToRad(100)
        : t < CAM.descendOut
        ? THREE.MathUtils.lerp(THREE.MathUtils.degToRad(100), CAM.seaPolar, smoothstep(CAM.pullIn, CAM.descendOut, t))
        : t < CAM.seaWideIn
        ? CAM.seaPolar
        : THREE.MathUtils.lerp(CAM.seaPolar, CAM.seaWidePolar, smoothstep(CAM.seaWideIn, 30.6, t));
    return { target, radius, polar, azimuth: CAM.seaAzimuth };
  }

  update(p, t, dt) {
    const { stage } = this.ctx;
    const cam = this._camAt(t, stage.camera);

    // 距离与注视点由演出接管
    this.controls.minDistance = cam.radius;
    this.controls.maxDistance = cam.radius;
    this.controls.target.copy(cam.target);

    // 拉远与俯冲两段锁定俯仰/方位做引导，其余交给用户
    const pulling = t >= CAM.pullIn && t < CAM.pullOut;
    const descending = t >= CAM.descendIn && t < CAM.descendOut;
    if (pulling) {
      if (this._pullPolar === null) this._pullPolar = this.controls.getPolarAngle();
      const k = smoothstep(CAM.pullIn, CAM.pullOut, t);
      const polar = THREE.MathUtils.lerp(this._pullPolar, CAM.panoPolar, k);
      this.controls.minPolarAngle = this.controls.maxPolarAngle = polar;
    } else if (descending) {
      if (this._descPolar === null) this._descPolar = this.controls.getPolarAngle();
      if (this._descAz === null) this._descAz = this.controls.getAzimuthalAngle();
      const k = smoothstep(CAM.descendIn, CAM.descendOut, t);
      const polar = THREE.MathUtils.lerp(this._descPolar, CAM.seaPolar, k);
      const az = THREE.MathUtils.lerp(this._descAz, CAM.seaAzimuth, k);
      this.controls.minPolarAngle = this.controls.maxPolarAngle = polar;
      this.controls.minAzimuthAngle = this.controls.maxAzimuthAngle = az;
    } else {
      this.controls.minPolarAngle = t < CAM.descendIn ? 0.35 : 0.7;
      this.controls.maxPolarAngle = t < CAM.descendIn ? 2.35 : 1.62;
      this.controls.minAzimuthAngle = -Infinity;
      this.controls.maxAzimuthAngle = Infinity;
      this._pullPolar = null;
    }
    this.controls.update();

    // 构图右移（近景 0–11 与海景 22–32），拉远/俯冲时回正
    const nearShift = 1 - smoothstep(CAM.pullIn, CAM.pullOut, t);
    const seaShift = smoothstep(CAM.descendIn, CAM.descendOut, t);
    const lateWide = 1 - smoothstep(CAM.seaWideIn, 30.6, t) * 0.45;
    const shift = CAM.frameShift * lateWide * Math.max(t < CAM.descendIn ? nearShift : 0, seaShift);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (shift > 0.002) stage.camera.setViewOffset(vw, vh, -vw * shift, 0, vw, vh);
    else if (stage.camera.view?.enabled) stage.camera.clearViewOffset();

    this.sky.follow(stage.camera);

    // 淡入淡出（时间驱动，seek 安全）
    const worldOut = 1 - smoothstep(FADE.worldOut[0], FADE.worldOut[1], t);
    this.sanctum.opacity = smoothstep(0, FADE.sanctumIn, t) * worldOut;
    this.sky.mix = smoothstep(0, FADE.skyIn, t) * worldOut;
    this.sea.opacity = smoothstep(FADE.seaIn[0], FADE.seaIn[1], t) * worldOut;
    this.continent.opacity = smoothstep(FADE.continentIn[0], FADE.continentIn[1], t) * worldOut;
    this.fall.opacity = smoothstep(FADE.fallIn[0], FADE.fallIn[1], t) * worldOut;

    // 大陆极缓下沉（沉没是漫长过程，保留上一版速度的 1/10）
    this.continent.setSubmersion(Math.max(0, t - 20) * 0.011);

    // 可视化阵风：主要表现为海面风痕，几何起伏保持克制。
    const gust = 0.44 + 0.56 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.52 - 1.1), 2.0);

    this.sanctum.update(t);
    this.sea.update(t, stage.camera.position, gust);
    this.fall.update(t);
  }

  exit() {
    const { stage } = this.ctx;
    this.controls?.dispose();
    stage.scene.remove(this.sanctum.group, this.ambient, this.hemi, this.dir, this.fill);
    if (stage.bloom && this._bloom) {
      stage.bloom.strength = this._bloom.strength;
      stage.bloom.threshold = this._bloom.threshold;
      stage.bloom.radius = this._bloom.radius;
    }
    this.sanctum.dispose();
    this.sky.dispose();
    this.sea.dispose();
    this.continent.dispose();
    this.fall.dispose();
    if (stage.camera.view?.enabled) stage.camera.clearViewOffset();
    stage.camera.position.set(0, 0, 10);
    stage.camera.lookAt(0, 0, 0);
  }
}
