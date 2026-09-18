import * as THREE from 'three';

/**
 * 暮色海面 —— 全场景背景板。
 * 单张 shader 平面：薄暮渐变天空、地平线余光、微光粼动的海面。
 * uEnergy 接音频能量，海面粼光与地平线余光会随歌"呼吸"。
 */
export function createDuskSea() {
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uSky: { value: new THREE.Color(0x181832) },
    uDusk: { value: new THREE.Color(0x8b8fc7) },
    uGlow: { value: new THREE.Color(0xe8d9c0) },
    uSea: { value: new THREE.Color(0x10102a) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uEnergy;
      uniform vec3 uSky;
      uniform vec3 uDusk;
      uniform vec3 uGlow;
      uniform vec3 uSea;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }

      void main() {
        // 地平线略低于画面中心，给文字留呼吸空间
        float horizon = 0.42;
        vec3 col;

        if (vUv.y > horizon) {
          // 天空：深靛向地平线处的薄暮紫过渡
          float h = (vUv.y - horizon) / (1.0 - horizon);
          col = mix(uDusk * 0.6, uSky, pow(h, 0.5));
          // 地平线余光（随音乐微微起伏）
          float glow = exp(-h * (9.0 - uEnergy * 3.0));
          float centerFall = exp(-pow((vUv.x - 0.5) * 2.4, 2.0));
          col += uGlow * glow * centerFall * (0.2 + uEnergy * 0.4);
          // 高空微星
          float star = step(0.9985, hash(floor(vUv * 900.0))) * pow(h, 1.5);
          col += vec3(star) * (0.35 + 0.3 * sin(uTime * 1.7 + vUv.x * 40.0));
        } else {
          // 海面：镜像渐变 + 逐行粼光
          float d = (horizon - vUv.y) / horizon; // 0 地平线 → 1 画面底
          col = mix(uDusk * 0.38, uSea, pow(d, 0.45));
          float row = vUv.y * 240.0;
          float shimmer = noise(vec2(vUv.x * 60.0 + uTime * 0.8, row));
          shimmer = pow(shimmer, 7.0) * exp(-d * 5.0);
          float centerFall = exp(-pow((vUv.x - 0.5) * 2.0, 2.0));
          col += uGlow * shimmer * centerFall * (0.5 + uEnergy * 1.2);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(190, 80), mat);
  mesh.position.set(0, 0, -60);

  return {
    mesh,
    update(t, audio) {
      uniforms.uTime.value = t;
      const target = audio ? audio.level : 0;
      uniforms.uEnergy.value += (target - uniforms.uEnergy.value) * 0.06;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
