/* 第 6 章：黑洞周围的轨道 */
(function () {
  'use strict';
  // 单位：r_s = 1，GM/c² = 0.5；时间为固有时（单位 r_s/c）
  const V = (r, L) => (1 - 1 / r) * (1 + (L * L) / (r * r)); // 相对论有效势（E² 形式）
  const VN = (r, L) => 1 - 1 / r + (L * L) / (r * r); // 对应的牛顿有效势
  const Lcirc = (r) => Math.sqrt((0.5 * r * r) / (r - 1.5)); // 圆轨道角动量
  function critL(r0) { // 使 V(r0) 恰好等于势垒顶的 L —— 用于 zoom-whirl 轨道
    const peak = (L) => { let b = 0; for (let r = 1.2; r < 3.2; r += 0.001) b = Math.max(b, V(r, L)); return b; };
    let lo = Math.sqrt(3), hi = 3;
    for (let i = 0; i < 50; i++) { const L = (lo + hi) / 2; if (V(r0, L) > peak(L)) lo = L; else hi = L; }
    return lo;
  }

  function orbitSim(ctx) {
    const s = ctx.sim({
      title: '轨道模拟器：广义相对论 vs 牛顿',
      desc: '在距黑洞 r₀ 处以一定的切向速度释放一个小天体。彩色轨迹是广义相对论的计算结果，灰色虚线是相同初始条件下牛顿引力的轨迹。右侧是“有效势能”曲线：小球就像在这条曲线上滚动的弹珠。',
      wide: true,
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 9, minHeight: 340, maxHeight: 600 });
    let r0 = 20, f = 0.75, speed = 1, showN = true;
    const ro = U.readouts(s.panel, [
      { key: 'r', label: '当前距离 r' },
      { key: 'L', label: '角动量 L' },
      { key: 'prec', label: '每圈近心点进动', wide: true },
      { key: 'state', label: '状态', wide: true },
    ]);
    const slR = U.slider(s.panel, { label: '初始距离 r₀', min: 2.6, max: 25, step: 0.01, value: r0, format: (v) => v.toFixed(2) + ' r<sub>s</sub>', onInput: (v) => { r0 = v; reset(); } });
    const slF = U.slider(s.panel, { label: '切向速度（相对圆轨道速度）', min: 0, max: 1.3, step: 0.0001, value: f, format: (v) => (v * 100).toFixed(2) + '%', onInput: (v) => { f = v; reset(); } });
    U.slider(s.panel, { label: '播放速度', min: 0.2, max: 5, step: 0.1, value: 1, format: (v) => v.toFixed(1) + '×', onInput: (v) => { speed = v; } });
    U.toggle(s.panel, { label: '显示牛顿引力对比轨迹', value: true, onChange: (v) => { showN = v; } });
    s.panel.appendChild(U.el('div', { class: 'panel-title', text: '典型轨道' }));
    const preset = (r, ff) => { slR.set(r, false); r0 = r; slF.set(ff, false); f = ff; reset(); };
    U.buttons(s.panel, [
      { label: '稳定圆轨道', onClick: () => preset(10, 1) },
      { label: '进动椭圆', onClick: () => preset(20, 0.75) },
      { label: 'ISCO（3 r<sub>s</sub>）', onClick: () => preset(3, 1) },
      { label: '缩放–旋转', onClick: () => preset(16, (critL(16) + 0.0012) / Lcirc(16)) },
      { label: '坠入黑洞', onClick: () => preset(20, 0.55) },
    ]);

    let st, nw, trail, trailN, peri, lastR, lastDr, precList, dead;
    function reset() {
      const L = f * Lcirc(r0);
      st = { x: r0, y: 0, vx: 0, vy: L / r0, L };
      nw = { x: r0, y: 0, vx: 0, vy: L / r0 };
      trail = []; trailN = []; peri = []; precList = []; lastR = r0; lastDr = 0; dead = false;
    }
    reset();
    const accel = (x, y, L, gr) => {
      const r2 = x * x + y * y, r = Math.sqrt(r2);
      const k = -0.5 / (r2 * r) - (gr ? (1.5 * L * L) / (r2 * r2 * r) : 0);
      return [k * x, k * y];
    };
    const leap = (p, dt, L, gr) => {
      let [ax, ay] = accel(p.x, p.y, L, gr);
      p.vx += (ax * dt) / 2; p.vy += (ay * dt) / 2;
      p.x += p.vx * dt; p.y += p.vy * dt;
      [ax, ay] = accel(p.x, p.y, L, gr);
      p.vx += (ax * dt) / 2; p.vy += (ay * dt) / 2;
    };

    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      // 积分：每帧推进固定的固有时
      let T = dt * 60 * speed;
      while (T > 0 && !dead) {
        const r = Math.hypot(st.x, st.y);
        const d = Math.min(T, 0.004 * Math.pow(r, 1.5) + 0.0005);
        leap(st, d, st.L, true);
        T -= d;
        const nr = Math.hypot(st.x, st.y);
        const dr = nr - lastR;
        if (lastDr < 0 && dr >= 0) { // 近心点
          peri.push(Math.atan2(st.y, st.x));
          if (peri.length >= 2) {
            let dphi = peri[peri.length - 1] - peri[peri.length - 2];
            while (dphi < 0) dphi += 2 * Math.PI;
            precList.push(dphi);
          }
        }
        lastDr = dr; lastR = nr;
        if (nr < 1) dead = true;
      }
      if (showN) {
        let TN = dt * 60 * speed;
        while (TN > 0) {
          const r = Math.hypot(nw.x, nw.y);
          if (r < 0.3 || r > 200) break;
          const d = Math.min(TN, 0.004 * Math.pow(r, 1.5) + 0.0005);
          leap(nw, d, 0, false); TN -= d;
        }
        trailN.push([nw.x, nw.y]); if (trailN.length > 1500) trailN.shift();
      }
      trail.push([st.x, st.y]); if (trail.length > 2500) trail.shift();

      // 绘制
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      const ow = w * 0.6;
      const sc = Math.min(ow, h) / 2 / Math.max(8, r0 * 1.12);
      const cx = ow / 2, cy = h / 2;
      const X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
      // 参考圆
      const circ = (r, col, dash) => { g.strokeStyle = col; g.setLineDash(dash || []); g.beginPath(); g.arc(cx, cy, r * sc, 0, 6.283); g.stroke(); g.setLineDash([]); };
      g.lineWidth = 1;
      circ(3, 'rgba(92,200,255,0.45)', [5, 5]);
      circ(1.5, 'rgba(255,224,102,0.4)', [2, 4]);
      if (showN && trailN.length > 1) {
        g.strokeStyle = 'rgba(200,200,220,0.35)'; g.setLineDash([3, 4]);
        g.beginPath(); trailN.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); g.setLineDash([]);
      }
      // 彩色渐变轨迹
      g.lineWidth = 2;
      for (let i = 1; i < trail.length; i++) {
        const a = i / trail.length;
        g.strokeStyle = `hsla(${30 + 200 * (1 - a)},95%,60%,${0.15 + 0.85 * a})`;
        g.beginPath(); g.moveTo(X(trail[i - 1][0]), Y(trail[i - 1][1])); g.lineTo(X(trail[i][0]), Y(trail[i][1])); g.stroke();
      }
      U.drawBH(g, cx, cy, sc, 0);
      if (!dead) U.glowCircle(g, X(st.x), Y(st.y), 5, '#fff', 16);
      U.text(g, '蓝虚线：ISCO 3 rₛ   黄虚线：光子球 1.5 rₛ', 12, h - 14, { size: 11, color: 'rgba(255,255,255,0.45)' });

      // 有效势图
      const px = ow + 20, pw = w - ow - 36, py = 40, ph = h - 90;
      g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(ow, 0, w - ow, h);
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(ow, 0); g.lineTo(ow, h); g.stroke();
      const rMaxP = Math.max(12, r0 * 1.3);
      const E2 = V(r0, st.L);
      const vmin = Math.min(0.8, E2 - 0.08), vmax = Math.max(1.05, E2 + 0.05);
      const PX = (r) => px + ((r - 1) / (rMaxP - 1)) * pw;
      const PY = (v) => py + ph - ((v - vmin) / (vmax - vmin)) * ph;
      U.plotFrame(g, { x: px, y: py, w: pw, h: ph }, { xlabel: '距离 r / rₛ →', ylabel: '有效势能' });
      const curve = (fn, col, dash) => {
        g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(dash || []);
        g.beginPath();
        let started = false;
        for (let i = 0; i <= 300; i++) {
          const r = 1 + ((rMaxP - 1) * i) / 300;
          const v = fn(r);
          const yv = PY(v);
          if (yv < py - 20 || yv > py + ph + 20) { started = false; continue; }
          started ? g.lineTo(PX(r), yv) : g.moveTo(PX(r), yv);
          started = true;
        }
        g.stroke(); g.setLineDash([]);
      };
      g.save(); g.beginPath(); g.rect(px, py - 10, pw, ph + 10); g.clip();
      if (showN) curve((r) => VN(r, st.L), 'rgba(200,200,220,0.4)', [4, 4]);
      curve((r) => V(r, st.L), '#ffb454');
      g.strokeStyle = '#5cc8ff'; g.setLineDash([6, 4]); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(px, PY(E2)); g.lineTo(px + pw, PY(E2)); g.stroke(); g.setLineDash([]);
      const rc = Math.hypot(st.x, st.y);
      if (!dead && rc < rMaxP) U.glowCircle(g, PX(rc), PY(V(rc, st.L)), 6, '#fff', 14);
      g.restore();
      U.text(g, '橙：广义相对论　灰：牛顿　蓝：粒子能量', px, py + ph + 30, { size: 11, color: 'rgba(255,255,255,0.55)' });
      U.text(g, '粒子只能在 蓝线 ≥ 橙线 的区域运动', px, py + ph + 46, { size: 11, color: 'rgba(255,255,255,0.4)' });

      // 读数
      ro.set('r', dead ? '—' : rc.toFixed(2) + ' r<sub>s</sub>');
      ro.set('L', st.L.toFixed(3));
      if (precList.length) {
        const avg = precList.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, precList.length);
        ro.set('prec', ((avg * 180) / Math.PI - 360).toFixed(1) + '°');
      } else ro.set('prec', '测量中…');
      let stt;
      if (dead) stt = '<span style="color:#ff6b3d">已坠入黑洞！</span>';
      else if (st.L < Math.sqrt(3) - 1e-4) stt = '角动量低于 √3：不存在稳定轨道，终将坠入';
      else if (E2 > 1) stt = '能量 > 静止能量：非束缚轨道，可能逃逸';
      else stt = '束缚轨道';
      ro.set('state', stt);
    }, s.box);
  }

  App.chapter({
    id: 'orbits', num: 6, part: 'B',
    title: '黑洞周围的轨道',
    subtitle: '在黑洞附近，行星轨道不再是封闭的椭圆：它会进动、会“缩放旋转”，太靠近就会一头栽进去。',
    summary: '有效势能、近日点进动、最内稳定圆轨道与“缩放–旋转”轨道。',
    sims: ['轨道模拟器'],
    goals: ['开普勒轨道与有效势能', '水星近日点进动', '为什么存在 ISCO', '缩放–旋转轨道', '银河系中心的 S2 星'],
    build(ctx) {
      ctx.section('牛顿的完美椭圆', `
        <p>在牛顿引力中，行星绕太阳的轨道是一个<b>封闭的椭圆</b>：绕一圈后精确地回到出发点，然后一遍又一遍重复同样的路径（开普勒第一定律）。</p>
        <p>分析轨道有一个很有用的工具——<span class="hl">有效势能</span>。把行星的运动拆成“绕圈”和“远近”两部分，远近方向的运动就像一颗弹珠在一条曲线上滚动：</p>`);
      ctx.eq(`V<sub>牛顿</sub>(r) = −${U.frac('GMm', 'r')} + ${U.frac('L<sup>2</sup>', '2mr<sup>2</sup>')}`, '第一项是引力势能（把行星往里拉），第二项是“离心势垒”（角动量让行星不容易靠近中心）');
      ctx.section(null, `<p>牛顿的离心势垒在 r → 0 时变成无穷高，所以只要有一点点角动量，行星就永远撞不到中心点。</p>
        <p>广义相对论给有效势能增加了一项新的吸引项：</p>`);
      ctx.eq(`V<sub>GR</sub>(r) = −${U.frac('GMm', 'r')} + ${U.frac('L<sup>2</sup>', '2mr<sup>2</sup>')} − ${U.frac('GML<sup>2</sup>', 'mc<sup>2</sup>r<sup>3</sup>')}`, '新增的 −1/r³ 项在远处可以忽略，但在靠近黑洞时压倒一切');
      ctx.section(null, `<p>这一项带来了三个重要后果：① 轨道不再封闭，会发生<b>进动</b>；② 离心势垒有一个“顶”，能量高过它的物体会<b>坠入黑洞</b>；③ 存在一个<b>最内稳定圆轨道</b>。在下面的模拟器里亲眼看看吧。</p>`);
      orbitSim(ctx);
      ctx.callout('tip', `<p>建议依次点击五个“典型轨道”按钮：</p><ul>
        <li><b>进动椭圆</b>：注意近心点每圈都往前挪，轨迹画出一朵“玫瑰花”。而灰色的牛顿轨道始终是同一个椭圆。</li>
        <li><b>ISCO</b>：3 r<sub>s</sub> 处的圆轨道处于“稳定的边缘”，数值误差这么小的扰动都可能让它最终坠落。</li>
        <li><b>缩放–旋转</b>：天体从远处“冲”进来，在黑洞附近急速绕好几圈，再“弹”回远处——这种奇特的轨道在牛顿引力中不可能出现。</li></ul>`);
      ctx.section('近日点进动：广义相对论的第一次胜利', `
        <p>早在 19 世纪，天文学家就发现水星的近日点每世纪会前移 574 角秒，其中 531″ 可以用其他行星的引力扰动解释，但剩下的 <b>43″</b> 怎么也解释不了。有人甚至猜测太阳附近还有一颗看不见的“祝融星”。</p>
        <p>1915 年，爱因斯坦用刚刚完成的广义相对论计算出每圈的额外进动：</p>`);
      ctx.eq(`Δφ = ${U.frac('6πGM', 'c<sup>2</sup>a(1 − e<sup>2</sup>)')}`, 'a 为半长轴，e 为偏心率。对水星，累计一个世纪恰好是 43″');
      ctx.section(null, `<p>爱因斯坦后来回忆，得到这个结果时他“兴奋得好几天说不出话来”。在黑洞附近，这个效应被放大到极致——模拟器中每圈进动几十度甚至上百度。</p>`);
      ctx.section('为什么存在“最内稳定圆轨道”？', `
        <p>圆轨道对应有效势能曲线的<b>谷底</b>（稳定）或<b>峰顶</b>（不稳定）。当角动量减小时，谷底和峰顶逐渐靠近，在 <span class="m">L = √3 · r<sub>s</sub>c</span> 时二者合并——对应的半径就是 <b>r = 3 r<sub>s</sub></b>。再往里，就再也没有谷底了。</p>
        <p>这意味着：吸积盘中的气体一旦越过 ISCO，就会在几圈之内螺旋坠入黑洞。所以吸积盘有一个清晰的内边缘，这对黑洞的观测特征至关重要。</p>`);
      ctx.callout('fact', `<p><b>S2 星：在银河系中心检验广义相对论</b></p><p>天文学家对银河系中心的恒星进行了 30 年的追踪，发现它们都绕着一个看不见的点高速运动。其中 S2 星每 16 年绕一圈，最近时离中心只有 120 天文单位，速度达到光速的 2.7%。由其轨道推算出中心天体质量约 <b>430 万倍太阳质量</b>，却挤在比太阳系还小的空间里——只能是黑洞。</p><p>2020 年，GRAVITY 合作组测到了 S2 星轨道的<b>史瓦西进动</b>（每圈约 12′），与广义相对论预言完全一致。莱因哈德·根策尔和安德烈娅·格兹因此获得 2020 年诺贝尔物理学奖。</p>`);
      ctx.callout('key', '<p>① 广义相对论使轨道进动（不再封闭）；② 有效势能中的 −1/r³ 项让离心势垒有了“顶”，物体可以越过它坠入黑洞；③ 史瓦西黑洞的 ISCO 在 3 r<sub>s</sub>，这是吸积盘的内边缘。</p>');
      ctx.think('为什么在牛顿引力中，彗星不会“坠入”太阳，除非它几乎正对着太阳飞来？',
        '牛顿的离心势垒 L²/(2mr²) 在 r→0 时趋于无穷，只要角动量不为零，彗星就会在某个距离被“弹回”。只有角动量极小（几乎正对着飞来）时，近日点才会小于太阳半径而撞上太阳。');
      ctx.think('一个物体在 2 r<sub>s</sub> 处（光子球外侧）以光速的 99% 沿切线方向运动，它能逃离黑洞吗？',
        '<b>能</b>。此时 γ ≈ 7.1，单位质量的能量 E = γ√(1 − r<sub>s</sub>/r) ≈ 5.0 &gt; 1（非束缚），角动量 L = γvr ≈ 14 r<sub>s</sub>c。有效势能的峰顶在约 1.5 r<sub>s</sub> 处，高于 E²，而物体正位于峰顶外侧的“下坡”上，所以会一路向外飞走。但如果同样的速度出现在 1.5 r<sub>s</sub> 以内，无论切向速度多大都会坠入。');
    },
  });
})();
