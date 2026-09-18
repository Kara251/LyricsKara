import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * 终幕后期：胶片颗粒 + 暗角 + 径向色差。
 * 静止系MAD 的"胶片感"底色，参数可被 cut 实时调整
 * （stage.grain.uniforms.uGrain / uVignette / uAberration）。
 */
export function createGrainPass() {
  return new ShaderPass({
    name: 'FilmGrainPass',
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uGrain: { value: 0.055 },
      uVignette: { value: 0.34 },
      uAberration: { value: 0.0014 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uAberration;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float r2 = dot(centered, centered);

        // 径向色差
        vec2 dir = centered * r2 * uAberration * 14.0;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + dir).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - dir).b;

        // 胶片颗粒（逐帧变化）
        float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5;
        col += g * uGrain;

        // 暗角
        col *= 1.0 - r2 * uVignette * 2.2;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
