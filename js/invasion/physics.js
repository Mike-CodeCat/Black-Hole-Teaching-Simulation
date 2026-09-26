/*
 * 黑洞入侵太阳系 —— 物理引擎
 * ------------------------------------------------------------
 * 单位：长度 AU，时间 年（儒略年），质量 太阳质量 M☉ → G = 4π²
 * - 太阳、八大行星、月球、黑洞：完整的 N 体引力（所有天体两两相互吸引），
 *   4 阶辛积分器（Yoshida 1990），自适应步长 Δt = η·min √(r³/G(mᵢ+mⱼ))
 * - 行星初始位置：JPL（Standish）J2000 平均轨道根数 + 平运动外推到当前日期
 * - 黑洞：相对太阳的双曲线轨道（给定 v∞、近心距 q、轨道倾角等）
 * - 潮汐瓦解：天体进入潮汐半径 r_t = R (M_BH/m)^(1/3) 即解体为 N 个碎片；
 *   碎片为有质量的粒子（“冻结近似”：忽略碎片间自引力与流体压力），
 *   受黑洞与太阳引力，并反过来吸引行星与黑洞（动量守恒）
 * - 吸积：束缚碎片回到近心点即视为环化进入吸积盘，吸积率由碎片回落率决定，
 *   光度 L = η Ṁ c²，超过爱丁顿光度时按 L = L_Edd [1 + ln(Ṁ/Ṁ_Edd)] 饱和
 */
(function () {
  'use strict';
  const G = 4 * Math.PI * Math.PI;
  const AU_KM = 1.495978707e8;
  const YR_S = 3.15576e7;
  const KMS = AU_KM / YR_S; // 1 AU/yr = 4.74 km/s
  const C = 299792.458 / KMS; // 光速（AU/yr）
  const MSUN_KG = 1.989e30;
  const LSUN_W = 3.828e26;
  const km = (x) => x / AU_KM;

  // JPL 近似轨道根数（J2000，黄道坐标）：a, e, I, L, ϖ, Ω（度），L 的变化率（度/世纪）
  const PLANETS = [
    { name: '水星', key: 'mercury', a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.2503235, w: 77.45779628, O: 48.33076593, Ld: 149472.67411175, m: 1.6601e-7, R: km(2439.7), col: [0.72, 0.7, 0.68] },
    { name: '金星', key: 'venus', a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.9790995, w: 131.60246718, O: 76.67984255, Ld: 58517.81538729, m: 2.4478e-6, R: km(6051.8), col: [1, 0.85, 0.55] },
    { name: '地球', key: 'earth', a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, w: 102.93768193, O: 0, Ld: 35999.37244981, m: 3.0035e-6, R: km(6371), col: [0.35, 0.65, 1] },
    { name: '火星', key: 'mars', a: 1.52371034, e: 0.0933941, I: 1.84969142, L: -4.55343205, w: -23.94362959, O: 49.55953891, Ld: 19140.30268499, m: 3.2272e-7, R: km(3389.5), col: [1, 0.5, 0.3] },
    { name: '木星', key: 'jupiter', a: 5.202887, e: 0.04838624, I: 1.30439695, L: 34.39644051, w: 14.72847983, O: 100.47390909, Ld: 3034.74612775, m: 9.5479e-4, R: km(69911), col: [0.95, 0.8, 0.6] },
    { name: '土星', key: 'saturn', a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, w: 92.59887831, O: 113.66242448, Ld: 1222.49362201, m: 2.8589e-4, R: km(58232), col: [0.95, 0.88, 0.65] },
    { name: '天王星', key: 'uranus', a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, w: 170.9542763, O: 74.01692503, Ld: 428.48202785, m: 4.3662e-5, R: km(25362), col: [0.6, 0.9, 0.95] },
    { name: '海王星', key: 'neptune', a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, w: 44.96476227, O: 131.78422574, Ld: 218.45945325, m: 5.1514e-5, R: km(24622), col: [0.35, 0.5, 1] },
  ];
  const SUN = { name: '太阳', key: 'sun', m: 1, R: km(695700), col: [1, 0.85, 0.5] };
  const MOON = { name: '月球', key: 'moon', m: 3.694e-8, R: km(1737.4), col: [0.8, 0.8, 0.8] };

  const rad = (d) => (d * Math.PI) / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.sqrt(dot(a, a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  /** 轨道平面 → 黄道坐标（按 ω, I, Ω 旋转） */
  function rotate(v, w, I, O) {
    const cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(I), si = Math.sin(I), cO = Math.cos(O), sO = Math.sin(O);
    const x1 = cw * v[0] - sw * v[1], y1 = sw * v[0] + cw * v[1], z1 = v[2];
    const x2 = x1, y2 = ci * y1 - si * z1, z2 = si * y1 + ci * z1;
    return [cO * x2 - sO * y2, sO * x2 + cO * y2, z2];
  }
  /** 椭圆轨道根数 → 位置、速度 */
  function ellipticState(a, e, I, O, w, M, mu) {
    let E = M;
    for (let k = 0; k < 50; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const cE = Math.cos(E), sE = Math.sin(E);
    const r = a * (1 - e * cE);
    const pos = [a * (cE - e), a * Math.sqrt(1 - e * e) * sE, 0];
    const k = Math.sqrt(mu * a) / r;
    const vel = [-k * sE, k * Math.sqrt(1 - e * e) * cE, 0];
    return { pos: rotate(pos, w, I, O), vel: rotate(vel, w, I, O), r };
  }
  /** 双曲线轨道：给定近心距 q、v∞，从距离 r0 处入射 */
  function hyperbolicState(q, vinf, I, O, w, r0, mu) {
    const e = 1 + (q * vinf * vinf) / mu;
    const p = q * (1 + e);
    const cf = U2.clamp((p / r0 - 1) / e, -1, 1);
    const f = -Math.acos(cf);
    const r = p / (1 + e * Math.cos(f));
    const pos = [r * Math.cos(f), r * Math.sin(f), 0];
    const k = Math.sqrt(mu / p);
    const vel = [-k * Math.sin(f), k * (e + Math.cos(f)), 0];
    // 到近心点的时间
    const a = -mu / (vinf * vinf);
    const coshH = (e + Math.cos(f)) / (1 + e * Math.cos(f));
    const H = -Math.acosh(Math.max(1, coshH));
    const Mh = e * Math.sinh(H) - H;
    const n = Math.sqrt(mu / Math.pow(-a, 3));
    return { pos: rotate(pos, w, I, O), vel: rotate(vel, w, I, O), e, tPeri: -Mh / n };
  }
  const U2 = { clamp: (x, a, b) => Math.max(a, Math.min(b, x)) };

  /** 行星在 J2000 起算 T 世纪时的日心位置、速度（二体开普勒运动） */
  function planetState(p, T) {
    const L = p.L + p.Ld * T;
    const M = rad(((L - p.w) % 360 + 540) % 360 - 180);
    return ellipticState(p.a, p.e, rad(p.I), rad(p.O), rad(p.w - p.O), M, G * (1 + p.m));
  }

  /**
   * 瞄准：调整黑洞轨道朝向，使其（在完整引力相互作用下）以约 target AU 的最近距离掠过天体 key。
   * 先用开普勒运动预测该天体在黑洞过近心点时的位置作为初值，再用精简 N 体模拟做一维搜索修正。
   */
  function aim(base, key, target) {
    const o = Object.assign({}, base);
    const date = o.date || new Date();
    const probe = new Sim(Object.assign({}, o, { q: o.q || 1, lite: true, liteKeep: key }));
    if (key === 'sun') return o;
    const p = PLANETS.find((x) => x.key === key);
    const T = (jd(date) - 2451545.0) / 36525;
    let tp = probe.hyper.tPeri, st;
    for (let it = 0; it < 3; it++) { // q 改变会改变到达时间，迭代几次
      st = planetState(p, T + tp / 100);
      o.q = len(st.pos) + target;
      tp = new Sim(Object.assign({}, o, { lite: true, liteKeep: key })).hyper.tPeri;
    }
    const lam = (Math.atan2(st.pos[1], st.pos[0]) * 180) / Math.PI;
    o.argp = 0;
    const run = (d) => {
      const sim = new Sim(Object.assign({}, o, { node: lam + d, lite: true, liteKeep: key }));
      const tEnd = sim.hyper.tPeri + 0.15;
      while (sim.t < tEnd && sim.alive[sim.idx[key]]) sim.advance(tEnd - sim.t, 5000);
      const md = sim.minDist[key];
      return md || { d: 1e9, t: 0 };
    };
    const score = (d) => Math.abs(Math.log(run(d).d / target));
    let best = 0, bs = score(0);
    for (let d = -24; d <= 24; d += 3) { const sc = score(d); if (sc < bs) { bs = sc; best = d; } }
    for (let step = 1; step >= 0.05; step /= 3) {
      for (const d of [best - 2 * step, best - step, best + step, best + 2 * step]) { const sc = score(d); if (sc < bs) { bs = sc; best = d; } }
    }
    o.node = lam + best;
    const res = run(best);
    o.aimResult = res.d;
    o.aimTime = res.t; // 预计与该天体最近接近的时刻（年）
    return o;
  }

  /** 日期 → 儒略日 */
  const jd = (date) => date.getTime() / 86400000 + 2440587.5;

  class Sim {
    /**
     * @param {object} o  {Mbh, vinf(km/s), q(AU), inc(度), node(度), argp(度), r0(AU), date, nDebris}
     */
    constructor(o) {
      this.o = o;
      this.t = 0; // 年
      this.steps = 0;
      this.events = [];
      this.nDebris = o.nDebris || 1500;
      this.eta = o.eta || 0.015;
      const date = o.date || new Date();
      this.date0 = date;
      const T = (jd(date) - 2451545.0) / 36525;
      const bodies = [];
      bodies.push(Object.assign({}, SUN, { type: 'sun', pos: [0, 0, 0], vel: [0, 0, 0] }));
      const keep = o.lite ? new Set(['earth', 'jupiter', o.liteKeep]) : null;
      for (const p of PLANETS) {
        if (keep && !keep.has(p.key)) continue;
        const st = planetState(p, T);
        bodies.push(Object.assign({}, p, { type: 'planet', pos: st.pos, vel: st.vel }));
      }
      // 月球：由月相（朔望月）近似给出其相对地球的方向
      const earth = bodies.find((b) => b.key === 'earth');
      const elong = rad(360 * (((jd(date) - 2451550.26) / 29.530588) % 1));
      const sunGeo = Math.atan2(-earth.pos[1], -earth.pos[0]);
      const lm = sunGeo + elong;
      const dm = km(384400), muEM = G * (earth.m + MOON.m);
      const vm = Math.sqrt(muEM / dm);
      const incM = rad(5.145);
      const mp = [dm * Math.cos(lm), dm * Math.sin(lm) * Math.cos(incM), dm * Math.sin(lm) * Math.sin(incM)];
      const mv = [-vm * Math.sin(lm), vm * Math.cos(lm) * Math.cos(incM), vm * Math.cos(lm) * Math.sin(incM)];
      if (!o.lite) bodies.push(Object.assign({}, MOON, { type: 'moon', pos: add(earth.pos, mp), vel: add(earth.vel, mv) }));
      // 让太阳系质心静止
      let P = [0, 0, 0], Mt = 0, X = [0, 0, 0];
      for (const b of bodies) { P = add(P, mul(b.vel, b.m)); X = add(X, mul(b.pos, b.m)); Mt += b.m; }
      for (const b of bodies) { b.vel = sub(b.vel, mul(P, 1 / Mt)); b.pos = sub(b.pos, mul(X, 1 / Mt)); }
      // 黑洞
      const sun = bodies[0];
      const mu = G * (1 + o.Mbh);
      const vinf = o.vinf / KMS;
      const r0 = o.r0 || Math.max(40, 6 * o.q);
      const h = hyperbolicState(o.q, vinf, rad(o.inc), rad(o.node), rad(o.argp), r0, mu);
      this.hyper = { e: h.e, tPeri: h.tPeri, vPeri: Math.sqrt(vinf * vinf + (2 * mu) / o.q) * KMS, r0 };
      bodies.push({ name: '黑洞', key: 'bh', type: 'bh', m: o.Mbh, R: (2 * G * o.Mbh) / (C * C), pos: add(sun.pos, h.pos), vel: add(sun.vel, h.vel), col: [1, 0.6, 0.3] });
      for (const b of bodies) { b.alive = true; b.status = 'normal'; }
      this.bodies = bodies;
      this.idx = {};
      bodies.forEach((b, i) => (this.idx[b.key] = i));
      this.N = bodies.length;
      // 打平到类型化数组以提高速度
      this.x = new Float64Array(3 * this.N);
      this.v = new Float64Array(3 * this.N);
      this.a = new Float64Array(3 * this.N);
      this.m = new Float64Array(this.N);
      this.alive = new Uint8Array(this.N);
      bodies.forEach((b, i) => { this.x.set(b.pos, 3 * i); this.v.set(b.vel, 3 * i); this.m[i] = b.m; this.alive[i] = 1; });
      // 碎片
      this.dN = 0;
      this.dx = new Float64Array(3 * 4000);
      this.dv = new Float64Array(3 * 4000);
      this.dm = new Float64Array(4000);
      this.dState = new Uint8Array(4000); // 0 空, 1 自由, 2 已环化进入吸积盘
      this.dSrc = new Uint8Array(4000); // 碎片来源天体索引
      this.dPrevVr = new Float64Array(4000);
      this.dPassed = new Uint8Array(4000);
      this.dBorn = new Float64Array(4000);
      this.diskMass = 0; // 吸积盘储量（M☉）
      this.accreted = 0; // 已被黑洞吞下的质量
      this.mdot = 0; // M☉/yr
      this.Lacc = 0; // 光度（L☉）
      this.rAccrete = Math.max(1e-4, 50 * this.bodies[this.idx.bh].R);
      this.E0 = this.energy();
      this.P0 = this.momentum();
      this.minDist = {}; // 黑洞与各天体的最近距离
      this.tidalR = {};
      for (const b of bodies) if (b.type !== 'bh') this.tidalR[b.key] = b.R * Math.cbrt(o.Mbh / b.m);
    }

    pos(i) { return [this.x[3 * i], this.x[3 * i + 1], this.x[3 * i + 2]]; }
    vel(i) { return [this.v[3 * i], this.v[3 * i + 1], this.v[3 * i + 2]]; }
    get bh() { return this.idx.bh; }

    /** 仅对大质量天体（含碎片对它们的引力）计算加速度 */
    accel(x, out, ext) {
      const N = this.N, m = this.m, al = this.alive;
      out.fill(0);
      for (let i = 0; i < N; i++) {
        if (!al[i]) continue;
        for (let j = i + 1; j < N; j++) {
          if (!al[j]) continue;
          const dx = x[3 * j] - x[3 * i], dy = x[3 * j + 1] - x[3 * i + 1], dz = x[3 * j + 2] - x[3 * i + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          const inv = G / (r2 * Math.sqrt(r2));
          const fi = inv * m[j], fj = inv * m[i];
          out[3 * i] += fi * dx; out[3 * i + 1] += fi * dy; out[3 * i + 2] += fi * dz;
          out[3 * j] -= fj * dx; out[3 * j + 1] -= fj * dy; out[3 * j + 2] -= fj * dz;
        }
      }
      if (ext) for (let k = 0; k < 3 * N; k++) out[k] += ext[k];
    }

    /** 碎片对大质量天体的引力（每个全局步计算一次，软化长度 0.001 AU） */
    debrisExt() {
      if (!this.dN) return null;
      const N = this.N, ext = new Float64Array(3 * N);
      const eps2 = 1e-6;
      for (let k = 0; k < this.dN; k++) {
        if (this.dState[k] !== 1) continue;
        const mk = this.dm[k];
        for (let i = 0; i < N; i++) {
          if (!this.alive[i] || i === this.bh || i === this.idx.sun) continue;
          const dx = this.dx[3 * k] - this.x[3 * i], dy = this.dx[3 * k + 1] - this.x[3 * i + 1], dz = this.dx[3 * k + 2] - this.x[3 * i + 2];
          const r2 = dx * dx + dy * dy + dz * dz + eps2;
          const f = (G * mk) / (r2 * Math.sqrt(r2));
          ext[3 * i] += f * dx; ext[3 * i + 1] += f * dy; ext[3 * i + 2] += f * dz;
        }
      }
      return ext; // 黑洞、太阳与碎片的相互作用在 stepDebris 中以严格等大反向的冲量处理

    }

    /** 自适应步长 */
    timestep() {
      const N = this.N, x = this.x, v = this.v, m = this.m, al = this.alive;
      let dt = 0.05;
      for (let i = 0; i < N; i++) {
        if (!al[i]) continue;
        for (let j = i + 1; j < N; j++) {
          if (!al[j]) continue;
          const dx = x[3 * j] - x[3 * i], dy = x[3 * j + 1] - x[3 * i + 1], dz = x[3 * j + 2] - x[3 * i + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          const r = Math.sqrt(r2);
          const tdyn = Math.sqrt((r2 * r) / (G * (m[i] + m[j])));
          const dvx = v[3 * j] - v[3 * i], dvy = v[3 * j + 1] - v[3 * i + 1], dvz = v[3 * j + 2] - v[3 * i + 2];
          const tcross = r / (Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz) + 1e-12);
          const t = Math.min(tdyn, tcross);
          if (t < dt) dt = t;
        }
      }
      return this.eta * dt;
    }

    /** Yoshida 四阶辛积分一步 */
    yoshida(dt, ext) {
      const w1 = 1 / (2 - Math.cbrt(2)), w0 = -Math.cbrt(2) * w1;
      const cs = [w1 / 2, (w0 + w1) / 2, (w0 + w1) / 2, w1 / 2], ds = [w1, w0, w1];
      const x = this.x, v = this.v, a = this.a, n3 = 3 * this.N;
      for (let s = 0; s < 4; s++) {
        const c = cs[s] * dt;
        for (let k = 0; k < n3; k++) x[k] += c * v[k];
        if (s < 3) {
          this.accel(x, a, ext);
          const d = ds[s] * dt;
          for (let k = 0; k < n3; k++) v[k] += d * a[k];
        }
      }
    }

    /** 碎片积分：受黑洞与太阳引力（位置在全局步内线性插值），各自自适应子步 */
    stepDebris(dt, x0, x1, budget) {
      if (!this.dN) return;
      const ib = this.bh, is = this.idx.sun;
      const Mb = this.m[ib], Ms = this.alive[is] ? this.m[is] : 0;
      const bh0 = [x0[3 * ib], x0[3 * ib + 1], x0[3 * ib + 2]], bh1 = [x1[3 * ib], x1[3 * ib + 1], x1[3 * ib + 2]];
      const s0 = [x0[3 * is], x0[3 * is + 1], x0[3 * is + 2]], s1 = [x1[3 * is], x1[3 * is + 1], x1[3 * is + 2]];
      const vb = [(bh1[0] - bh0[0]) / dt, (bh1[1] - bh0[1]) / dt, (bh1[2] - bh0[2]) / dt];
      const racc = this.rAccrete;
      let Jb0 = 0, Jb1 = 0, Jb2 = 0, Js0 = 0, Js1 = 0, Js2 = 0; // 碎片对黑洞 / 太阳的反作用冲量
      for (let k = 0; k < this.dN; k++) {
        if (this.dState[k] !== 1) continue;
        let px = this.dx[3 * k], py = this.dx[3 * k + 1], pz = this.dx[3 * k + 2];
        let qx = this.dv[3 * k], qy = this.dv[3 * k + 1], qz = this.dv[3 * k + 2];
        let tt = 0, n = 0;
        const acc = (tau) => {
          const f = tau / dt;
          const bx = bh0[0] + (bh1[0] - bh0[0]) * f, by = bh0[1] + (bh1[1] - bh0[1]) * f, bz = bh0[2] + (bh1[2] - bh0[2]) * f;
          let dx = bx - px, dy = by - py, dz = bz - pz;
          let r2 = dx * dx + dy * dy + dz * dz;
          let k1 = (G * Mb) / (r2 * Math.sqrt(r2));
          let ax = k1 * dx, ay = k1 * dy, az = k1 * dz;
          const rb = Math.sqrt(r2);
          if (Ms) {
            const sx = s0[0] + (s1[0] - s0[0]) * f - px, sy = s0[1] + (s1[1] - s0[1]) * f - py, sz = s0[2] + (s1[2] - s0[2]) * f - pz;
            const s2 = sx * sx + sy * sy + sz * sz + 1e-10;
            const k2 = (G * Ms) / (s2 * Math.sqrt(s2));
            ax += k2 * sx; ay += k2 * sy; az += k2 * sz;
          }
          return [ax, ay, az, rb, k1 * dx, k1 * dy, k1 * dz];
        };
        const mk = this.dm[k];
        while (tt < dt && n < budget) {
          let [ax, ay, az, rb, bx, by, bz] = acc(tt);
          const sp = Math.sqrt((qx - vb[0]) ** 2 + (qy - vb[1]) ** 2 + (qz - vb[2]) ** 2) + 1e-9;
          const h = Math.min(dt - tt, 0.02 * Math.sqrt((rb * rb * rb) / (G * Mb)), 0.03 * rb / sp) + 1e-14;
          qx += 0.5 * h * ax; qy += 0.5 * h * ay; qz += 0.5 * h * az;
          Jb0 -= 0.5 * h * mk * bx; Jb1 -= 0.5 * h * mk * by; Jb2 -= 0.5 * h * mk * bz;
          Js0 -= 0.5 * h * mk * (ax - bx); Js1 -= 0.5 * h * mk * (ay - by); Js2 -= 0.5 * h * mk * (az - bz);
          px += h * qx; py += h * qy; pz += h * qz;
          [ax, ay, az, rb, bx, by, bz] = acc(tt + h);
          qx += 0.5 * h * ax; qy += 0.5 * h * ay; qz += 0.5 * h * az;
          Jb0 -= 0.5 * h * mk * bx; Jb1 -= 0.5 * h * mk * by; Jb2 -= 0.5 * h * mk * bz;
          Js0 -= 0.5 * h * mk * (ax - bx); Js1 -= 0.5 * h * mk * (ay - by); Js2 -= 0.5 * h * mk * (az - bz);
          tt += h; n++;
        }
        if (tt < dt) { // 极端情况下（几乎径直冲向黑洞）超出预算：视为落入黑洞
          this.dState[k] = 2; this.diskMass += this.dm[k];
          const mb = this.m[ib], mk2 = this.dm[k];
          for (let c = 0; c < 3; c++) this.v[3 * ib + c] = (mb * this.v[3 * ib + c] + mk2 * qx * (c === 0) + mk2 * qy * (c === 1) + mk2 * qz * (c === 2)) / (mb + mk2);
          this.m[ib] = mb + mk2;
          continue;
        }
        this.dx[3 * k] = px; this.dx[3 * k + 1] = py; this.dx[3 * k + 2] = pz;
        this.dv[3 * k] = qx; this.dv[3 * k + 1] = qy; this.dv[3 * k + 2] = qz;
        // 相对黑洞的径向速度：由负变正 = 经过近心点
        const rx = px - bh1[0], ry = py - bh1[1], rz = pz - bh1[2];
        const ux = qx - vb[0], uy = qy - vb[1], uz = qz - vb[2];
        const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const vr = (rx * ux + ry * uy + rz * uz) / r;
        const eps = 0.5 * (ux * ux + uy * uy + uz * uz) - (G * Mb) / r;
        if (r < racc || (this.dPassed[k] && this.dPrevVr[k] < 0 && vr >= 0 && eps < 0)) {
          // 回落到近心点：与吸积流碰撞、环化，进入吸积盘
          // 盘与黑洞一起运动：质量与动量立即并入黑洞（保证动量守恒），
          // diskMass 只用于按粘滞时标计算吸积率与光度
          this.dState[k] = 2;
          this.diskMass += this.dm[k];
          const mb = this.m[ib], mk = this.dm[k];
          for (let c = 0; c < 3; c++) this.v[3 * ib + c] = (mb * this.v[3 * ib + c] + mk * this.dv[3 * k + c]) / (mb + mk);
          this.m[ib] = mb + mk;
        } else if (this.dPrevVr[k] > 0 && vr > 0 && r > 2 * racc) {
          this.dPassed[k] = 1; // 已离开首次近心点
        }
        this.dPrevVr[k] = vr;
      }
      // 施加反作用冲量（动量严格守恒）
      this.v[3 * ib] += Jb0 / this.m[ib]; this.v[3 * ib + 1] += Jb1 / this.m[ib]; this.v[3 * ib + 2] += Jb2 / this.m[ib];
      if (Ms) { this.v[3 * is] += Js0 / Ms; this.v[3 * is + 1] += Js1 / Ms; this.v[3 * is + 2] += Js2 / Ms; }
    }

    /** 碎片离黑洞最近处的动力学时标，用于限制全局步长 */
    debrisTimestep() {
      const ib = this.bh, bx = this.x[3 * ib], by = this.x[3 * ib + 1], bz = this.x[3 * ib + 2];
      const vx = this.v[3 * ib], vy = this.v[3 * ib + 1], vz = this.v[3 * ib + 2];
      const GM = G * this.m[ib];
      let tmin = Infinity;
      for (let k = 0; k < this.dN; k++) {
        if (this.dState[k] !== 1) continue;
        const dx = this.dx[3 * k] - bx, dy = this.dx[3 * k + 1] - by, dz = this.dx[3 * k + 2] - bz;
        const r2 = dx * dx + dy * dy + dz * dz;
        const r = Math.sqrt(r2);
        const u = Math.sqrt((this.dv[3 * k] - vx) ** 2 + (this.dv[3 * k + 1] - vy) ** 2 + (this.dv[3 * k + 2] - vz) ** 2) + 1e-9;
        const t = Math.min(0.4 * Math.sqrt((r2 * r) / GM), 0.3 * r / u);
        if (t < tmin) tmin = t;
      }
      return tmin;
    }

    /** 把天体 i 撕碎成碎片 */
    disrupt(i) {
      const b = this.bodies[i];
      const n = b.type === 'sun' ? this.nDebris : 300;
      const R = b.R;
      const p = this.pos(i), v = this.vel(i);
      const rnd = mulberry(1234 + i);
      const start = this.dN;
      for (let k = 0; k < n && this.dN < 4000; k++) {
        // 按多方球近似的中心集中分布抽样
        let x, y, z, r;
        do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; r = x * x + y * y + z * z; } while (r > 1);
        const s = Math.pow(r, 0.35) * R;
        const l = Math.sqrt(r) || 1;
        const j = this.dN++;
        this.dx.set([p[0] + (x / l) * s, p[1] + (y / l) * s, p[2] + (z / l) * s], 3 * j);
        this.dv.set(v, 3 * j);
        this.dm[j] = b.m / n;
        this.dState[j] = 1;
        this.dSrc[j] = i;
        this.dPassed[j] = 0;
        this.dPrevVr[j] = -1;
        this.dBorn[j] = this.t;
      }
      this.alive[i] = 0;
      b.alive = false;
      b.status = 'disrupted';
      this.debrisStart = this.debrisStart == null ? start : this.debrisStart;
      if (b.type === 'sun') this.sunDisruptedAt = this.t;
    }

    /** 推进时间 T（年），最多 maxSteps 个全局步；返回实际推进的时间 */
    advance(T, maxSteps = 3000, debrisBudget = 2000) {
      let done = 0, n = 0;
      const x0 = new Float64Array(3 * this.N);
      while (done < T && n < maxSteps) {
        let dt = Math.min(this.timestep(), T - done);
        if (this.dN) dt = Math.min(dt, 0.002, this.debrisTimestep());
        const ext = this.debrisExt();
        x0.set(this.x);
        this.yoshida(dt, ext);
        this.stepDebris(dt, x0, this.x, debrisBudget);
        this.accrete(dt);
        this.t += dt; done += dt; n++; this.steps++;
        this.checkEvents();
      }
      return done;
    }

    /** 吸积盘 → 黑洞：粘滞时标 t_visc（取 0.01 年 ≈ 3.7 天，恒星级 TDE 的量级） */
    accrete(dt) {
      if (this.diskMass <= 0) { this.mdot *= Math.exp(-dt / 0.01); this.updateL(); return; }
      const tv = 0.01;
      const dm = this.diskMass * (1 - Math.exp(-dt / tv));
      this.diskMass -= dm;
      this.accreted += dm;
      const inst = dm / dt;
      this.mdot = inst;
      this.updateL();
    }
    updateL() {
      // Ṁ（M☉/年）→ kg/s；L = η Ṁ c²
      const mdotKg = (this.mdot * MSUN_KG) / YR_S;
      const eta = 0.1;
      const LEdd = 1.26e31 * this.m[this.bh]; // W
      const MdotEdd = LEdd / (eta * 9e16);
      let L = eta * mdotKg * 9e16;
      if (mdotKg > MdotEdd) L = LEdd * (1 + Math.log(mdotKg / MdotEdd));
      this.LaccW = L;
      this.Lacc = L / LSUN_W;
      this.LEdd = LEdd / LSUN_W;
      this.mdotEddRatio = mdotKg / MdotEdd;
    }

    checkEvents() {
      const ib = this.bh;
      const pb = this.pos(ib);
      this.rAccrete = Math.max(1e-4, 50 * this.bodies[ib].R);
      for (let i = 0; i < this.N; i++) {
        if (i === ib || !this.alive[i]) continue;
        const b = this.bodies[i];
        const d = len(sub(this.pos(i), pb));
        if (this.minDist[b.key] == null || d < this.minDist[b.key].d) this.minDist[b.key] = { d, t: this.t };
        if (d < this.tidalR[b.key]) {
          this.disrupt(i);
          this.emit('disrupt', b, d);
          continue;
        }
        // 行星与太阳相撞
        const is = this.idx.sun;
        if (b.type !== 'sun' && this.alive[is] && len(sub(this.pos(i), this.pos(is))) < this.bodies[is].R + b.R) {
          this.alive[i] = 0; b.alive = false; b.status = 'sun';
          this.m[is] += this.m[i];
          this.emit('sunhit', b);
        }
      }
    }
    emit(type, body, extra) { this.events.push({ type, body, t: this.t, extra }); }

    /** 天体 i 相对天体 j 的比轨道能量与轨道根数 */
    orbit(i, j) {
      const r = sub(this.pos(i), this.pos(j)), v = sub(this.vel(i), this.vel(j));
      const mu = G * (this.m[i] + this.m[j]);
      const d = len(r), sp = len(v);
      const eps = (sp * sp) / 2 - mu / d;
      const hv = cross(r, v);
      const e = Math.sqrt(Math.max(0, 1 + (2 * eps * dot(hv, hv)) / (mu * mu)));
      const a = -mu / (2 * eps);
      return { d, v: sp, eps, a, e, bound: eps < 0, q: a * (1 - e), Q: eps < 0 ? a * (1 + e) : Infinity, P: eps < 0 ? Math.sqrt((a * a * a) / (this.m[i] + this.m[j])) : Infinity };
    }

    energy() {
      let E = 0;
      for (let i = 0; i < this.N; i++) {
        if (!this.alive[i]) continue;
        const v = this.vel(i);
        E += 0.5 * this.m[i] * dot(v, v);
        for (let j = i + 1; j < this.N; j++) if (this.alive[j]) E -= (G * this.m[i] * this.m[j]) / len(sub(this.pos(i), this.pos(j)));
      }
      return E;
    }
    momentum() {
      let P = [0, 0, 0];
      for (let i = 0; i < this.N; i++) if (this.alive[i]) P = add(P, mul(this.vel(i), this.m[i]));
      for (let k = 0; k < this.dN; k++) if (this.dState[k] === 1) P = add(P, [this.dv[3 * k] * this.dm[k], this.dv[3 * k + 1] * this.dm[k], this.dv[3 * k + 2] * this.dm[k]]);
      return P;
    }
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const API = { Sim, aim, planetState, G, C, KMS, AU_KM, YR_S, MSUN_KG, LSUN_W, PLANETS, SUN, MOON, km, vec: { sub, add, mul, dot, len, cross }, ellipticState, hyperbolicState, rotate, jd };
  if (typeof window !== 'undefined') window.BHInvasion = API;
  if (typeof module !== 'undefined') module.exports = API;
})();
