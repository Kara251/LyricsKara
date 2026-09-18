import * as THREE from 'three';

/**
 * 图像平面 —— 官方图 / 手写素材的 MAD 式处理管线。
 * 从 public/assets/img/ 加载任意图片，提供：
 *   uDissolve   噪声溶解 0(完整)→1(消失)
 *   uRGBShift   RGB 分离强度（闪切卡点用）
 *   uOpacity    整体透明度
 *   setParallax 视差偏移
 * 素材缺失时 resolve 为 null，cut 据此降级为纯代码视觉。
 */
export async function loadImagePlane(url, { height = 6 } = {}) {
  let texture;
  try {
    texture = await new THREE.TextureLoader().loadAsync(url);
  } catch {
    return null;
  }
  texture.colorSpace = THREE.SRGBColorSpace;

  const aspect = texture.image.width / texture.image.height;
  const uniforms = {
    uMap: { value: texture },
    uDissolve: { value: 0 },
    uRGBShift: { value: 0 },
    uOpacity: { value: 1 },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uDissolve;
      uniform float uRGBShift;
      uniform float uOpacity;
      uniform float uTime;
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
        vec2 off = vec2(uRGBShift, 0.0);
        vec4 col;
        col.r = texture2D(uMap, vUv + off).r;
        col.g = texture2D(uMap, vUv).g;
        col.b = texture2D(uMap, vUv - off).b;
        col.a = texture2D(uMap, vUv).a;

        // 噪声溶解：边缘泛起薄暮紫的光
        float n = noise(vUv * 7.0) * 0.75 + noise(vUv * 23.0) * 0.25;
        float edge = smoothstep(uDissolve - 0.08, uDissolve, n);
        float rim = smoothstep(uDissolve - 0.16, uDissolve - 0.08, n) - edge;
        col.rgb += vec3(0.55, 0.56, 0.78) * rim * 2.0;
        col.a *= edge * uOpacity;

        if (col.a < 0.003) discard;
        gl_FragColor = col;
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
  const home = new THREE.Vector3();

  return {
    mesh,
    uniforms,
    setHome(x, y, z) {
      home.set(x, y, z);
      mesh.position.copy(home);
    },
    setParallax(dx, dy) {
      mesh.position.set(home.x + dx, home.y + dy, home.z);
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      texture.dispose();
    },
  };
}
