/* 第 2 章：光速不变与狭义相对论 */
(function () {
  'use strict';

  /* ---------- 仿真 1：光钟 ---------- */
  function lightClock(ctx) {
    const s = ctx.sim({
      title: '光钟：运动的时钟为什么会变慢？',
      desc: '光钟由上下两面镜子组成，光在其间来回反射，每往返一次记为“滴答”一下。从地面看，飞船里的光走的是斜线——路程更长，而光速又不能变快，于是“滴答”一次需要更长时间。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, maxHeight: 520 });
    let beta = 0.6;
    const ro = U.readouts(s.panel, [
      { key: 'g', label: '洛伦兹因子 γ' },
      { key: 'len', label: '飞船长度（地面测）' },
      { key: 'rest', label: '地面光钟滴答' },
      { key: 'mov', label: '飞船光钟滴答' },
      { key: 'txt', label: '地面过 1 年，飞船里过', wide: true },
    ]);
    U.slider(s.panel, {
      label: '飞船速度 v / c', min: 0, max: 0.995, step: 0.001, value: beta,
      format: (v) => v.toFixed(3) + ' c',
      onInput: (v) => { beta = v; reset(); },
    });
    U.buttons(s.panel, [
      { label: '高铁 (≈0)', onClick: () => setB(0.0000003) },
      { label: '0.5 c', onClick: () => setB(0.5) },
      { label: '0.9 c', onClick: () => setB(0.9) },
      { label: '0.99 c', onClick: () => setB(0.99) },
    ]);
    const sl = s.panel.querySelector('input[type=range]');
    function setB(b) { sl.value = b; sl.dispatchEvent(new Event('input')); }
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '提示：高铁 350 km/h 时 γ − 1 ≈ 5×10<sup>−14</sup>，完全察觉不到；只有接近光速时效应才显著。' }));

    let tRest = 0, tMov = 0, ticksR = 0, ticksM = 0, x = 0, trail = [];
    function reset() { tRest = tMov = ticksR = ticksM = 0; x = 0; trail = []; }
    const T0 = 1.4; // 静止光钟往返一次的时间（秒，演示时间）
    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      const gamma = 1 / Math.sqrt(1 - beta * beta);
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      const half = w * 0.28;
      const L = h * 0.55; // 镜间距
      const top = h * 0.18, bot = top + L;
      const cpx = (2 * L) / T0; // 光速（像素/秒）
      // 分隔
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(half, 0); g.lineTo(half, h); g.stroke();
      U.text(g, '静止的光钟', half / 2, 22, { align: 'center', size: 13, color: '#5cc8ff' });
      U.text(g, `以 ${beta.toFixed(3)}c 飞行的光钟（从地面看）`, half + (w - half) / 2, 22, { align: 'center', size: 13, color: '#ffb454' });

      // 静止光钟
      tRest += dt;
      const phR = (tRest % T0) / T0;
      ticksR = Math.floor(tRest / T0);
      const yR = phR < 0.5 ? bot - (phR * 2) * L : top + (phR - 0.5) * 2 * L;
      const cxR = half / 2;
      drawMirrors(g, cxR, top, bot, 50, '#5cc8ff');
      g.strokeStyle = 'rgba(92,200,255,0.35)'; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(cxR, top); g.lineTo(cxR, bot); g.stroke(); g.setLineDash([]);
      U.glowCircle(g, cxR, yR, 5, '#bfe9ff', 18);

      // 运动光钟
      tMov += dt;
      const Tm = T0 * gamma;
      const phM = (tMov % Tm) / Tm;
      ticksM = Math.floor(tMov / Tm);
      const span = w - half;
      x += beta * cpx * dt;
      const x0 = half + 40;
      let cxM = x0 + (x % (span - 80));
      if (trail.length && cxM < trail[trail.length - 1][0] - 5) trail = [];
      const yM = phM < 0.5 ? bot - (phM * 2) * L : top + (phM - 0.5) * 2 * L;
      trail.push([cxM, yM]);
      if (trail.length > 400) trail.shift();
      g.save(); g.strokeStyle = 'rgba(255,180,84,0.55)'; g.lineWidth = 1.5;
      g.beginPath(); trail.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke(); g.restore();
      // 飞船（长度收缩）
      const shipW = 90 / gamma;
      g.fillStyle = 'rgba(255,180,84,0.08)'; g.strokeStyle = 'rgba(255,180,84,0.4)';
      g.beginPath(); g.roundRect ? g.roundRect(cxM - shipW / 2, top - 22, shipW, L + 44, 10) : g.rect(cxM - shipW / 2, top - 22, shipW, L + 44); g.fill(); g.stroke();
      drawMirrors(g, cxM, top, bot, 50 / gamma, '#ffb454');
      U.glowCircle(g, cxM, yM, 5, '#ffe2b8', 18);
      if (beta > 0.05) U.arrow(g, cxM + shipW / 2 + 6, bot + 34, cxM + shipW / 2 + 6 + 40 * beta + 10, bot + 34, 'rgba(255,180,84,0.8)', 2, 7);

      // 计数
      U.text(g, `滴答 × ${ticksR}`, cxR, bot + 40, { align: 'center', size: 16, color: '#5cc8ff' });
      U.text(g, `滴答 × ${ticksM}`, half + span / 2, h - 16, { align: 'center', size: 16, color: '#ffb454' });

      ro.set('g', gamma.toFixed(gamma > 10 ? 1 : 4));
      ro.set('len', (100 / gamma).toFixed(1) + '%');
      ro.set('rest', String(ticksR));
      ro.set('mov', String(ticksM));
      const days = 365.25 / gamma;
      ro.set('txt', days > 300 ? (days / 365.25).toFixed(6) + ' 年' : days.toFixed(1) + ' 天');
    }, s.box);

    function drawMirrors(g, cx, top, bot, w, col) {
      g.save(); g.strokeStyle = col; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(cx - w / 2, top - 4); g.lineTo(cx + w / 2, top - 4); g.moveTo(cx - w / 2, bot + 4); g.lineTo(cx + w / 2, bot + 4); g.stroke();
      g.restore();
    }
  }

  /* ---------- 仿真 2：双生子星际旅行 ---------- */
  function twins(ctx) {
    const s = ctx.sim({
      title: '双生子星际旅行：谁更年轻？',
      desc: '哥哥留在地球，弟弟乘飞船以接近光速飞往远方恒星再返回。两人的时钟各自记录经过的时间。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, maxHeight: 460 });
    let D = 4.24, beta = 0.9, age = 20;
    const targets = [
      { d: 4.24, n: '比邻星' }, { d: 8.6, n: '天狼星' }, { d: 25, n: '织女星' }, { d: 640, n: '参宿四' }, { d: 26000, n: '银河系中心 (人马座A*)' },
    ];
    const ro = U.readouts(s.panel, [
      { key: 'g', label: '洛伦兹因子 γ' },
      { key: 'e', label: '地球上经过' },
      { key: 's', label: '飞船上经过' },
      { key: 'a', label: '重逢时年龄（哥 / 弟）' },
    ]);
    U.select(s.panel, {
      label: '目的地', value: '4.24',
      options: targets.map((t) => ({ value: String(t.d), label: `${t.n}（${t.d} 光年）` })),
      onChange: (v) => { D = parseFloat(v); prog = 0; },
    });
    U.slider(s.panel, {
      label: '飞船速度 v / c', min: 0.1, max: 0.99999, step: 0.00001, value: beta,
      format: (v) => (v > 0.999 ? v.toFixed(5) : v.toFixed(3)) + ' c',
      onInput: (v) => { beta = v; prog = 0; },
    });
    U.buttons(s.panel, [{ label: '▶ 重新出发', primary: true, onClick: () => { prog = 0; } }]);
    let prog = 0;
    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      const gamma = 1 / Math.sqrt(1 - beta * beta);
      const tE = (2 * D) / beta, tS = tE / gamma;
      ro.set('g', gamma.toFixed(3));
      ro.set('e', U.sci(tE, 4) + ' 年');
      ro.set('s', U.sci(tS, 4) + ' 年');
      ro.set('a', `${U.sci(age + tE, 4)} / ${U.sci(age + tS, 4)} 岁`);
      prog = Math.min(1, prog + dt / 6);
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 旅途示意
      const y = h * 0.3, xa = 60, xb = w - 60;
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke(); g.setLineDash([]);
      U.glowCircle(g, xa, y, 10, '#4a90e2', 20); U.text(g, '地球', xa, y + 26, { align: 'center', size: 12 });
      U.glowCircle(g, xb, y, 8, '#fff2c0', 26); U.text(g, targets.find((t) => t.d === D).n, xb, y + 26, { align: 'center', size: 12 });
      const f = prog < 0.5 ? prog * 2 : 2 - prog * 2;
      const sx = xa + (xb - xa) * f;
      g.save(); g.translate(sx, y - 18); if (prog >= 0.5) g.scale(-1, 1);
      g.fillStyle = '#ffb454'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -6); g.lineTo(-10, 6); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,120,60,0.7)'; g.beginPath(); g.moveTo(-10, -3); g.lineTo(-20 - Math.random() * 8, 0); g.lineTo(-10, 3); g.fill();
      g.restore();
      // 两个时钟
      const drawClock = (cx, cy, r, years, label, col) => {
        g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
        const a = years * Math.PI * 2 - Math.PI / 2; // 一圈 = 1 年
        g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke();
        U.text(g, label, cx, cy + r + 18, { align: 'center', size: 13, color: col });
        U.text(g, U.sci(years, 4) + ' 年', cx, cy + r + 38, { align: 'center', size: 15, color: '#fff' });
      };
      const r = Math.min(h * 0.18, w * 0.1);
      drawClock(w * 0.3, h * 0.62, r, tE * prog, '哥哥（地球）', '#5cc8ff');
      drawClock(w * 0.7, h * 0.62, r, tS * prog, '弟弟（飞船）', '#ffb454');
    }, s.box);
  }

  App.chapter({
    id: 'special-relativity', num: 2, part: 'A',
    title: '光速不变与狭义相对论',
    subtitle: '为什么“连光都逃不出去”就意味着“什么都逃不出去”？答案藏在光速的奇特性质里。',
    summary: '光速对所有人都一样，于是时间会变慢、长度会收缩，光速成为宇宙的速度上限。',
    sims: ['光钟', '双生子旅行'],
    goals: ['光速不变原理', '时间膨胀', '长度收缩', '光速是速度上限', 'E = mc²'],
    build(ctx) {
      ctx.section('一个“不讲道理”的实验事实', `
        <p>假设你坐在一列以 100 km/h 行驶的火车上，向前扔出一个 20 km/h 的球。站台上的人看到球的速度是 120 km/h——这很符合直觉。</p>
        <p>但如果你打开手电筒呢？直觉告诉我们：站台上的人应该看到光速是 <span class="m">c + 100 km/h</span>。然而，1887 年的<b>迈克耳孙–莫雷实验</b>以及此后无数更精密的实验都表明：</p>`);
      ctx.callout('key', `<p style="font-size:18px"><b>无论光源和观察者如何运动，每个人测得的真空光速都是同一个值：c ≈ 299 792 458 m/s。</b></p><p>这就是 <span class="hl">光速不变原理</span>。1905 年，26 岁的爱因斯坦把它作为基本原理，建立了<b>狭义相对论</b>。</p>`, '🔑 光速不变原理');
      ctx.section('代价：时间不再绝对', `
        <p>如果光速对每个人都一样，那么总得有别的东西“让步”——这个东西就是<b>时间和空间</b>。我们用一个最简单的钟来说明：<span class="hl">光钟</span>。</p>`);
      lightClock(ctx);
      ctx.section('时间膨胀公式', `
        <p>设光钟镜间距为 <span class="m">L</span>。静止时光往返一次用时 <span class="m">Δt₀ = 2L/c</span>。飞船以速度 <span class="m">v</span> 运动时，从地面看光走了斜边，由勾股定理可以推出：</p>`);
      ctx.eq(`Δt = γ Δt<sub>0</sub>, &nbsp;&nbsp; γ = ${U.frac('1', U.sqrt('1 − v<sup>2</sup>/c<sup>2</sup>'))}`, 'γ 称为洛伦兹因子，总是 ≥ 1。运动的时钟走得慢——这叫“时间膨胀”');
      ctx.section(null, `
        <p>同时，运动物体沿运动方向的长度也会缩短为原来的 <span class="m">1/γ</span>（<b>长度收缩</b>）——你在上面的仿真里能看到飞船变“瘦”了。</p>
        <p>这不是钟坏了，也不是错觉，而是<b>时间本身</b>流逝得不同。实验早已证实：</p>
        <ul>
          <li>宇宙射线在高空产生的 μ 子寿命只有 2.2 微秒，本来飞不到地面，但因为速度接近光速、时间变慢，大量 μ 子能抵达地表被探测到。</li>
          <li>粒子加速器中接近光速的不稳定粒子，寿命精确地延长了 γ 倍。</li>
          <li>1971 年，科学家把原子钟放在飞机上环球飞行，飞回来后与地面钟的差异完全符合相对论预言。</li>
        </ul>`);
      twins(ctx);
      ctx.callout('think', `<p>弟弟可能会说：“从我的角度看，是地球在运动，应该是哥哥更年轻才对！”——这就是著名的<b>双生子佯谬</b>。</p><p>破解的关键：两人的处境<b>不对称</b>。弟弟必须掉头返回，经历了加速和减速，他不是一直处于惯性系中。计算表明，重逢时确实是弟弟更年轻。</p>`);
      ctx.section('光速是宇宙的速度上限', `
        <p>当 <span class="m">v → c</span> 时，γ → ∞。根据相对论，物体的能量为 <span class="m">E = γmc²</span>，把有质量的物体加速到光速需要<b>无穷大的能量</b>。因此：</p>
        <ul>
          <li><b>任何有质量的物体都不可能达到或超过光速。</b></li>
          <li>任何信息、任何信号的传播速度也都不能超过光速。</li>
        </ul>
        <p>这对理解黑洞至关重要：如果连光都无法从某个区域逃出，那么<b>任何东西</b>——飞船、粒子、无线电信号——都不可能逃出。这正是“黑洞”之所以“黑”的根本原因。</p>`);
      ctx.eq(`E = mc<sup>2</sup>`, '质量就是能量。1 克物质完全转化的能量 ≈ 9×10<sup>13</sup> J，相当于 2 万吨 TNT');
      ctx.callout('fact', `<p>质能方程在黑洞故事里无处不在：物质落入黑洞时，可以把约 <b>6%～42%</b> 的静质量转化为辐射能（取决于黑洞自转），效率远高于核聚变的 0.7%。这就是为什么类星体——由超大质量黑洞吞噬物质驱动——能比整个星系还亮。</p>`);
      ctx.section('时空：把时间和空间看成一个整体', `
        <p>狭义相对论告诉我们：不同运动状态的观察者，对“时间间隔”和“空间距离”的测量各不相同，但把它们组合成一个整体——<b>四维时空</b>——之后，某些量对所有人都是一样的。</p>
        <p>从此，时间和空间不再是舞台上固定不变的背景，而是可以伸缩、可以弯曲的“物理实体”。下一章我们将看到，<b>引力本身就是时空的弯曲</b>。</p>`);
      ctx.think('GPS 卫星以约 3.9 km/s 绕地球运行。仅考虑狭义相对论，它的钟每天比地面慢多少？',
        `γ − 1 ≈ v²/(2c²) = (3900)² / (2 × 9×10¹⁶) ≈ 8.4×10⁻¹¹，每天 86400 秒 × 8.4×10⁻¹¹ ≈ <b>7 微秒</b>。看起来很小，但光 7 微秒能走 2 km，如果不修正，GPS 定位每天会偏差数公里！（实际上还需要考虑广义相对论效应，第 7 章详解。）`);
      ctx.think('一艘飞船以 0.99c 飞行，船上的人看自己的手表，会觉得时间变慢了吗？',
        `不会。在飞船里的人看来，自己的手表、心跳、思维一切正常。时间膨胀是<b>不同参考系之间比较</b>的结果，没有“绝对”的慢。`);
    },
  });
})();
