import * as THREE from 'three';

/**
 * 钢铁大陆（可变化大陆）—— Decagrammaton 的大陆本体，正在沉没于海。
 *
 * 中心在宫殿正下方（世界原点 XZ），占地约为宫殿的三倍（半径 ≈ √3×）。
 * 算法生成：圆盘上分区铺设高低不一的钢铁台块 + 顶面低密度结构（符合原著
 * 「可变化大陆」的不规则体素质感）。中心偏高、边缘低伏成滩，读作一块
 * 缓缓没入水面的大陆。整块随时间下沉（cut 驱动 group.position.y）。
 * InstancedMesh，形态由种子决定；下沉是连续位移，seek 安全。
 */
const TOP = 0xdfe9f4;
const FACE = 0xc7d6e5;
const SIDE = 0xaebfd0;
const WET = 0x7f93a8; // 近水线的湿冷色
const PANEL = 0x5f7183;

export class Continent {
  constructor(
    scene,
    { center = new THREE.Vector3(0, -70, 0), radius = 95, seed = 20260707, rings = 22 } = {}
  ) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(center);

    let s = seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const signed = () => rnd() * 2 - 1;

    const mats = new THREE.Vector3();
    const boxes = [];
    const colors = [];
    const color = new THREE.Color();
    const push = (x, y, z, sx, sy, sz, hex, jitter = 0.05) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        mats.set(sx, sy, sz)
      );
      boxes.push(m.clone());
      color.setHex(hex);
      if (hex !== PANEL) color.offsetHSL(0, 0, signed() * jitter);
      colors.push(color.clone());
    };

    // 大陆剖面：中心高、边缘低（岛形），顶面在 0 上下、随半径下沉成滩。
    const profile = (r) => {
      const t = r / radius; // 0 中心 → 1 边缘
      return 7.5 * (1 - t * t) - t * 3.2; // 中心 +7.5，边缘 -3.2
    };

    for (let ri = 0; ri < rings; ri++) {
      const r0 = (ri / rings) * radius;
      const r1 = ((ri + 1) / rings) * radius;
      const rMid = (r0 + r1) * 0.5;
      const t = rMid / radius;
      const circumference = Math.PI * 2 * Math.max(rMid, 3);
      const cells = Math.max(5, Math.round(circumference / 9.2));
      const top = profile(rMid);

      for (let ci = 0; ci < cells; ci++) {
        const ang = (ci / cells) * Math.PI * 2 + signed() * 0.05;
        const district = 0.5 + 0.5 * Math.sin(ang * 5.0 + Math.sin(rMid * 0.06) * 2.3);
        const radialGap = Math.abs(Math.sin(ang * 6.0 + rMid * 0.035)) < 0.09 + t * 0.035;
        const beltGap = Math.abs(Math.sin(rMid * 0.24 + Math.sin(ang * 3.0) * 1.1)) < 0.07;
        const edgeBreak = ri > 2 && rnd() < 0.16 + t * 0.32;
        if (district < 0.16 || radialGap || beltGap || edgeBreak) continue;

        const rr = rMid + signed() * (r1 - r0) * 0.35;
        const x = Math.cos(ang) * rr;
        const z = Math.sin(ang) * rr;

        const plotW = (r1 - r0) * (1.05 + rnd() * 1.05);
        const plotD = plotW * (0.7 + rnd() * 0.7);
        const th = 5.5 + rnd() * 9; // 台块厚度（向下延伸）
        const topY = top + signed() * 1.6;

        const near = rnd() < 0.32;
        push(x, topY - th * 0.5, z, plotW, th, plotD, near ? WET : rnd() < 0.6 ? FACE : SIDE, 0.06);

        // 顶面台阶
        if (rnd() < 0.42) {
          const sw = plotW * (0.34 + rnd() * 0.34);
          const sd = plotD * (0.34 + rnd() * 0.34);
          const sh = 0.8 + rnd() * 2.4;
          push(
            x + signed() * plotW * 0.2,
            topY + sh * 0.5,
            z + signed() * plotD * 0.2,
            sw,
            sh,
            sd,
            rnd() < 0.7 ? TOP : FACE,
            0.05
          );
        }

        // 顶面结构：敦实的分级楼块 / 屋顶机械面 / 低矮机库（无细针天线）
        const core = rMid < radius * 0.48;
        const detail = rnd() < (core ? 0.58 : 0.26) ? 1 + (core && rnd() < 0.22 ? 1 : 0) : 0;
        for (let d = 0; d < detail; d++) {
          const kind = rnd();
          const lx = x + signed() * plotW * 0.35;
          const lz = z + signed() * plotD * 0.35;
          if (kind < 0.5) {
            // 塔楼：宽而分级，不是细针
            const tw = 1.6 + rnd() * 2.8;
            const td = tw * (0.7 + rnd() * 0.5);
            const tht = 2 + rnd() * 5;
            push(lx, topY + tht * 0.5, lz, tw, tht, td, rnd() < 0.7 ? TOP : FACE, 0.05);
            if (rnd() < 0.6) {
              push(lx, topY + tht + 0.5, lz, tw * 0.6, 0.9 + rnd() * 1.6, td * 0.6, rnd() < 0.6 ? FACE : SIDE, 0.05);
            }
          } else if (kind < 0.78) {
            // 屋顶机械面 / 平嵌板
            push(lx, topY + 0.35, lz, 1.0 + rnd() * 2.0, 0.4 + rnd() * 0.4, 1.0 + rnd() * 2.0, rnd() < 0.5 ? PANEL : SIDE, 0.04);
          } else {
            // 低矮机库块
            const bw = 1.4 + rnd() * 3.0;
            push(lx, topY + 0.9, lz, bw, 1.2 + rnd() * 1.8, bw * (0.6 + rnd() * 0.6), rnd() < 0.6 ? FACE : SIDE, 0.05);
          }
        }
      }
    }

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 0 });
    this.mesh = new THREE.InstancedMesh(box, this.mat, boxes.length);
    boxes.forEach((m, i) => this.mesh.setMatrixAt(i, m));
    colors.forEach((c, i) => this.mesh.setColorAt(i, c));
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    scene.add(this.group);

    this._box = box;
    this._baseY = center.y;
  }

  set opacity(v) {
    this.mat.opacity = v;
  }

  /** 下沉：相对基准下沉 depth 个单位（正数向下） */
  setSubmersion(depth) {
    this.group.position.y = this._baseY - depth;
  }

  dispose() {
    this.scene.remove(this.group);
    this.mesh.dispose();
    this._box.dispose();
    this.mat.dispose();
  }
}
