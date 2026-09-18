import * as THREE from 'three';
import { gsap } from 'gsap';

/**
 * 文字粒子 —— 把一段文字栅格化为粒子云。
 * assemble() 粒子从飘散状态聚合成字，scatter() 反向爆散消逝。
 * 供副歌级 kinetic typography cut 使用；调用前请确保字体已加载
 * （main.js 已 await document.fonts.ready）。
 */
export function createTextParticles(
  text,
  {
    font = '500 160px "Shippori Mincho", serif',
    worldHeight = 1.6,
    step = 3,
    color = 0xf0eefc,
  } = {}
) {
  // 栅格化
  const canvas = document.createElement('canvas');
  const ctx2d = canvas.getContext('2d');
  ctx2d.font = font;
  const metrics = ctx2d.measureText(text);
  const pad = 40;
  canvas.width = Math.ceil(metrics.width) + pad * 2;
  canvas.height = Math.ceil(
    (metrics.actualBoundingBoxAscent || 120) + (metrics.actualBoundingBoxDescent || 40)
  ) + pad * 2;
  ctx2d.font = font;
  ctx2d.fillStyle = '#fff';
  ctx2d.textBaseline = 'top';
  ctx2d.fillText(text, pad, pad);

  const img = ctx2d.getImageData(0, 0, canvas.width, canvas.height).data;
  const targets = [];
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      if (img[(y * canvas.width + x) * 4 + 3] > 128) {
        targets.push(x - canvas.width / 2, -(y - canvas.height / 2), 0);
      }
    }
  }

  const count = targets.length / 3;
  const scale = worldHeight / canvas.height;
  const position = new Float32Array(count * 3);
  const target = new Float32Array(count * 3);
  const rand = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    target[i * 3] = targets[i * 3] * scale;
    target[i * 3 + 1] = targets[i * 3 + 1] * scale;
    target[i * 3 + 2] = 0;
    // 初始飘散位置：目标附近的松散云
    position[i * 3] = target[i * 3] + (Math.random() - 0.5) * 6;
    position[i * 3 + 1] = target[i * 3 + 1] + (Math.random() - 0.5) * 4;
    position[i * 3 + 2] = (Math.random() - 0.5) * 3;
    rand[i * 3] = Math.random();
    rand[i * 3 + 1] = Math.random();
    rand[i * 3 + 2] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 3));

  const uniforms = {
    uMix: { value: 0 }, // 0 飘散 → 1 成字
    uTime: { value: 0 },
    uSize: { value: 2.2 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 1 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aTarget;
      attribute vec3 aRand;
      uniform float uMix;
      uniform float uTime;
      uniform float uSize;
      varying float vA;

      void main() {
        // 每颗粒子带相位差的聚合曲线，聚合像潮水而不是机械插值
        float m = clamp(uMix * (1.3 + aRand.x * 0.5) - aRand.y * 0.3, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        vec3 p = mix(position, aTarget, m);
        // 未聚合部分持续漂流
        float drift = (1.0 - m);
        p.x += sin(uTime * (0.6 + aRand.x) + aRand.y * 6.28) * 0.12 * drift;
        p.y += cos(uTime * (0.5 + aRand.y) + aRand.z * 6.28) * 0.10 * drift;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.6 + aRand.z * 0.8) * (10.0 / -mv.z);
        vA = 0.35 + m * 0.65;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = smoothstep(0.5, 0.1, length(c));
        gl_FragColor = vec4(uColor, d * vA * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);

  return {
    mesh: points,
    uniforms,
    count,
    assemble(dur = 2.2) {
      return gsap.to(uniforms.uMix, { value: 1, duration: dur, ease: 'power2.out' });
    },
    scatter(dur = 1.6) {
      return gsap.to(uniforms.uMix, { value: 0, duration: dur, ease: 'power2.in' });
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
