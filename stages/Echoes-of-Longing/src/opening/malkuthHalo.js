import * as THREE from 'three';
import { gsap } from 'gsap';

/**
 * Malkuth 光环 —— 对称正圆 + 中心一点（形态参考 docs/temp/Malkuth_Halo.png，
 * 低分段带来棱面感）。
 * 三维姿态：以「直视时是一条线段」的 edge-on 为基准，逆时针打开 OPEN_DEG；
 * 再于屏幕面内逆时针倾斜 TILT_DEG。
 * 轮廓显隐由 uArc 角向控制：自顶部起顺时针生长（入场），反向收回（退场）。
 */
const RADIUS = 2.05; // 光环做大（内容区覆盖其上，小屏允许重叠）
const TUBE = 0.042; // 保持细管径
const FACETS = 22; // 棱面数
const OPEN_DEG = 30; // 从线段姿态逆时针打开
const TILT_DEG = 30; // 屏幕面内逆时针倾斜
const COLOR = 0xf7eecb;
const TAU = Math.PI * 2;

export class MalkuthHalo {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uArc: { value: 0 },
      uColor: { value: new THREE.Color(COLOR) },
      uGlow: { value: 1 },
    };

    const ringMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uArc;
        uniform vec3 uColor;
        uniform float uGlow;
        varying vec3 vPos;
        const float TAU = 6.28318530718;
        void main() {
          float ang = atan(vPos.y, vPos.x);
          float fromTop = mod(1.5707963 - ang, TAU); // 顶部起、顺时针角距
          if (fromTop > uArc) discard;
          gl_FragColor = vec4(uColor * uGlow, 1.0);
        }
      `,
    });
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS, TUBE, 10, FACETS),
      ringMat
    );

    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 12),
      new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0 })
    );
    this.dot.scale.setScalar(0.001);

    const tilted = new THREE.Group();
    tilted.rotation.x = THREE.MathUtils.degToRad(90 - OPEN_DEG);
    tilted.add(this.ring);

    this.group = new THREE.Group();
    this.group.rotation.z = THREE.MathUtils.degToRad(TILT_DEG);
    this.group.add(tilted);
    this.group.add(this.dot);
    scene.add(this.group);

    this._idle = null;
  }

  /** 中心点浮现 */
  showDot(dur) {
    return gsap
      .timeline()
      .to(this.dot.material, { opacity: 1, duration: dur, ease: 'power2.out' }, 0)
      .to(this.dot.scale, { x: 1, y: 1, z: 1, duration: dur, ease: 'back.out(2.2)' }, 0);
  }

  /** 轮廓自顶部顺时针加速显现 */
  draw(dur) {
    return gsap.to(this.uniforms.uArc, { value: TAU, duration: dur, ease: 'power2.in' });
  }

  /** 退场：轮廓逆时针收回（入场的反向，减速） */
  undraw(dur) {
    this._idle?.kill();
    this._idle = null;
    return gsap.to(this.uniforms.uArc, { value: 0, duration: dur, ease: 'power2.out' });
  }

  hideDot(dur) {
    return gsap
      .timeline()
      .to(this.dot.material, { opacity: 0, duration: dur, ease: 'power2.in' }, 0)
      .to(this.dot.scale, { x: 0.001, y: 0.001, z: 0.001, duration: dur, ease: 'power2.in' }, 0);
  }

  /** 待机呼吸（等待点击期间） */
  breathe() {
    this._idle = gsap
      .timeline({ repeat: -1, yoyo: true })
      .to(this.group.scale, { x: 1.015, y: 1.015, z: 1.015, duration: 2.4, ease: 'sine.inOut' }, 0)
      .to(this.uniforms.uGlow, { value: 1.22, duration: 2.4, ease: 'sine.inOut' }, 0);
  }

  dispose() {
    this._idle?.kill();
    this.scene.remove(this.group);
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.dot.geometry.dispose();
    this.dot.material.dispose();
  }
}
