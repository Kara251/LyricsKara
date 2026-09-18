import * as THREE from 'three';

/**
 * 3D 海面 —— 前奏后段 / 主歌一的海平面舞台。
 * 水平大平面：风浪顶点位移（含「一阵阵」阵风细浪）+ 天空色菲涅尔反射，
 * 远处按相机距离融进天空色，地平线无缝。平面跟随相机 XZ 平移，海无边际。
 * uGust 由演出推入（0..1，阵风强度）；波形是世界坐标的纯函数，seek 安全。
 */
export class Sea {
  constructor(
    scene,
    { y = -70, size = 760, seg = 160, sky = 0xbcd8f2 } = {}
  ) {
    this.scene = scene;
    this.y = y;
    this.uniforms = {
      uTime: { value: 0 },
      uGust: { value: 0 },
      uOpacity: { value: 0 },
      uWind: { value: new THREE.Vector2(0.82, 0.57).normalize() },
      uDeep: { value: new THREE.Color(0x123049) },
      uShallow: { value: new THREE.Color(0x6ba7db) },
      uSky: { value: new THREE.Color(sky) },
      uFoam: { value: new THREE.Color(0xeaf5ff) },
      uSun: { value: new THREE.Vector3(0.3, 0.5, 0.6).normalize() },
      uCam: { value: new THREE.Vector3() },
      uFade: { value: 320 }, // 融入天空色的距离（远地平线）
    };

    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uGust;
        uniform vec2 uWind;
        uniform vec3 uCam;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;

        float wave(vec2 p, float t) {
          float d = dot(p, uWind);
          vec2 perp = vec2(-uWind.y, uWind.x);
          float a = 0.0;
          a += sin(d * 0.032 - t * 0.55) * 0.44;
          a += sin(d * 0.083 + t * 0.82) * 0.20;
          a += sin(dot(p, perp) * 0.065 + t * 0.42) * 0.14;
          // 阵风只带出细微皱褶，风痕主要交给 fragment 做可视化。
          a += sin(d * 0.21 - t * 1.7) * 0.08 * uGust;
          a += sin(dot(p, perp) * 0.29 - t * 2.1) * 0.045 * uGust;
          return a;
        }

        void main() {
          vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
          vec2 p = world.xz;
          float e = 1.6;
          float h = wave(p, uTime);
          float hx = wave(p + vec2(e, 0.0), uTime);
          float hz = wave(p + vec2(0.0, e), uTime);
          world.y += h;
          vec3 nrm = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));

          vWorld = world;
          vNormal = nrm;
          vCrest = smoothstep(0.34, 0.78, h);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uGust;
        uniform vec2 uWind;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSky;
        uniform vec3 uFoam;
        uniform vec3 uSun;
        uniform vec3 uCam;
        uniform float uOpacity;
        uniform float uFade;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vCrest;

        void main() {
          vec3 view = normalize(uCam - vWorld);
          float fres = pow(1.0 - max(dot(view, vNormal), 0.0), 3.2);
          vec3 col = mix(uDeep, uShallow, clamp(vNormal.y * 0.5 + 0.3, 0.0, 1.0));
          col = mix(col, uSky, clamp(fres * 0.9, 0.0, 1.0));
          // 阳光高光
          vec3 h = normalize(view + uSun);
          float spec = pow(max(dot(vNormal, h), 0.0), 90.0);
          col += vec3(1.0, 0.97, 0.9) * spec * 0.7;
          // 浪尖泡沫
          col = mix(col, uFoam, vCrest * 0.5);
          // 风痕：沿风向拉长、断续出现的浅色细纹，表达风吹过而不是大浪抬升。
          vec2 perp = vec2(-uWind.y, uWind.x);
          float along = dot(vWorld.xz, uWind);
          float across = dot(vWorld.xz, perp);
          float lane = 0.5 + 0.5 * sin(across * 0.22 + sin(along * 0.018 - uTime * 0.35) * 1.6);
          float train = 0.5 + 0.5 * sin(along * 0.09 - uTime * 1.15);
          float windTrace = smoothstep(0.80, 0.98, lane) * smoothstep(0.58, 0.96, train) * uGust;
          col = mix(col, uFoam, windTrace * 0.16);
          col += vec3(0.018, 0.035, 0.05) * windTrace;
          // 远处融进天空，地平线无缝
          float dist = length(uCam.xz - vWorld.xz);
          float horizon = smoothstep(uFade * 0.35, uFade, dist);
          col = mix(col, uSky, horizon);
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = y;
    this.mesh.renderOrder = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  set opacity(v) {
    this.uniforms.uOpacity.value = v;
  }

  /** 世界坐标某点当前波高（坠物入水判定用，与 shader 主浪一致的低频近似） */
  heightAt(x, z, t) {
    const w = this.uniforms.uWind.value;
    const d = x * w.x + z * w.y;
    const px = -w.y * x + w.x * z;
    return (
      Math.sin(d * 0.032 - t * 0.55) * 0.44 +
      Math.sin(d * 0.083 + t * 0.82) * 0.20 +
      Math.sin(px * 0.065 + t * 0.42) * 0.14
    );
  }

  update(t, camPos, gust = 0) {
    this.uniforms.uTime.value = t;
    this.uniforms.uGust.value = gust;
    this.uniforms.uCam.value.copy(camPos);
    // 跟随相机，海面无边
    this.mesh.position.x = camPos.x;
    this.mesh.position.z = camPos.z;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
