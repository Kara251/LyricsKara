import * as THREE from 'three';

/**
 * 天空穹顶 —— 从上到下「蓝 → 白」的渐变天空（对应 MV 的晴空）。
 * uMix 0..1 控制从舞台暗色到天空的过渡，演出可随时间推拉。
 */
export class SkyDome {
  constructor(
    scene,
    { top = 0x3f83d6, bottom = 0xd3e6f8, down = 0x9dbcdc, dark = 0x0d0d1f } = {}
  ) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uDown: { value: new THREE.Color(down) },
      uDark: { value: new THREE.Color(dark) },
      uMix: { value: 0 },
    };
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(260, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying float vH;
          void main() {
            vH = normalize(position).y; // -1（正下）.. 1（正上）
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform vec3 uDown;
          uniform vec3 uDark;
          uniform float uMix;
          varying float vH;
          void main() {
            vec3 sky = mix(uBottom, uTop, smoothstep(-0.35, 0.6, vH));
            // 下半球压暗成雾蓝，俯视不再刺眼
            sky = mix(sky, uDown, smoothstep(-0.1, -0.75, vH));
            gl_FragColor = vec4(mix(uDark, sky, uMix), 1.0);
          }
        `,
      })
    );
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  set mix(v) {
    this.uniforms.uMix.value = v;
  }

  follow(camera) {
    this.mesh.position.copy(camera.position);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
