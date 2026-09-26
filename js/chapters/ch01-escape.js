/* 第 1 章：从牛顿到“暗星”——引力与逃逸速度 */
(function () {
  'use strict';
  const P = U.PHYS;

  const PLANETS = [
    { id: 'moon', name: '月球', M: 7.35e22, R: 1.737e6, color: ['#cfcfcf', '#6d6d6d'] },
    { id: 'earth', name: '地球', M: P.Mearth, R: P.Rearth, color: ['#6fb6ff', '#1b4a8a'] },
    { id: 'jupiter', name: '木星', M: 1.898e27, R: 6.9911e7, color: ['#f1d2a8', '#a86b3c'] },
    { id: 'sun', name: '太阳', M: P.Msun, R: P.Rsun, color: ['#fff3b0', '#ff9a2e'] },
    { id: 'wd', name: '白矮星（天狼星B）', M: 1.02 * P.Msun, R: 5.8e6, color: ['#ffffff', '#9fc4ff'] },
    { id: 'ns', name: '中子星', M: 1.4 * P.Msun, R: 1.2e4, color: ['#e2f0ff', '#6aa8ff'] },
  ];

  /* ---------------- 仿真 1：牛顿大炮 ---------------- */
  function newtonCannon(ctx) {
    const s = ctx.sim({
      title: '牛顿大炮：扔得多快才能不掉下来？',
      desc: '在高山顶上水平发射炮弹。速度小，炮弹落回地面；速度够大，它会“一直在下落却永远落不到地面”——这就是轨道；速度再大，它就逃离了星球。',
    });
    const cv = U.canvas(s.stage, { aspect: 4 / 3, maxHeight: 620 });
    let planet = PLANETS[1];
    const H = 0.07; // 山高（以星球半径为单位）
    const r0 = 1 + H;
    let shots = [];
    let vFrac = 0.8; // 以发射点逃逸速度为单位
    let angle = 0;
    const colors = ['#ffb454', '#5cc8ff', '#a78bfa', '#4ade80', '#ff7a9a', '#ffe066'];

    const ro = U.readouts(s.panel, [
      { key: 'v1', label: '环绕速度（发射点）' },
      { key: 'v2', label: '逃逸速度（发射点）' },
      { key: 'v', label: '当前发射速度', wide: true },
      { key: 'vc', label: '逃逸速度 / 光速', wide: true },
    ]);
    const status = U.el('div', { class: 'status' });
    U.select(s.panel, {
      label: '选择天体', value: planet.id,
      options: PLANETS.map((p) => ({ value: p.id, label: p.name })),
      onChange: (v) => { planet = PLANETS.find((p) => p.id === v); shots = []; update(); },
    });
    const sl = U.slider(s.panel, {
      label: '发射速度（相对逃逸速度）', min: 0.3, max: 1.3, step: 0.005, value: vFrac,
      format: (v) => (v * 100).toFixed(1) + '%',
      onInput: (v) => { vFrac = v; update(); },
    });
    U.slider(s.panel, { label: '发射仰角', min: 0, max: 80, step: 1, value: 0, format: (v) => v.toFixed(0) + '°', onInput: (v) => { angle = v; } });
    U.buttons(s.panel, [
      { label: '🚀 发射', primary: true, onClick: fire },
      { label: '恰好环绕', onClick: () => { sl.set(1 / Math.SQRT2); fire(); } },
      { label: '恰好逃逸', onClick: () => { sl.set(1.0); fire(); } },
      { label: '清空', onClick: () => { shots = []; } },
    ]);
    s.panel.appendChild(status);

    function vEsc() { return Math.sqrt((2 * P.G * planet.M) / (planet.R * r0)); }
    function update() {
      const ve = vEsc();
      ro.set('v1', U.sci(ve / Math.SQRT2 / 1000) + ' km/s');
      ro.set('v2', U.sci(ve / 1000) + ' km/s');
      ro.set('v', U.sci((vFrac * ve) / 1000) + ' km/s');
      ro.set('vc', U.sci(ve / P.c, 3) + (ve / P.c > 0.1 ? ' ⚠' : ''));
      let t, cls;
      if (vFrac < 0.7) { t = '预测：炮弹会落回地面。'; cls = 'bad'; }
      else if (vFrac < 0.715) { t = '预测：接近圆形轨道！（v ≈ v<sub>esc</sub>/√2）'; cls = 'good'; }
      else if (vFrac < 1) { t = '预测：椭圆轨道——绕一圈又回到山顶。'; cls = 'good'; }
      else { t = '预测：速度 ≥ 逃逸速度，炮弹将一去不复返！'; cls = 'warn'; }
      status.className = 'status ' + cls;
      status.innerHTML = t;
    }
    function fire() {
      const a = (angle * Math.PI) / 180;
      const v = vFrac * Math.SQRT2 / Math.sqrt(r0); // 单位：GM=1, R=1
      shots.push({ x: 0, y: r0, vx: v * Math.cos(a), vy: v * Math.sin(a), trail: [[0, r0]], alive: true, color: colors[shots.length % colors.length], t: 0 });
      if (shots.length > 6) shots.shift();
    }
    update();
    fire();

    let view = 3.2; // 视野半径（星球半径单位）
    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      // 物理积分（无量纲：GM = 1, R = 1）
      for (const sh of shots) {
        if (!sh.alive) continue;
        const sub = 60;
        const hstep = (dt * 1.6) / sub;
        for (let i = 0; i < sub; i++) {
          const r = Math.hypot(sh.x, sh.y);
          const ax = -sh.x / (r * r * r), ay = -sh.y / (r * r * r);
          sh.vx += ax * hstep; sh.vy += ay * hstep;
          sh.x += sh.vx * hstep; sh.y += sh.vy * hstep;
          sh.t += hstep;
          const nr = Math.hypot(sh.x, sh.y);
          const ang = Math.atan2(sh.x, sh.y);
          const ground = 1 + (Math.abs(ang) < 0.08 ? H * (1 - Math.abs(ang) / 0.08) : 0);
          if (nr < ground && sh.t > 0.05) { sh.alive = false; sh.hit = true; break; }
          if (nr > 40) { sh.alive = false; sh.escaped = true; break; }
        }
        sh.trail.push([sh.x, sh.y]);
        if (sh.trail.length > 4000) sh.trail.splice(0, 1);
      }
      // 自动缩放视野
      let want = 3.2;
      for (const sh of shots) for (let i = 0; i < sh.trail.length; i += 20) want = Math.max(want, Math.min(14, Math.hypot(...sh.trail[i]) * 1.15));
      view += (want - view) * Math.min(1, dt * 2);

      g.fillStyle = '#020308';
      g.fillRect(0, 0, w, h);
      const sc = Math.min(w, h) / (2 * view);
      const cx = w / 2, cy = h / 2 + (view < 4 ? 0 : 0);
      const X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
      // 星球
      const grd = g.createRadialGradient(X(-0.35), Y(0.35), sc * 0.1, X(0), Y(0), sc);
      grd.addColorStop(0, planet.color[0]); grd.addColorStop(1, planet.color[1]);
      g.save();
      g.shadowColor = planet.color[0]; g.shadowBlur = 30;
      g.fillStyle = grd;
      g.beginPath(); g.arc(X(0), Y(0), sc, 0, Math.PI * 2); g.fill();
      g.restore();
      // 山
      g.fillStyle = '#5a4a3a';
      g.beginPath();
      g.moveTo(X(-0.09), Y(Math.sqrt(1 - 0.0081)));
      g.lineTo(X(0), Y(1 + H));
      g.lineTo(X(0.09), Y(Math.sqrt(1 - 0.0081)));
      g.fill();
      // 大炮
      g.save(); g.translate(X(0), Y(r0)); g.rotate(-(angle * Math.PI) / 180);
      g.fillStyle = '#ddd'; g.fillRect(-4, -4, 18, 8); g.restore();
      // 轨迹
      for (const sh of shots) {
        g.save();
        g.strokeStyle = sh.color; g.lineWidth = 2; g.shadowColor = sh.color; g.shadowBlur = 8;
        g.beginPath();
        sh.trail.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
        g.stroke();
        g.restore();
        const [lx, ly] = sh.trail[sh.trail.length - 1];
        if (sh.alive) U.glowCircle(g, X(lx), Y(ly), 4, '#fff', 12);
        else if (sh.hit) U.text(g, '💥', X(lx), Y(ly), { align: 'center', size: 16 });
      }
      U.text(g, planet.name + '（示意，比例尺自动缩放）', 12, 18, { size: 12, color: 'rgba(255,255,255,0.55)' });
    }, s.box);
  }

  /* ---------------- 仿真 2：暗星 ---------------- */
  function darkStar(ctx) {
    const s = ctx.sim({
      title: '米歇尔的“暗星”：把太阳压小，光还能逃出来吗？',
      desc: '保持太阳质量不变，把它越压越小。按照牛顿的想法，光也是一种“粒子”，向上飞时会被引力减速。当逃逸速度超过光速，连光都飞不出去——星星就“黑”了。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 10, maxHeight: 560 });
    const M = P.Msun;
    const Rs = U.rs(M);
    let R = 2.5 * Rs; // 米
    const ro = U.readouts(s.panel, [
      { key: 'R', label: '星球半径 R' },
      { key: 'rs', label: '临界半径 2GM/c²' },
      { key: 've', label: '表面逃逸速度', wide: true },
      { key: 'rho', label: '平均密度', wide: true },
    ]);
    const status = U.el('div', { class: 'status' });
    U.slider(s.panel, {
      label: '星球半径（太阳质量不变）', min: 0.6 * Rs, max: P.Rsun, value: R, log: true,
      format: (v) => U.length(v),
      onInput: (v) => { R = v; update(); },
    });
    U.buttons(s.panel, [
      { label: '真实太阳', onClick: () => set(P.Rsun) },
      { label: '白矮星大小', onClick: () => set(7e6) },
      { label: '中子星大小', onClick: () => set(1.2e4) },
      { label: '刚好“变黑”', onClick: () => set(Rs * 1.001) },
    ]);
    s.panel.appendChild(status);
    const sliderInput = s.panel.querySelector('input[type=range]');
    function set(v) { sliderInput.value = Math.log10(v); sliderInput.dispatchEvent(new Event('input')); }
    function update() {
      const ve = Math.sqrt((2 * P.G * M) / R);
      ro.set('R', U.length(R));
      ro.set('rs', U.length(Rs));
      ro.set('ve', U.sci(ve / 1000) + ' km/s = ' + U.sci(ve / P.c, 3) + ' c');
      const rho = M / ((4 / 3) * Math.PI * R ** 3);
      ro.set('rho', U.sci(rho) + ' kg/m³（水的 ' + U.sci(rho / 1000) + ' 倍）');
      if (R > Rs) {
        status.className = 'status ' + (ve / P.c > 0.3 ? 'warn' : 'good');
        status.innerHTML = `光可以逃离，但被引力“减速”：飞到远处时速度降为 ${U.fix(Math.sqrt(Math.max(0, 1 - Rs / R)), 3)} c（牛顿图像）`;
      } else {
        status.className = 'status bad';
        status.innerHTML = '逃逸速度 ≥ 光速：光子全部落回——一颗“暗星”诞生了！';
      }
    }
    update();

    const photons = [];
    let spawn = 0;
    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      g.fillStyle = 'rgba(2,3,8,1)';
      g.fillRect(0, 0, w, h);
      // 显示尺度：星球画成固定视觉大小（对数映射），光子高度以 R 为单位
      const cx = w / 2, cy = h * 0.92;
      const vis = U.clamp(20 + 60 * (Math.log10(R / Rs) / Math.log10(P.Rsun / Rs)), 20, 80) ;
      const dark = R <= Rs;
      const k = Rs / R; // = (v_esc/c)²
      // 发射光子（沿径向），牛顿图像：v² = c² − c²·k(1 − R/r)
      spawn += dt;
      while (spawn > 0.03) {
        spawn -= 0.03;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        photons.push({ a, r: 1, v: 1, dir: 1, life: 0 });
      }
      const heightScale = (h * 0.85 - vis) / vis; // 屏幕上最多显示到 heightScale 倍半径
      const maxR = 1 + heightScale;
      for (const p of photons) {
        // dv/dt = −(k/2) c² R / r²（单位：c = 1, R = 1）
        const sub = 10, hs = (dt * 1.2) / sub;
        for (let i = 0; i < sub; i++) {
          p.v -= ((k / 2) / (p.r * p.r)) * hs * 3;
          p.r += p.v * hs * 3;
        }
        p.life += dt;
      }
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i];
        if (p.r < 1 || p.r > maxR * 1.2 || p.life > 8) photons.splice(i, 1);
      }
      // 星球
      const col = dark ? '#000' : U.rgb(U.blackbody(5800 + 30000 * Math.min(1, k)), 1);
      if (!dark) {
        g.save(); g.shadowColor = col; g.shadowBlur = 40 + 60 * k;
        g.fillStyle = col; g.beginPath(); g.arc(cx, cy, vis, 0, Math.PI * 2); g.fill(); g.restore();
      } else {
        g.fillStyle = '#000'; g.strokeStyle = 'rgba(255,120,60,0.6)'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, cy, vis, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      // 光子
      for (const p of photons) {
        const x = cx + Math.cos(p.a) * p.r * vis;
        const y = cy + Math.sin(p.a) * p.r * vis;
        const bright = U.clamp(Math.abs(p.v), 0.15, 1);
        g.fillStyle = `rgba(255,${Math.round(200 + 55 * bright)},${Math.round(120 + 135 * bright)},${0.3 + 0.7 * bright})`;
        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
      }
      // 最高高度参考线
      if (!dark && k > 0.02) {
        // 牛顿图像下光子（上抛速度 c）能到达的最高点：1/r_max = 1 − 1/k（仅当 k>1），否则无上限
      }
      U.text(g, dark ? '暗星：光子飞出后又全部掉回去' : '亮星：光子（小点）向外飞，越飞越“慢”（颜色越暗）', 12, 18, { size: 12, color: 'rgba(255,255,255,0.6)' });
      U.text(g, '星球半径 = ' + U.fix(R / Rs, 2) + ' × 临界半径', 12, 38, { size: 12, color: '#ffb454' });
    }, s.box);
  }

  App.chapter({
    id: 'escape', num: 1, part: 'A',
    title: '从牛顿到“暗星”',
    subtitle: '一切从“扔石头”开始：什么是逃逸速度？为什么 200 多年前就有人猜到了黑洞？',
    summary: '牛顿大炮、逃逸速度，以及 1783 年米歇尔提出的“暗星”猜想。',
    sims: ['牛顿大炮', '压缩太阳'],
    goals: ['万有引力定律', '环绕速度与逃逸速度', '逃逸速度只和 M/R 有关', '“暗星”的历史猜想'],
    build(ctx) {
      ctx.section('万有引力：让苹果下落、让月亮绕圈的同一种力', `
        <p>1687 年，牛顿发现：任何两个有质量的物体都会相互吸引，吸引力的大小与两者质量的乘积成正比，与距离的平方成反比：</p>`);
      ctx.eq(`F = G ${U.frac('Mm', 'r<sup>2</sup>')}`, 'G ≈ 6.67×10<sup>−11</sup> N·m²/kg²，称为万有引力常数');
      ctx.section(null, `
        <p>这个公式有一个惊人之处：<b>让苹果落地的力，和让月亮绕着地球转的力，是同一种力</b>。月亮其实也一直在往地球“掉”，只不过它同时在高速横向运动，于是它“掉”的弯度刚好和地球表面的弯度一样——永远掉不到地上。</p>
        <p>牛顿本人用一个思想实验说明了这一点：在一座极高的山顶上架一门大炮，水平发射炮弹。下面就来亲手试一试。</p>`);
      newtonCannon(ctx);
      ctx.callout('tip', `
        <p>试着依次点击 <b>“恰好环绕”</b> 和 <b>“恰好逃逸”</b>，然后换成 <b>中子星</b> 看看数值——中子星的逃逸速度已经达到光速的三分之一以上！</p>`);
      ctx.section('逃逸速度：只要足够快，就能永远飞走', `
        <p>把物体向上抛，它会减速、落回。但如果初速度足够大，引力虽然一直在拖它，却再也拖不回来了。这个临界速度叫<span class="hl">逃逸速度</span>。</p>
        <p>用能量守恒可以一行推出来：要飞到无穷远，动能至少要等于把它从星球表面“拔”出来需要的能量：</p>`);
      ctx.eq(`${U.frac('1', '2')}mv<sup>2</sup> = G${U.frac('Mm', 'R')} &nbsp;⟹&nbsp; v<sub>esc</sub> = ${U.sqrt(U.frac('2GM', 'R'))}`, '逃逸速度只取决于星球的质量 M 和半径 R，与被抛物体的质量 m 无关');
      ctx.section(null, `
        <table>
          <tr><th>天体</th><th>逃逸速度</th><th>占光速比例</th></tr>
          <tr><td>月球</td><td>2.4 km/s</td><td>0.0008%</td></tr>
          <tr><td>地球</td><td>11.2 km/s</td><td>0.004%</td></tr>
          <tr><td>太阳</td><td>618 km/s</td><td>0.2%</td></tr>
          <tr><td>白矮星</td><td>约 5000 km/s</td><td>约 2%</td></tr>
          <tr><td>中子星</td><td>约 150 000 km/s</td><td>约 50%</td></tr>
          <tr><td><b>黑洞</b></td><td><b>≥ 300 000 km/s</b></td><td><b>≥ 100%</b></td></tr>
        </table>
        <p>注意公式里的 <span class="m">M/R</span>：<b>同样的质量，挤得越小，逃逸速度越大</b>。那么，如果挤得足够小，逃逸速度会不会超过光速？</p>`);
      darkStar(ctx);
      ctx.section('1783 年的大胆猜想', `
        <p>英国牧师、自然哲学家<b>约翰·米歇尔</b>在 1783 年写道：如果一颗恒星的密度和太阳一样，但半径是太阳的 500 倍，那么从它表面发出的光将被引力拉回——<b>这颗星虽然存在，我们却看不到它</b>。十几年后，法国数学家<b>拉普拉斯</b>也独立提出了同样的想法。他们称之为“暗星”（dark star）。</p>
        <p>令 <span class="m">v<sub>esc</sub> = c</span>，就得到一个临界半径：</p>`);
      ctx.eq(`R<sub>临界</sub> = ${U.frac('2GM', 'c<sup>2</sup>')}`, '巧合的是，这与 130 多年后广义相对论算出的“史瓦西半径”完全相同！');
      ctx.callout('warn', `
        <p>“暗星”只是黑洞的<b>前身思想</b>，它的物理图像是错的：</p>
        <ul>
          <li>牛顿理论里光会被“减速”，但我们将在第 2 章看到，<b>光速在任何情况下都是 c</b>，不会变慢。</li>
          <li>暗星的光可以飞到一定高度再落回，远处的人拿着梯子仍能看到它；而真正的黑洞，光<b>连离开视界一毫米都做不到</b>。</li>
        </ul>
        <p>要正确描述黑洞，我们需要爱因斯坦的相对论。这正是接下来两章的内容。</p>`);
      ctx.callout('key', `
        <p>① 逃逸速度 <span class="m">v<sub>esc</sub> = √(2GM/R)</span>，只取决于 M/R；② 同样质量压得越小，引力越“陡”；③ 当 <span class="m">R &lt; 2GM/c²</span> 时，按牛顿理论连光都逃不掉——这是黑洞思想的起点。</p>`);
      ctx.think('如果把地球压缩成黑洞，它的半径是多少？（地球质量 6×10²⁴ kg）',
        `代入 R = 2GM/c² = 2 × 6.67×10⁻¹¹ × 6×10²⁴ / (3×10⁸)² ≈ 0.0089 m，<b>约 9 毫米</b>，只有一颗弹珠那么大！可见要形成黑洞需要多么极端的压缩。`);
      ctx.think('逃逸速度和发射方向有关吗？竖直向上和水平发射，所需的逃逸速度一样吗？',
        `一样。逃逸速度来自能量守恒，只要动能足够，<b>无论朝哪个方向</b>（只要不直接撞到地面）物体最终都能飞到无穷远。你可以在牛顿大炮中调节仰角验证这一点。`);
    },
  });
})();
