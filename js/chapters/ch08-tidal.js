/* 第 8 章：潮汐力与“意面化” */
(function () {
  'use strict';
  const P = U.PHYS;
  const gE = 9.8, Lbody = 2; // 地球重力加速度，人体长度（米）

  // 宇航员形状（局部坐标，单位米，y 轴沿径向：头朝外）
  const BODY = (() => {
    const pts = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; pts.push([Math.cos(a) * 0.13, 0.85 + Math.sin(a) * 0.13]); }
    for (let i = 0; i <= 10; i++) pts.push([0, 0.7 - i * 0.07]);
    for (let i = 0; i <= 7; i++) { pts.push([-0.05 - i * 0.05, 0.6 - i * 0.04]); pts.push([0.05 + i * 0.05, 0.6 - i * 0.04]); }
    for (let i = 0; i <= 9; i++) { pts.push([-0.03 - i * 0.025, -0.05 - i * 0.1]); pts.push([0.03 + i * 0.025, -0.05 - i * 0.1]); }
    return pts.map(([x, y]) => [x, y - 0.0]);
  })();

  function spaghetti(ctx) {
    const s = ctx.sim({
      title: '意面化：头朝下掉进黑洞会怎样？',
      desc: '宇航员脚朝黑洞下落。脚比头离黑洞近 2 米，受到的引力更大，于是身体被沿着下落方向拉长、沿横向挤扁。选择不同质量的黑洞，看看宇航员能否活着穿过视界。',
      wide: true,
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 8, maxHeight: 520 });
    let Msol = 10, prog = 0, playing = true;
    const ro = U.readouts(s.panel, [
      { key: 'r', label: '距黑洞中心' },
      { key: 'rr', label: '距离 / 视界半径' },
      { key: 'a', label: '头脚之间的潮汐加速度差' },
      { key: 'sp', label: '致命潮汐（100 g）出现在' },
      { key: 'st', label: '宇航员状态', wide: true },
    ]);
    U.slider(s.panel, { label: '黑洞质量', min: 1, max: 1e10, value: Msol, log: true, format: (v) => U.sci(v, 2) + ' M☉', onInput: (v) => { Msol = v; } });
    const pre = U.el('div');
    s.panel.appendChild(pre);
    const sl = s.panel.querySelector('input[type=range]');
    const setM = (m) => { sl.value = Math.log10(m); sl.dispatchEvent(new Event('input')); prog = 0; playing = true; };
    U.buttons(pre, [
      { label: '恒星级 10 M☉', onClick: () => setM(10) },
      { label: '中等质量 1 万 M☉', onClick: () => setM(1e4) },
      { label: '人马座A* 430 万 M☉', onClick: () => setM(4.3e6) },
    ]);
    U.buttons(s.panel, [{ label: '↺ 重新下落', primary: true, onClick: () => { prog = 0; playing = true; } }]);

    ctx.loop((dt) => {
      const M = Msol * P.Msun;
      const rs = U.rs(M);
      const tid = (r) => (2 * P.G * M * Lbody) / (r * r * r); // m/s²
      const rStart = Math.max(rs * 12, Math.cbrt((2 * P.G * M * Lbody) / (0.01 * gE)));
      const rEnd = rs * 0.03;
      if (playing) prog = Math.min(1, prog + dt / 9);
      const r = Math.exp(Math.log(rStart) + (Math.log(rEnd) - Math.log(rStart)) * U.smoothstep(0, 1, prog));
      const aT = tid(r);
      const aG = aT / gE;
      const rDeath = Math.cbrt((2 * P.G * M * Lbody) / (100 * gE));
      ro.set('r', U.length(r));
      ro.set('rr', U.fix(r / rs, 3));
      ro.set('a', U.sci(aG, 3) + ' g');
      ro.set('sp', rDeath > rs ? `视界<b>外</b> ${U.length(rDeath - rs)} 处` : `视界<b>内</b>（距中心 ${U.length(rDeath)}）`);
      let st;
      if (aG < 0.1) st = '😊 毫无感觉';
      else if (aG < 1) st = '🙂 感到轻微拉扯';
      else if (aG < 10) st = '😣 像被绑在刑架上拉伸';
      else if (aG < 100) st = '😱 骨骼断裂，致命';
      else st = '🍝 被拉成“意大利面”';
      if (r < rs) st += ' ｜ 已在视界内';
      ro.set('st', st);

      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 左：下落路径示意（对数刻度）
      const lw = w * 0.55;
      const lr = (x) => Math.log10(x);
      const Y0 = 40, Y1 = h - 30;
      const RY = (x) => Y0 + ((lr(rStart) - lr(x)) / (lr(rStart) - lr(rEnd))) * (Y1 - Y0);
      // 背景色带：潮汐强度
      for (let y = Y0; y < Y1; y += 3) {
        const rr = Math.pow(10, lr(rStart) - ((y - Y0) / (Y1 - Y0)) * (lr(rStart) - lr(rEnd)));
        const v = U.clamp(Math.log10(tid(rr) / gE / 0.01) / 6, 0, 1);
        g.fillStyle = `rgba(${Math.round(255 * v)},${Math.round(80 + 60 * (1 - v))},${Math.round(160 * (1 - v))},${0.05 + 0.25 * v})`;
        g.fillRect(40, y, lw - 80, 3);
      }
      const mark = (rr, txt, col) => {
        if (rr > rStart || rr < rEnd) return;
        const y = RY(rr);
        g.strokeStyle = col; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(40, y); g.lineTo(lw - 40, y); g.stroke(); g.setLineDash([]);
        U.text(g, txt, lw - 44, y - 9, { align: 'right', size: 11, color: col, shadow: true });
      };
      mark(rs, '事件视界', '#ff6b3d');
      mark(Math.cbrt((2 * P.G * M * Lbody) / (1 * gE)), '潮汐差 1 g', '#ffe066');
      mark(rDeath, '潮汐差 100 g（致命）', '#ff4d6d');
      // 宇航员位置
      const ay = RY(r);
      U.glowCircle(g, lw / 2, ay, 5, '#fff', 14);
      U.text(g, '↓ 黑洞方向', 44, h - 12, { size: 11, color: 'rgba(255,255,255,0.5)' });
      U.text(g, '下落路径（对数刻度）', 44, 22, { size: 12, color: 'rgba(255,255,255,0.6)' });

      // 右：宇航员特写
      const cx = lw + (w - lw) / 2, cy = h / 2;
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(lw, 0); g.lineTo(lw, h); g.stroke();
      U.text(g, '宇航员特写（黑洞在下方）', lw + 12, 22, { size: 12, color: 'rgba(255,255,255,0.6)' });
      const stretch = 1 + Math.max(0, Math.log10(Math.max(aG, 1e-9) / 0.05)) * 0.9;
      const torn = aG > 100;
      const scale = (h * 0.32);
      const pts = BODY;
      const rnd = U.rng(3);
      g.save();
      for (let i = 0; i < pts.length; i++) {
        let [x, y] = pts[i];
        let sy = stretch, sx = 1 / Math.sqrt(stretch);
        if (torn) { sy = Math.min(stretch * (1 + (Math.log10(aG / 100)) * 1.2), (h * 0.85) / (0.98 * scale)); }
        let py = cy - (y - 0.3) * scale * sy * 0.5;
        let px = cx + x * scale * sx;
        if (torn) { px += (rnd() - 0.5) * 4; py += (rnd() - 0.5) * 10 * Math.log10(aG / 100 + 1); }
        const heat = U.clamp(Math.log10(Math.max(aG, 1e-3) / 1) / 3, 0, 1);
        g.fillStyle = `rgb(${Math.round(180 + 75 * heat)},${Math.round(220 - 140 * heat)},${Math.round(255 - 200 * heat)})`;
        g.beginPath(); g.arc(px, py, 2.2, 0, 6.283); g.fill();
      }
      g.restore();
      // 受力箭头
      if (!torn) {
        const L = 20 + 10 * Math.min(stretch, 5);
        U.arrow(g, cx, cy - scale * 0.55 * stretch * 0.5 - 10, cx, cy - scale * 0.55 * stretch * 0.5 - 10 - L * 0.5, '#5cc8ff', 2, 7);
        U.arrow(g, cx, cy + scale * 0.35 * stretch * 0.5 + 10, cx, cy + scale * 0.35 * stretch * 0.5 + 10 + L, '#ffb454', 2, 7);
        U.arrow(g, cx - 60, cy, cx - 30, cy, 'rgba(255,255,255,0.5)', 1.5, 6);
        U.arrow(g, cx + 60, cy, cx + 30, cy, 'rgba(255,255,255,0.5)', 1.5, 6);
      }
      U.text(g, '拉伸 ×' + (torn ? '∞' : stretch.toFixed(2)), cx, h - 16, { align: 'center', size: 13, color: '#ffb454' });
    }, s.box);
  }

  function tde(ctx) {
    const s = ctx.sim({
      title: '潮汐瓦解事件：一颗恒星被黑洞撕碎',
      desc: '一颗恒星（由 600 个粒子组成，靠自身引力维系）沿抛物线轨道掠过超大质量黑洞。近心点足够近时，潮汐力超过恒星自身引力，恒星被撕成一条细长的“恒星流”：大约一半物质被束缚、最终落回黑洞形成吸积盘，另一半被甩出去。',
    });
    const cv = U.canvas(s.stage, { aspect: 4 / 3, maxHeight: 600 });
    let rp = 2.5;
    const Mbh = 1, mStar = 0.001, Rstar = 0.3;
    const rt = Rstar * Math.cbrt(Mbh / mStar);
    const ro = U.readouts(s.panel, [
      { key: 'rt', label: '潮汐半径 r<sub>t</sub>' },
      { key: 'rp', label: '近心点 r<sub>p</sub>' },
      { key: 'beta', label: '穿透深度 r<sub>t</sub>/r<sub>p</sub>' },
      { key: 'eat', label: '已被吞噬' },
      { key: 'st', label: '预测', wide: true },
    ]);
    U.slider(s.panel, { label: '近心点距离', min: 1, max: 10, step: 0.01, value: rp, format: (v) => v.toFixed(2), onInput: (v) => { rp = v; } });
    U.buttons(s.panel, [{ label: '▶ 发射恒星', primary: true, onClick: () => init() }]);
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '橙色：被黑洞束缚的碎片（将落回）；蓝色：获得足够能量、将逃离的碎片。距离单位任意，r<sub>t</sub> = R<sub>★</sub>(M<sub>BH</sub>/M<sub>★</sub>)<sup>1/3</sup>。' }));
    let parts = [], core = null, eaten = 0, flashes = [], tSim = 0, tPeri = -1, lastRc = 1e9;
    function init() {
      const r0 = 22;
      const cosT = 2 * rp / r0 - 1;
      const th = -Math.acos(U.clamp(cosT, -1, 1));
      const hmom = Math.sqrt(2 * Mbh * rp);
      const x = r0 * Math.cos(th), y = r0 * Math.sin(th);
      const vr = (Mbh / hmom) * Math.sin(th), vt = hmom / r0;
      const vx = vr * Math.cos(th) - vt * Math.sin(th), vy = vr * Math.sin(th) + vt * Math.cos(th);
      core = { x, y, vx, vy };
      parts = [];
      const rnd = U.rng(11);
      while (parts.length < 600) {
        const px = (rnd() * 2 - 1) * Rstar, py = (rnd() * 2 - 1) * Rstar;
        const d = Math.hypot(px, py);
        if (d > Rstar) continue;
        // 给粒子一个近似的束缚圆周运动，避免初始塌缩
        const vc = Math.sqrt(mStar * Math.pow(d / Rstar, 2) / Rstar) * 0.7;
        const a = Math.atan2(py, px);
        parts.push({ x: x + px, y: y + py, vx: vx - Math.sin(a) * vc, vy: vy + Math.cos(a) * vc, dead: false });
      }
      eaten = 0; flashes = []; tSim = 0; tPeri = -1; lastRc = 1e9;
    }
    init();
    const selfAcc = (dx, dy) => {
      const d = Math.hypot(dx, dy) + 1e-6;
      const k = d < Rstar ? mStar / (Rstar ** 3) : mStar / (d ** 3);
      return [-k * dx, -k * dy];
    };
    ctx.loop((dt) => {
      const sub = 12, hs = (dt * 5) / sub;
      for (let k = 0; k < sub; k++) {
        // 核心
        const rc = Math.hypot(core.x, core.y);
        tSim += hs;
        if (tPeri < 0 && rc > lastRc) tPeri = tSim; // 核心刚经过近心点
        lastRc = rc;
        // 回落的束缚碎片相互碰撞、耗散能量（唯象阻尼），逐渐形成吸积盘并被吞噬
        const dissip = tPeri > 0 && tSim - tPeri > 6;
        core.vx -= (Mbh * core.x / rc ** 3) * hs; core.vy -= (Mbh * core.y / rc ** 3) * hs;
        core.x += core.vx * hs; core.y += core.vy * hs;
        for (const p of parts) {
          if (p.dead) continue;
          const r = Math.hypot(p.x, p.y);
          let ax = -Mbh * p.x / r ** 3, ay = -Mbh * p.y / r ** 3;
          const [sx, sy] = selfAcc(p.x - core.x, p.y - core.y);
          p.vx += (ax + sx) * hs; p.vy += (ay + sy) * hs;
          if (dissip && r < 4 && 0.5 * (p.vx * p.vx + p.vy * p.vy) - Mbh / r < 0) { const k = 1 - 0.06 * hs; p.vx *= k; p.vy *= k; }
          p.x += p.vx * hs; p.y += p.vy * hs;
          if (r < 0.25) { p.dead = true; eaten++; if (flashes.length < 40) flashes.push({ x: p.x, y: p.y, t: 0 }); }
        }
      }
      const { ctx: g, w, h } = cv;
      g.fillStyle = 'rgba(2,3,8,0.35)'; g.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / 30;
      const cx = w * 0.62, cy = h * 0.5;
      // 潮汐半径
      g.strokeStyle = 'rgba(255,92,108,0.35)'; g.setLineDash([4, 6]); g.beginPath(); g.arc(cx, cy, rt * sc, 0, 6.283); g.stroke(); g.setLineDash([]);
      U.text(g, '潮汐半径', cx + rt * sc * 0.72, cy - rt * sc * 0.72, { size: 11, color: 'rgba(255,92,108,0.7)' });
      // 吸积发光
      const glow = Math.min(1, eaten / 60);
      if (glow > 0) {
        const gr = g.createRadialGradient(cx, cy, 2, cx, cy, sc * 3);
        gr.addColorStop(0, `rgba(255,220,160,${0.7 * glow})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, sc * 3, 0, 6.283); g.fill();
      }
      U.drawBH(g, cx, cy, Math.max(3, 0.25 * sc), 0, true);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        if (p.dead) continue;
        const r = Math.hypot(p.x, p.y);
        const E = 0.5 * (p.vx * p.vx + p.vy * p.vy) - Mbh / r;
        g.fillStyle = E < 0 ? 'rgba(255,170,80,0.8)' : 'rgba(110,190,255,0.8)';
        g.fillRect(cx + p.x * sc - 1, cy - p.y * sc - 1, 2, 2);
      }
      g.restore();
      flashes = flashes.filter((f) => (f.t += dt) < 0.4);
      for (const f of flashes) { g.strokeStyle = `rgba(255,230,180,${1 - f.t / 0.4})`; g.beginPath(); g.arc(cx + f.x * sc, cy - f.y * sc, 2 + f.t * 30, 0, 6.283); g.stroke(); }
      ro.set('rt', rt.toFixed(2));
      ro.set('rp', rp.toFixed(2));
      ro.set('beta', (rt / rp).toFixed(2));
      ro.set('eat', eaten + ' 个粒子');
      ro.set('st', rp < rt ? '<span style="color:#ff6b7a">近心点在潮汐半径以内：恒星将被撕碎！</span>' : rp < rt * 1.4 ? '擦边而过：可能被剥离一部分外层' : '距离足够远：恒星完好无损地离开');
    }, s.box);
  }

  App.chapter({
    id: 'tidal', num: 8, part: 'B',
    title: '潮汐力与“意面化”',
    subtitle: '掉进黑洞会死吗？答案取决于黑洞有多大——而且可能和你的直觉完全相反。',
    summary: '引力的“差”会把物体拉长。小黑洞在视界外就能撕碎人，大黑洞却可以让你安然穿过视界。',
    sims: ['意面化模拟', '潮汐瓦解恒星'],
    goals: ['潮汐力的来源', '潮汐力 ∝ M/r³', '意面化发生在哪里', '为什么大黑洞更“温柔”', '潮汐瓦解事件'],
    build(ctx) {
      ctx.section('潮汐力：引力的“差值”', `
        <p>地球上的海水每天涨落两次，这是因为月球对地球<b>近侧</b>海水的引力比对地球<b>中心</b>的大，对<b>远侧</b>海水的引力又比对中心的小。结果地球在月球方向上被轻微“拉长”，形成两个潮汐隆起。</p>
        <p>这种由引力大小的差异造成的“拉扯”，叫做<span class="hl">潮汐力</span>。对一个长度为 L 的物体，两端的引力加速度之差约为：</p>`);
      ctx.eq(`Δa ≈ ${U.frac('2GML', 'r<sup>3</sup>')}`, '潮汐力与距离的三次方成反比——距离减半，潮汐力变为 8 倍');
      ctx.section(null, `<p>在地球表面，你头和脚之间的潮汐加速度差只有约 3×10<sup>−6</sup> m/s²，完全感觉不到。但在黑洞附近，r 可以非常小，潮汐力会变得极其恐怖。</p>`);
      spaghetti(ctx);
      ctx.section('反直觉的结论：越大的黑洞，视界处越“温柔”', `
        <p>把 r = r<sub>s</sub> = 2GM/c² 代入潮汐公式，得到视界处的潮汐加速度：</p>`);
      ctx.eq(`Δa<sub>视界</sub> = ${U.frac('2GML', 'r<sub>s</sub><sup>3</sup>')} = ${U.frac('c<sup>6</sup>L', '4G<sup>2</sup>M<sup>2</sup>')} ∝ ${U.frac('1', 'M<sup>2</sup>')}`, '黑洞质量越大，视界处潮汐力反而越小');
      ctx.section(null, `
        <table>
          <tr><th>黑洞</th><th>视界半径</th><th>视界处头脚潮汐差</th><th>结局</th></tr>
          <tr><td>10 M☉（恒星级）</td><td>30 km</td><td>约 2×10<sup>7</sup> g</td><td>在视界外几百公里处就被撕碎</td></tr>
          <tr><td>430 万 M☉（人马座 A*）</td><td>1270 万 km</td><td>约 10<sup>−4</sup> g</td><td>毫无察觉地穿过视界</td></tr>
          <tr><td>65 亿 M☉（M87*）</td><td>190 亿 km</td><td>约 5×10<sup>−11</sup> g</td><td>在视界内还能“活”上一天多</td></tr>
        </table>
        <p>这个过程被物理学家形象地称为<span class="hl">意面化</span>（spaghettification）——出自霍金的科普名著《时间简史》。当然，无论黑洞多大，一旦越过视界，最终都会在接近奇点时被无限增大的潮汐力撕碎。</p>`);
      ctx.section('潮汐瓦解事件：天空中突然亮起的“死亡之光”', `<p>同样的命运也会降临到恒星身上。当一颗恒星不幸运行到超大质量黑洞附近的<b>潮汐半径</b>以内时，就会被撕碎：</p>`);
      ctx.eq(`r<sub>t</sub> ≈ R<sub>★</sub> (${U.frac('M<sub>BH</sub>', 'M<sub>★</sub>')})<sup>1/3</sup>`, '当潮汐力超过恒星自身的引力时，恒星解体');
      tde(ctx);
      ctx.callout('fact', `<p>天文学家已经观测到上百次这样的<b>潮汐瓦解事件</b>（TDE）：原本安静的星系中心在几周内突然增亮上百倍，然后在几个月到几年内逐渐变暗。2019 年，一颗恒星在 2.15 亿光年外被一个百万太阳质量的黑洞撕碎（AT2019qiz），这是迄今观测最细致的 TDE 之一。</p>
        <p>有趣的是：对质量超过约 1 亿倍太阳质量的黑洞，像太阳这样的恒星的潮汐半径<b>比视界还小</b>——恒星会被整个吞下，而不会发出耀眼的“死亡之光”。</p>`);
      ctx.callout('key', '<p>① 潮汐力来自引力的差，∝ M·L/r³；② 视界处潮汐力 ∝ 1/M²，小黑洞在视界外就会把人撕碎，超大质量黑洞则可以平安穿过视界；③ 恒星靠近黑洞会被撕碎，形成可观测的潮汐瓦解事件。</p>');
      ctx.think('为什么潮汐力会把人“拉长”而不是“压扁”？横向发生了什么？',
        '沿径向，脚比头受引力大，于是身体被拉长。横向上，身体左右两侧受到的引力都指向黑洞中心，方向略微向内汇聚，于是身体被<b>横向挤压</b>。所以宇航员既被拉长又被挤细——正像挤牙膏或拉面条一样。');
      ctx.think('月球的潮汐力让地球自转逐渐变慢、月球逐渐远离地球（每年约 3.8 cm）。能用潮汐力解释为什么月球总是同一面朝向地球吗？',
        '可以。几十亿年前月球自转得更快，地球对月球的潮汐作用在月球上产生潮汐隆起，隆起受到的力矩不断“刹车”，直到月球的自转周期等于公转周期，隆起始终对准地球为止——这叫<b>潮汐锁定</b>。');
    },
  });
})();
