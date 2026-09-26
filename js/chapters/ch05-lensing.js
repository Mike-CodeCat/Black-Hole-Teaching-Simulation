/* 第 5 章：光线弯曲与引力透镜 */
(function () {
  'use strict';
  const BC = 1.5 * Math.sqrt(3); // 临界碰撞参数 b_c = (3√3/2) r_s ≈ 2.598 r_s

  // 光子运动方程（单位 r_s = 1）：a = −1.5 h² x / r⁵
  function stepRK4(p, dl) {
    const f = (x, y, vx, vy) => {
      const r2 = x * x + y * y;
      const k = (-1.5 * p.h2) / Math.pow(r2, 2.5);
      return [vx, vy, k * x, k * y];
    };
    const { x, y, vx, vy } = p;
    const k1 = f(x, y, vx, vy);
    const k2 = f(x + (k1[0] * dl) / 2, y + (k1[1] * dl) / 2, vx + (k1[2] * dl) / 2, vy + (k1[3] * dl) / 2);
    const k3 = f(x + (k2[0] * dl) / 2, y + (k2[1] * dl) / 2, vx + (k2[2] * dl) / 2, vy + (k2[3] * dl) / 2);
    const k4 = f(x + k3[0] * dl, y + k3[1] * dl, vx + k3[2] * dl, vy + k3[3] * dl);
    p.x += (dl / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    p.y += (dl / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    p.vx += (dl / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    p.vy += (dl / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
  }
  function makePhoton(x, y, dx, dy, col) {
    const l = Math.hypot(dx, dy);
    dx /= l; dy /= l;
    const h = x * dy - y * dx;
    return { x, y, vx: dx, vy: dy, h2: h * h, trail: [[x, y]], alive: true, col, fate: null, laps: 0, ang0: Math.atan2(y, x), angAcc: 0 };
  }

  /** 高精度计算碰撞参数为 b 的光线的总偏折角（从无穷远到无穷远） */
  function deflection(b) {
    const p = makePhoton(-5000, b, 1, 0, '');
    let acc = 0;
    for (let i = 0; i < 200000; i++) {
      const r = Math.hypot(p.x, p.y);
      const a0 = Math.atan2(p.y, p.x);
      stepRK4(p, U.clamp(0.004 * r, 0.001, 40));
      let da = Math.atan2(p.y, p.x) - a0;
      if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      acc += da;
      const nr = Math.hypot(p.x, p.y);
      if (nr < 1) return null;
      if (Math.abs(acc) > 60) return Infinity;
      if (nr > 5000 && p.x * p.vx + p.y * p.vy > 0) break;
    }
    // 起止点并非真正的无穷远，补上两端缺失的扫过角 asin(b/R)
    return (Math.abs(acc) - Math.PI + 2 * Math.asin(Math.min(1, b / 5000))) * 180 / Math.PI;
  }

  function rayTracer2D(ctx) {
    const s = ctx.sim({
      title: '光线追踪器：看光如何绕过黑洞',
      desc: '每条线都是一个光子在史瓦西黑洞附近的真实运动轨迹（数值求解广义相对论光子轨道方程）。黑色圆盘是事件视界，黄色虚线是光子球（1.5 r<sub>s</sub>）。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 10, maxHeight: 620 });
    let mode = 'beam', b = 3.2, photons = [], src = { x: -6, y: 3 };
    const ro = U.readouts(s.panel, [
      { key: 'b', label: '碰撞参数 b' },
      { key: 'bc', label: '临界值 b<sub>c</sub>' },
      { key: 'def', label: '实际偏折角', wide: true },
      { key: 'weak', label: '弱场近似 2r<sub>s</sub>/b', wide: true },
      { key: 'fate', label: '光子命运', wide: true },
    ]);
    U.segmented(s.panel, {
      label: '光源模式', value: mode,
      options: [{ value: 'beam', label: '平行光束' }, { value: 'single', label: '单束光' }, { value: 'point', label: '点光源' }],
      onChange: (v) => { mode = v; launch(); },
    });
    const sl = U.slider(s.panel, {
      label: '单束光的碰撞参数 b', min: 0, max: 10, step: 0.001, value: b,
      format: (v) => v.toFixed(3) + ' r<sub>s</sub>',
      onInput: (v) => { b = v; if (mode === 'single') launch(); },
      hint: '碰撞参数 = 光线若不弯曲时离黑洞中心的最近距离',
    });
    U.buttons(s.panel, [
      { label: '▶ 重新发射', primary: true, onClick: () => launch() },
      { label: '贴近临界值', onClick: () => { mode === 'single' || segSet('single'); sl.set(BC + 0.002); } },
    ]);
    function segSet(v) { s.panel.querySelectorAll('.segmented button')[['beam', 'single', 'point'].indexOf(v)].click(); }
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', text: '点光源模式下，点击画面可移动光源位置。' }));
    ro.set('bc', BC.toFixed(3) + ' r<sub>s</sub>');

    let defl = null;
    function launch() {
      photons = [];
      if (mode === 'single') defl = deflection(b);
      if (mode === 'beam') {
        for (let yy = -8; yy <= 8.001; yy += 0.4) photons.push(makePhoton(-22, yy, 1, 0, Math.abs(yy) < BC ? '#ff6b3d' : '#ffd08a'));
        [BC + 0.01, -BC - 0.01, BC + 0.05, -BC - 0.05].forEach((yy) => photons.push(makePhoton(-22, yy, 1, 0, '#fff6c0')));
      } else if (mode === 'single') {
        photons.push(makePhoton(-22, b, 1, 0, b < BC ? '#ff6b3d' : '#5cc8ff'));
      } else {
        for (let i = 0; i < 90; i++) { const a = (i / 90) * Math.PI * 2; photons.push(makePhoton(src.x, src.y, Math.cos(a), Math.sin(a), `hsl(${30 + (i / 90) * 40},100%,${60 + 20 * Math.sin(a * 3)}%)`)); }
      }
    }
    launch();
    cv.canvas.addEventListener('pointerdown', (e) => {
      if (mode !== 'point') return;
      const p = U.pointer(e, cv.canvas);
      const sc = scale();
      src = { x: (p.x - cv.w / 2) / sc, y: -(p.y - cv.h / 2) / sc };
      if (Math.hypot(src.x, src.y) < 1.05) { const k = 1.05 / Math.hypot(src.x, src.y); src.x *= k; src.y *= k; }
      launch();
    });
    const scale = () => Math.min(cv.w / 30, cv.h / 20);

    ctx.loop((dt) => {
      const { ctx: g, w, h } = cv;
      const sc = scale(), cx = w / 2, cy = h / 2;
      const X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      // 网格
      g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
      for (let i = -15; i <= 15; i++) { g.beginPath(); g.moveTo(X(i), 0); g.lineTo(X(i), h); g.stroke(); }
      for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(0, Y(i)); g.lineTo(w, Y(i)); g.stroke(); }
      // 临界碰撞参数
      if (mode !== 'point') {
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.setLineDash([2, 6]);
        [BC, -BC].forEach((yy) => { g.beginPath(); g.moveTo(0, Y(yy)); g.lineTo(X(-1), Y(yy)); g.stroke(); });
        g.setLineDash([]);
        U.text(g, 'b = ±2.6 rₛ', 8, Y(BC) - 10, { size: 11, color: 'rgba(255,255,255,0.4)' });
      }
      // 推进光子
      const speed = 14; // 每秒推进的仿射参数
      for (const p of photons) {
        if (!p.alive) continue;
        let budget = speed * dt;
        while (budget > 0) {
          const r = Math.hypot(p.x, p.y);
          const dl = Math.min(budget, U.clamp(0.02 * r * r, 0.004, 0.25));
          const a0 = Math.atan2(p.y, p.x);
          stepRK4(p, dl);
          let da = Math.atan2(p.y, p.x) - a0;
          if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          p.angAcc += da;
          budget -= dl;
          const nr = Math.hypot(p.x, p.y);
          if (nr < 1) { p.alive = false; p.fate = 'in'; break; }
          if (nr > 30) { p.alive = false; p.fate = 'out'; break; }
          if (Math.abs(p.angAcc) > 40) { p.alive = false; p.fate = 'orbit'; break; }
        }
        const last = p.trail[p.trail.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) > 0.03) p.trail.push([p.x, p.y]);
      }
      // 画轨迹
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const p of photons) {
        g.strokeStyle = p.col; g.lineWidth = mode === 'single' ? 2.2 : 1.2; g.globalAlpha = mode === 'point' ? 0.55 : 0.8;
        g.beginPath(); p.trail.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.lineTo(X(p.x), Y(p.y)); g.stroke();
        if (p.alive) { g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(X(p.x), Y(p.y), 2.2, 0, 6.283); g.fill(); }
      }
      g.restore();
      // 黑洞
      g.strokeStyle = 'rgba(255,224,102,0.7)'; g.setLineDash([4, 4]); g.lineWidth = 1.2;
      g.beginPath(); g.arc(X(0), Y(0), 1.5 * sc, 0, 6.283); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#000'; g.beginPath(); g.arc(X(0), Y(0), sc, 0, 6.283); g.fill();
      g.strokeStyle = '#ff6b3d'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(0), Y(0), sc, 0, 6.283); g.stroke();
      if (mode === 'point') U.glowCircle(g, X(src.x), Y(src.y), 5, '#fff', 20);
      // 读数
      if (mode === 'single') {
        const p = photons[0];
        ro.set('b', b.toFixed(3) + ' r<sub>s</sub>');
        ro.set('weak', b > 0.01 ? ((2 / b) * 180 / Math.PI).toFixed(2) + '°' : '∞');
        if (p.fate === 'out') {
          const def = defl == null || !isFinite(defl) ? 0 : defl;
          ro.set('def', def.toFixed(2) + '°' + (def > 360 ? `（绕了 ${Math.floor(def / 360)} 圈！）` : ''));
          ro.set('fate', '逃逸（被偏折后飞走）');
        } else if (p.fate === 'in') { ro.set('def', '—'); ro.set('fate', '<span style="color:#ff6b3d">被黑洞吞噬</span>'); }
        else if (p.fate === 'orbit') { ro.set('def', '—'); ro.set('fate', '在光子球附近绕了许多圈……'); }
        else { ro.set('fate', '飞行中…'); ro.set('def', '…'); }
      } else {
        ro.set('b', mode === 'beam' ? '−8 ~ 8 r<sub>s</sub>' : '—');
        const n = photons.filter((p) => p.fate === 'in').length;
        ro.set('def', '—'); ro.set('weak', '—');
        ro.set('fate', `${n} / ${photons.length} 个光子被吞噬`);
      }
    }, s.box);
  }

  function einsteinRing(ctx) {
    const s = ctx.sim({
      title: '爱因斯坦环：黑洞作为宇宙放大镜（实时 3D 光线追踪）',
      desc: '一个遥远的星系恰好位于黑洞正后方。黑洞的引力像透镜一样把星系的光从四面八方弯折过来，形成一个完美的光环。慢慢拖动“偏离对准”，看看光环如何断开成弧。',
    });
    const box = U.el('div', { class: 'bh-embed' });
    s.stage.appendChild(box);
    const r = BHRenderer.mount(box, {
      camera: { yaw: Math.PI / 2, pitch: 0, dist: 26, fov: 42, minDist: 6, maxDist: 60 },
      autoRotate: 0, interactive: false,
      params: { disk: false, bg: 2, srcDir: [0, 0, -1], starBright: 0.8, bloom: 0.8 },
    });
    ctx.onCleanup(() => r.destroy());
    let off = 0, offDir = 0;
    const apply = () => { r.target.yaw = Math.PI / 2 + off * Math.cos(offDir); r.target.pitch = off * Math.sin(offDir); };
    U.slider(s.panel, { label: '偏离对准的角度', min: 0, max: 0.35, step: 0.001, value: 0, format: (v) => (v * 57.3).toFixed(1) + '°', onInput: (v) => { off = v; apply(); } });
    U.slider(s.panel, { label: '观察距离', min: 8, max: 50, step: 0.1, value: 26, format: (v) => v.toFixed(1) + ' r<sub>s</sub>', onInput: (v) => { r.target.dist = v; } });
    U.segmented(s.panel, {
      label: '背景', value: '2',
      options: [{ value: '2', label: '星系' }, { value: '1', label: '经纬网格' }, { value: '0', label: '星空' }],
      onChange: (v) => { r.params.bg = +v; },
    });
    U.toggle(s.panel, { label: '开启引力透镜（光线弯曲）', value: true, onChange: (v) => { r.params.lensing = v; } });
    U.toggle(s.panel, { label: '显示吸积盘', value: false, onChange: (v) => { r.params.disk = v; } });
    const auto = U.toggle(s.panel, { label: '自动绕圈偏移', value: false, onChange: () => {} });
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '关闭“引力透镜”后，黑洞只是一个挡住背景的小黑球——对比一下，你会发现透镜让黑洞的“影子”大了 2.6 倍。<br>“经纬网格”背景中蓝色为黑洞背后的天区、橙色为观察者身后的天区——你能在黑洞边缘看到身后的景象！' }));
    r.onFrame = (dt) => { if (auto.value) { offDir += dt * 0.6; if (off < 0.02) off = 0.08; apply(); } };
  }

  App.chapter({
    id: 'lensing', num: 5, part: 'B',
    title: '光线弯曲与引力透镜',
    subtitle: '黑洞会像一块巨大的透镜一样扭曲它身后的整个宇宙。',
    summary: '光子轨道、临界碰撞参数、黑洞阴影、爱因斯坦环与引力透镜。',
    sims: ['2D 光线追踪器', '3D 爱因斯坦环'],
    goals: ['光在弯曲时空中的路径', '临界碰撞参数与光子球', '黑洞“阴影”为什么比视界大', '爱因斯坦环', '引力透镜在天文学中的应用'],
    build(ctx) {
      ctx.section('光走的是时空中的“直线”', `
        <p>第 3 章我们知道：光沿着时空中的测地线传播，而质量会弯曲时空，所以光线经过大质量天体附近时会“拐弯”。离天体越近，弯得越厉害。</p>
        <p>在远离黑洞的地方，偏折角很小，可以用爱因斯坦 1915 年得到的公式近似：</p>`);
      ctx.eq(`δ ≈ ${U.frac('4GM', 'c<sup>2</sup>b')} = ${U.frac('2r<sub>s</sub>', 'b')}`, 'b 为碰撞参数（光线不弯曲时离中心的最近距离）。太阳边缘处 δ ≈ 1.75″');
      ctx.section(null, `<p>但在黑洞附近，这个近似完全失效：光线可以被弯折几十度、甚至绕黑洞转好几圈。下面这个仿真直接数值求解了史瓦西时空中的光子轨道方程：</p>`);
      ctx.eq(`${U.frac('d<sup>2</sup>u', 'dφ<sup>2</sup>')} + u = ${U.frac('3', '2')} r<sub>s</sub> u<sup>2</sup>, &nbsp;&nbsp; u = ${U.frac('1', 'r')}`, '等号右边的项是广义相对论的修正；没有它，光走直线');
      rayTracer2D(ctx);
      ctx.callout('tip', `<p>试试这几个操作：</p><ul>
        <li><b>平行光束</b>：中间那些（红色）光线全被吞噬，吞噬范围的半宽度恰好是 <b>b<sub>c</sub> ≈ 2.6 r<sub>s</sub></b>，比视界大得多。</li>
        <li><b>单束光</b> + “贴近临界值”：光子会先绕黑洞转上一两圈，然后才飞走！</li>
        <li><b>点光源</b>：点击靠近黑洞的地方，观察光子如何在光子球附近“盘旋”。</li></ul>`);
      ctx.section('黑洞的“阴影”', `
        <p>从仿真可以看到：碰撞参数 <span class="m">b &lt; b<sub>c</sub> = (3√3/2) r<sub>s</sub> ≈ 2.6 r<sub>s</sub></span> 的光线都会掉进黑洞。反过来想：当我们看向黑洞时，<b>视线方向在这个半径以内的地方，不会有任何光到达我们的眼睛</b>——我们看到的就是一片黑。</p>
        <p>所以黑洞的“影子”（阴影）半径约为 <b>2.6 r<sub>s</sub></b>，比事件视界本身大了 2.6 倍。阴影边缘的光线在光子球附近绕了很多圈才逃出来，汇聚成一个细细的亮环——<span class="hl">光子环</span>。</p>
        <p>2019 年事件视界望远镜（EHT）拍摄的 M87* 照片，中间的暗区就是黑洞的阴影。根据阴影大小可以反推黑洞质量，结果与其他方法测得的完全吻合，这是对广义相对论的一次漂亮检验。</p>`);
      einsteinRing(ctx);
      ctx.section('引力透镜：宇宙中的天然望远镜', `
        <p>不只是黑洞，任何有质量的天体都会弯曲光线。当一个遥远光源、一个前景天体（透镜）和观察者几乎排成一条直线时，就会产生<span class="hl">引力透镜</span>现象：</p>
        <ul>
          <li><b>强透镜</b>：形成爱因斯坦环、多重像（同一个类星体出现 2 个或 4 个像，如“爱因斯坦十字”）、巨大的弧；</li>
          <li><b>弱透镜</b>：背景星系被轻微拉伸，通过统计大量星系的形状，可以绘制出看不见的<b>暗物质</b>分布图；</li>
          <li><b>微引力透镜</b>：一颗恒星从另一颗恒星前面经过时，背景星会短暂变亮，天文学家借此发现了许多系外行星，甚至发现了孤立的恒星级黑洞（2022 年 OGLE-2011-BLG-0462）。</li>
        </ul>
        <p>引力透镜还能把极其遥远的星系放大几十倍，詹姆斯·韦布太空望远镜就借助星系团透镜看到了宇宙诞生后仅几亿年的星系。</p>`);
      ctx.callout('key', '<p>① 光在黑洞附近可以被大角度偏折，甚至绕圈；② b &lt; 2.6 r<sub>s</sub> 的光被吞噬，所以黑洞阴影半径 ≈ 2.6 r<sub>s</sub>；③ 背后的光源被弯成爱因斯坦环；④ 引力透镜是天文学家研究暗物质、系外行星和早期宇宙的重要工具。</p>');
      ctx.think('如果你站在光子球（1.5 r<sub>s</sub>）上，面朝正前方水平看出去，你会看到什么？',
        '沿光子球切线方向发出的光会绕黑洞一圈回到原处——理论上你会看到<b>自己的后脑勺</b>！当然，这种轨道极不稳定，而且要在那里悬停需要巨大的推力。');
      ctx.think('为什么上面 3D 仿真中，偏离对准后会出现“一大一小”两段弧？',
        '光源偏向一侧时，光线可以从黑洞的两侧绕过来：从近侧绕过来的光偏折较小，形成较大、较亮的<b>主像</b>；从远侧绕过来的光需要偏折更大角度，形成更靠近阴影、更暗的<b>次像</b>。完全对准时两者连成一个完整的环。');
    },
  });
})();
