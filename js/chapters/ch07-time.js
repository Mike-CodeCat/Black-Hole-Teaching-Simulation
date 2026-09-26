/* 第 7 章：引力时间膨胀与引力红移 */
(function () {
  'use strict';
  const P = U.PHYS;
  const fac = (r) => Math.sqrt(Math.max(0, 1 - 1 / r)); // 静止时钟相对无穷远的快慢

  /* ---------- 仿真 1：黑洞旁的时钟与光 ---------- */
  function clockLadder(ctx) {
    const s = ctx.sim({
      title: '黑洞旁的时钟：越靠近，时间越慢',
      desc: '一排静止悬停在黑洞外不同高度的时钟（假设飞船用火箭推力悬停）。拖动滑块移动橙色探测器，它会向远处的你发射一束绿色激光——注意光在爬出引力场时如何被“拉长”变红。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, maxHeight: 520 });
    let rp = 3;
    const ro = U.readouts(s.panel, [
      { key: 'f', label: '时钟快慢（相对远处）' },
      { key: 'z', label: '引力红移 z' },
      { key: 'yr', label: '远处过 1 年，这里过', wide: true },
      { key: 'lam', label: '发射 532 nm 绿光，远处收到', wide: true },
    ]);
    U.slider(s.panel, {
      label: '探测器位置 r', min: 1.0001, max: 30, value: rp, log: true,
      format: (v) => (v < 1.01 ? v.toFixed(4) : v.toFixed(2)) + ' r<sub>s</sub>',
      onInput: (v) => { rp = v; },
    });
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '钟面上的指针转速正比于 √(1 − r<sub>s</sub>/r)。在 1.0001 r<sub>s</sub> 处，时间比远处慢 100 倍。' }));
    const clocks = [1.02, 1.1, 1.5, 3, 8, 1e9];
    const angles = clocks.map(() => 0);
    let pAng = 0, phase = 0;
    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 位置映射：x = f(log(r−1))
      const x0 = 70, x1 = w - 90;
      const lr = (r) => Math.log10(Math.min(r, 60) - 1);
      const lo = lr(1.0001), hi = lr(60);
      const RX = (r) => x0 + ((lr(r) - lo) / (hi - lo)) * (x1 - x0);
      // 黑洞（左侧半个）
      const bhR = h * 0.42;
      const grd = g.createRadialGradient(x0 - bhR, h / 2, bhR * 0.95, x0 - bhR, h / 2, bhR * 1.3);
      grd.addColorStop(0, 'rgba(255,120,60,0.6)'); grd.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x0 - bhR, h / 2, bhR * 1.3, 0, 6.283); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(x0 - bhR, h / 2, bhR, 0, 6.283); g.fill();
      U.text(g, '事件视界', 8, 18, { size: 12, color: '#ff9a6b' });
      // 刻度
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.beginPath(); g.moveTo(x0, h * 0.86); g.lineTo(x1, h * 0.86); g.stroke();
      [1.001, 1.01, 1.1, 1.5, 2, 3, 5, 10, 30].forEach((r) => {
        const x = RX(r); g.beginPath(); g.moveTo(x, h * 0.86 - 4); g.lineTo(x, h * 0.86 + 4); g.stroke();
        U.text(g, r + '', x, h * 0.86 + 16, { align: 'center', size: 10, color: 'rgba(255,255,255,0.45)' });
      });
      U.text(g, 'r / rₛ（对数刻度）', x1, h * 0.86 + 32, { align: 'right', size: 10, color: 'rgba(255,255,255,0.45)' });
      // 时钟
      const clk = (x, y, rad, ang, col, label) => {
        g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.stroke();
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.beginPath(); g.moveTo(x + Math.cos(a) * rad * 0.8, y + Math.sin(a) * rad * 0.8); g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); g.stroke(); }
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang - 1.5708) * rad * 0.85, y + Math.sin(ang - 1.5708) * rad * 0.85); g.stroke();
        if (label) U.text(g, label, x, y + rad + 13, { align: 'center', size: 11, color: col });
      };
      clocks.forEach((r, i) => {
        angles[i] += dt * 1.6 * (r > 1e6 ? 1 : fac(r));
        const x = r > 1e6 ? w - 40 : RX(r);
        clk(x, h * 0.22, 17, angles[i], 'rgba(200,215,240,0.8)', r > 1e6 ? '无穷远' : r + ' rₛ');
      });
      // 探测器 + 光波
      pAng += dt * 1.6 * fac(rp);
      const px = RX(rp), py = h * 0.56;
      const ex = w - 40;
      phase += dt * 8;
      // 波：局部波长 λ(r) = λe · √(1−1/r)/√(1−1/re)，从 px 画到 ex
      g.lineWidth = 2;
      let xx = px + 14, ph = -phase;
      const lam0 = 16;
      let prev = null;
      while (xx < ex - 16) {
        // 由 x 反推 r
        const t = (xx - x0) / (x1 - x0);
        const r = 1 + Math.pow(10, lo + t * (hi - lo));
        const k = fac(Math.min(r, 1e6)) / Math.max(fac(rp), 1e-6);
        const lam = lam0 * Math.min(k, 40);
        ph += (2 * Math.PI * 2) / lam;
        const nm = 532 * Math.min(k, 100);
        const y = py + Math.sin(ph) * 10;
        if (prev) { g.strokeStyle = U.wavelengthRGB(nm, 0.9); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(xx, y); g.stroke(); }
        prev = [xx, y];
        xx += 2;
      }
      clk(px, py, 14, pAng, '#ffb454', null);
      U.text(g, '探测器', px, py - 26, { align: 'center', size: 12, color: '#ffb454' });
      U.text(g, '👁', ex + 8, py, { align: 'center', size: 20 });
      U.text(g, '远处的你', ex + 4, py + 24, { align: 'center', size: 11, color: 'rgba(255,255,255,0.6)' });
      // 读数
      const f = fac(rp);
      ro.set('f', f.toFixed(4) + ' 倍');
      ro.set('z', U.sci(1 / f - 1, 3));
      const days = 365.25 * f;
      ro.set('yr', days < 1 ? (days * 24).toFixed(2) + ' 小时' : days < 360 ? days.toFixed(1) + ' 天' : (days / 365.25).toFixed(4) + ' 年');
      const nm = 532 / f;
      const band = nm < 750 ? '可见光' : nm < 1e6 ? '红外线' : '微波/无线电';
      ro.set('lam', `${U.sci(nm, 4)} nm（${band}）`);
    }, s.box);
  }

  /* ---------- 仿真 2：坠入黑洞的宇航员——两种视角 ---------- */
  function infall(ctx) {
    const s = ctx.sim({
      title: '坠入黑洞：宇航员的视角 vs 远方观察者的视角',
      desc: '宇航员从 10 r<sub>s</sub> 处由静止开始自由下落。左边按<b>宇航员自己的手表</b>播放，右边按<b>远方观察者的手表</b>播放，显示的是观察者真正“看到”的画面（考虑了光的传播时间和红移）。',
      wide: true,
    });
    const wrap = U.el('div', { class: 'split-stage' });
    s.stage.appendChild(wrap);
    const A = U.el('div'), B = U.el('div');
    wrap.append(A, B);
    const cA = U.canvas(A, { aspect: 4 / 3.4, maxHeight: 480 });
    const cB = U.canvas(B, { aspect: 4 / 3.4, maxHeight: 480 });
    const r0 = 10, robs = 60;
    // 预计算下落轨迹（摆线参数化，单位 r_s=1, c=1）
    const E = Math.sqrt(1 - 1 / r0);
    const table = []; // {tau, r, t}
    {
      let t = 0, prevTau = 0, prevR = r0;
      const N = 200000;
      for (let i = 0; i <= N; i++) {
        const eta = (Math.PI * i) / N;
        const r = (r0 / 2) * (1 + Math.cos(eta));
        const tau = (Math.pow(r0, 1.5) / 2) * (eta + Math.sin(eta));
        if (i > 0 && r > 1.000001) {
          const rm = (r + prevR) / 2;
          t += (E / (1 - 1 / rm)) * (tau - prevTau);
        }
        table.push({ tau, r, t: r > 1.000001 ? t : Infinity });
        prevTau = tau; prevR = r;
      }
    }
    const tauH = table.find((e) => e.r <= 1).tau; // 穿过视界时的固有时
    const tauEnd = (Math.PI * Math.pow(r0, 1.5)) / 2;
    const rstar = (r) => r + Math.log(r - 1);
    // 观察者接收时刻 T(τ) = t + r*(robs) − r*(r)
    const recv = table.map((e) => (e.r > 1.000001 ? e.t + rstar(robs) - rstar(e.r) : Infinity));
    const T0 = recv[0];
    function emissionAt(T) { // 观察者在时刻 T 收到的是哪个事件发出的光
      if (T <= T0) return 0;
      let lo = 0, hi = recv.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (recv[m] <= T) lo = m; else hi = m; }
      return lo;
    }
    let Mbh = 10, rate = 1, tA = 0, tB = 0, playing = true;
    const ro = U.readouts(s.panel, [
      { key: 'tH', label: '宇航员：到达视界用时' },
      { key: 'tE', label: '宇航员：到达奇点用时' },
      { key: 'tObs', label: '观察者：看到宇航员“到达”视界', wide: true },
    ]);
    U.slider(s.panel, { label: '黑洞质量', min: 1, max: 1e9, value: Mbh, log: true, format: (v) => U.sci(v, 2) + ' M☉', onInput: (v) => { Mbh = v; } });
    U.slider(s.panel, { label: '播放速度', min: 0.25, max: 4, step: 0.05, value: 1, format: (v) => v.toFixed(2) + '×', onInput: (v) => { rate = v; } });
    U.buttons(s.panel, [
      { label: '↺ 重新开始', primary: true, onClick: () => { tA = tB = 0; playing = true; } },
      { label: '⏯ 暂停/继续', onClick: () => { playing = !playing; } },
    ]);
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '两个画面的“播放时钟”以相同速率走动，但分别代表宇航员和观察者各自的时间。' }));

    const drawScene = (cv, r, label, tauShown, color, alpha, extra) => {
      const { ctx: g, w, h } = cv;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      const sc = (h * 0.8) / (r0 + 1.5);
      const bx = w / 2, by = h * 0.92 - sc; // 黑洞中心
      // 视界
      const gr = g.createRadialGradient(bx, by + sc * 0, sc * 0.95, bx, by, sc * 1.5);
      gr.addColorStop(0, 'rgba(255,120,60,0.55)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(bx, by, sc * 1.5, 0, 6.283); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(bx, by, sc, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,120,60,0.8)'; g.setLineDash([4, 4]); g.beginPath(); g.arc(bx, by, sc, 0, 6.283); g.stroke(); g.setLineDash([]);
      U.glowCircle(g, bx, by, 2, '#fff', 6);
      // 高度刻度
      for (let k = 2; k <= r0; k += 2) { const y = by - k * sc; g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx + sc * 1.6, y, 6, 1); U.text(g, k + ' rₛ', bx + sc * 1.6 + 10, y, { size: 10, color: 'rgba(255,255,255,0.35)' }); }
      // 宇航员
      if (r != null && alpha > 0.002) {
        const y = by - r * sc;
        g.save(); g.globalAlpha = alpha;
        U.glowCircle(g, bx, y, 6, color, 22);
        g.restore();
      }
      U.text(g, label, 12, 18, { size: 13, color: '#fff' });
      U.text(g, '宇航员手表：' + tauShown, 12, 40, { size: 13, color: '#ffb454' });
      if (extra) U.text(g, extra, 12, 62, { size: 12, color: 'rgba(255,255,255,0.65)' });
    };

    ctx.loop((dt) => {
      const unit = (U.rs(Mbh * P.Msun) / P.c); // 1 个 r_s/c 对应的秒数
      const fmtT = (x) => U.plain(U.duration(x * unit));
      if (playing) { tA += dt * 6 * rate; tB += dt * 6 * rate; }
      // 左：宇航员视角（固有时）
      const tau = Math.min(tA, tauEnd);
      let lo = 0, hi = table.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m].tau < tau) lo = m; else hi = m; }
      const idx = hi;
      const rA = table[idx].r;
      const stA = rA > 1 ? '正在下落… 感觉一切正常' : rA > 0.01 ? '已穿过视界！再也无法回头' : '抵达奇点';
      drawScene(cA, rA > 0.01 ? rA : null, '① 宇航员自己的经历', fmtT(tau), '#ffd9a0', 1, stA);
      // 右：观察者视角（坐标时 + 光传播）
      const T = T0 + tB;
      const k = emissionAt(T);
      const e = table[k];
      // 红移：1+z = dT_obs/dτ_e × √(1 − 1/robs)
      const k2 = Math.min(k + 50, table.length - 1);
      let onePlusZ = 1;
      if (k2 > k && isFinite(recv[k2])) onePlusZ = ((recv[k2] - recv[k]) / (table[k2].tau - table[k].tau)) * fac(robs);
      else onePlusZ = 1e6;
      onePlusZ = Math.max(onePlusZ, 1);
      const nm = 470 * onePlusZ; // 发射蓝光，观察红移过程
      const alpha = Math.min(1, 1 / Math.pow(onePlusZ, 2));
      const extra = onePlusZ > 50 ? '看起来：几乎静止、极其暗淡、红到看不见' : `看起来：颜色 ${nm < 780 ? '偏红' : '已移出可见光'}，红移 z = ${(onePlusZ - 1).toFixed(2)}`;
      drawScene(cB, e.r, '② 远方观察者看到的画面', fmtT(e.tau), U.wavelengthRGB(Math.min(nm, 900)), alpha, extra);
      ro.set('tH', U.duration(tauH * unit));
      ro.set('tE', U.duration(tauEnd * unit));
      ro.set('tObs', '<span style="color:#ff9a6b">永远等不到</span>（画面越来越慢、越来越红、越来越暗）');
    }, s.box);
  }

  App.chapter({
    id: 'time', num: 7, part: 'B',
    title: '引力时间膨胀与红移',
    subtitle: '引力不仅弯曲空间，还会让时间变慢。在黑洞的视界上，时间仿佛“冻结”了。',
    summary: '越靠近大质量天体，时间走得越慢；光爬出引力场会变红。视界处时间“冻结”。',
    sims: ['黑洞旁的时钟', '坠入黑洞的两种视角'],
    goals: ['引力时间膨胀公式', '引力红移', 'GPS 为什么需要相对论', '视界处的“冻结”', '《星际穿越》的米勒星球'],
    build(ctx) {
      ctx.section('引力让时间变慢', `
        <p>第 2 章我们看到，运动会让时钟变慢。广义相对论揭示了另一种时间膨胀：<b>处在引力场越深处的时钟，走得越慢</b>。对于史瓦西黑洞外一个静止的时钟：</p>`);
      ctx.eq(`Δt<sub>近</sub> = Δt<sub>远</sub> · ${U.sqrt('1 − ' + U.frac('r<sub>s</sub>', 'r'))}`, '当 r → r<sub>s</sub> 时，根号内趋于 0：从远处看，视界上的时钟完全停止');
      ctx.section(null, `<p>这不是“时钟被引力压坏了”，而是时间本身流逝的速率不同。实际上，日常生活中我们感受到的“引力”，绝大部分正是来自这种<b>时间的弯曲</b>：物体总是倾向于往时间走得更慢的地方“掉”。</p>`);
      clockLadder(ctx);
      ctx.section('引力红移：光爬出引力场会变“累”', `
        <p>光波的振动也是一种“时钟”。在引力深处发出的光，它的每一次振动在远方看来都被拉长了，所以频率降低、波长变长——<span class="hl">引力红移</span>：</p>`);
      ctx.eq(`1 + z = ${U.frac('λ<sub>收到</sub>', 'λ<sub>发出</sub>')} = ${U.frac('1', U.sqrt('1 − r<sub>s</sub>/r'))}`, '注意：光速并没有变慢，改变的是频率和波长');
      ctx.callout('fact', `<p><b>在地球上就能测到！</b>1959 年，哈佛大学的庞德和雷布卡让伽马射线在 22.5 米高的塔中上下传播，测到了 2.5×10<sup>−15</sup> 的频率变化，与广义相对论预言一致。2010 年，美国国家标准与技术研究院用光学原子钟测到：<b>把钟抬高 33 厘米，它就走得快一点点</b>。</p>`);
      ctx.section('你的手机导航离不开相对论', `
        <p>GPS 卫星在距地面约 20 200 km 的轨道上运行，每颗卫星都带着极其精确的原子钟。相对论对它们有两个方向相反的效应：</p>
        <table>
          <tr><th>效应</th><th>原因</th><th>每天的时间差</th></tr>
          <tr><td>狭义相对论（运动）</td><td>卫星速度约 3.9 km/s，钟变慢</td><td>−7 微秒</td></tr>
          <tr><td>广义相对论（引力）</td><td>卫星处引力更弱，钟变快</td><td>+45 微秒</td></tr>
          <tr><td><b>合计</b></td><td></td><td><b>+38 微秒</b></td></tr>
        </table>
        <p>光在 38 微秒内能走 11 公里。如果工程师不在卫星发射前把原子钟的频率调慢一点来抵消这个效应，GPS 定位误差每天会累积约 10 公里！</p>`);
      ctx.section('坠入黑洞：两个截然不同的故事', `
        <p>现在来做一个著名的思想实验：一位宇航员从远处落向黑洞，同时一直向远方的同伴发送信号。两个人经历的“故事”完全不同——</p>`);
      infall(ctx);
      ctx.section(null, `
        <ul>
          <li><b>宇航员自己</b>：手表正常地走，几毫秒（恒星级黑洞）或几小时（超大质量黑洞）后就穿过了视界。穿过时没有任何特殊感觉——没有墙、没有标志。然后在有限的时间内到达中心。</li>
          <li><b>远方的同伴</b>：看到宇航员下落得越来越慢，信号的颜色越来越红、越来越暗，最终“凝固”在视界上方，永远不会看到他穿过视界。当然，实际上图像会在极短时间内暗淡到无法探测。</li>
        </ul>
        <p>两种描述都是正确的——它们只是不同参考系下的观测结果。这正是“事件视界”一词的由来：视界内发生的事件，外面永远不可能观察到。早期黑洞也因此被苏联物理学家称为“<b>冻结的星</b>”。</p>`);
      ctx.callout('fact', `<p><b>《星际穿越》的米勒星球</b>：电影中，米勒星球绕着超大质量黑洞“卡冈图雅”运行，在星球上待 1 小时，外面就过了 7 年——时间变慢了约 6 万倍。</p><p>对于不旋转的黑洞，稳定轨道最近只能到 3 r<sub>s</sub>，那里的时间最多只慢约 1.4 倍（引力与轨道运动合计）。电影的科学顾问、2017 年诺贝尔奖得主基普·索恩指出：只有当黑洞以<b>接近极限的速度自转</b>时，稳定轨道才能极其靠近视界，从而产生如此夸张的时间膨胀。</p>`);
      ctx.callout('key', '<p>① 引力越强处时间越慢：Δt<sub>近</sub> = Δt<sub>远</sub>√(1 − r<sub>s</sub>/r)；② 从引力深处发出的光会红移；③ GPS 每天必须修正 38 微秒；④ 远方观察者永远看不到物体穿过视界，但下落者自己会在有限时间内穿过。</p>');
      ctx.think('如果你悬停在 1.01 r<sub>s</sub> 处一年，然后回到远处，外面过了多久？',
        '√(1 − 1/1.01) = √(0.0099) ≈ 0.0995，所以外面过了约 1 / 0.0995 ≈ <b>10 年</b>。这就是一种“单程穿越到未来”的时间机器——代价是悬停所需的推力极其巨大。');
      ctx.think('宇航员在下落过程中回头看宇宙，会看到外面的时间“快进”吗？',
        '对于<b>悬停</b>在视界附近的观察者，外面的光会蓝移，确实看到外部宇宙加速。但对于<b>自由下落</b>的宇航员，情况要微妙得多：由于他自身也在高速下落，多普勒红移部分抵消了引力蓝移，他并不会在穿越视界前看到“宇宙的全部未来”。');
    },
  });
})();
