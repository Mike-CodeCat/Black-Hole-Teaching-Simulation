/* 第 3 章：引力即时空弯曲——广义相对论 */
(function () {
  'use strict';

  /* ---------- 仿真 1：等效原理（爱因斯坦电梯） ---------- */
  function elevator(ctx) {
    const s = ctx.sim({
      title: '爱因斯坦的电梯：你能分清“引力”和“加速”吗？',
      desc: '左：太空中没有引力，火箭以加速度 g 向上加速；右：电梯静止在地面上，受地球引力 g。两边同时释放小球、水平射出一束光——看看有什么区别。（为了看清效果，光速被大大“调慢”了。）',
    });
    const wrap = U.el('div', { class: 'split-stage' });
    s.stage.appendChild(wrap);
    const L = U.el('div'), R = U.el('div');
    wrap.append(L, R);
    const cvL = U.canvas(L, { aspect: 4 / 3.2, maxHeight: 440 });
    const cvR = U.canvas(R, { aspect: 4 / 3.2, maxHeight: 440 });
    let t = -0.5, mode = 'inside';
    U.buttons(s.panel, [{ label: '▶ 释放小球 + 发射激光', primary: true, onClick: () => { t = 0; } }]);
    U.segmented(s.panel, {
      label: '左侧火箭的观察视角', value: mode,
      options: [{ value: 'inside', label: '火箭里的人' }, { value: 'outside', label: '太空中的旁观者' }],
      onChange: (v) => { mode = v; t = -0.3; },
    });
    const note = U.el('div', { class: 'status' });
    s.panel.appendChild(note);
    const setNote = () => {
      note.innerHTML = mode === 'inside'
        ? '在火箭里的人看来：小球下落、光线向下弯曲——和地面电梯里<b>一模一样</b>。'
        : '旁观者看来：光和小球都在走直线，是火箭<b>加速向上</b>“追”了上来。火箭里的人看到的弯曲是加速造成的。';
    };
    setNote();
    const segs = s.panel.querySelectorAll('.segmented button');
    segs.forEach((b) => b.addEventListener('click', setNote));
    const stars = Array.from({ length: 60 }, () => [Math.random(), Math.random()]);
    let starOff = 0, rocketY = 0, rocketV = 0;

    function drawBox(g, w, h, oy, label, col) {
      const bx = w * 0.15, by = h * 0.12 + oy, bw = w * 0.7, bh = h * 0.72;
      g.strokeStyle = col; g.lineWidth = 2; g.fillStyle = '#070a14';
      g.beginPath(); g.rect(bx, by, bw, bh); g.fill(); g.stroke();
      U.text(g, label, w / 2, 16, { align: 'center', size: 12, color: col });
      return { bx, by, bw, bh };
    }
    function drawPhysics(g, b, tt, inside, oy) {
      // 小球：从盒子中部释放；光：从左壁中点水平射出
      const gpx = 260; // 加速度（像素/秒²）
      const c = b.bw / 1.1; // 调慢后的“光速”
      const yBall0 = b.by + b.bh * 0.3;
      const drop = 0.5 * gpx * tt * tt;
      const floor = b.by + b.bh - 8;
      if (inside) {
        const yb = Math.min(floor, yBall0 + drop);
        U.glowCircle(g, b.bx + b.bw * 0.7, yb, 7, '#ffb454', 8);
        // 光线轨迹
        const n = 60; const tmax = Math.min(tt, b.bw / c);
        g.save(); g.strokeStyle = '#ff4d6d'; g.lineWidth = 2.5; g.shadowColor = '#ff4d6d'; g.shadowBlur = 10;
        g.beginPath();
        for (let i = 0; i <= n; i++) { const ti = (tmax * i) / n; const x = b.bx + c * ti, y = b.by + b.bh * 0.3 + 0.5 * gpx * ti * ti; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke(); g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(b.bx, b.by + b.bh * 0.3); g.lineTo(b.bx + b.bw, b.by + b.bh * 0.3); g.stroke(); g.setLineDash([]);
      } else {
        // 外部视角：光与球走直线，盒子向上加速（oy 已包含位移）
        const yb0 = b.by - oy + b.bh * 0.3; // 释放时刻的位置（世界坐标）
        const yb = Math.min(yb0, floor);
        U.glowCircle(g, b.bx + b.bw * 0.7, Math.min(yb0, b.by + b.bh - 8), 7, '#ffb454', 8);
        const tmax = Math.min(tt, b.bw / c);
        g.save(); g.strokeStyle = '#ff4d6d'; g.lineWidth = 2.5; g.shadowColor = '#ff4d6d'; g.shadowBlur = 10;
        g.beginPath(); g.moveTo(b.bx, yb0); g.lineTo(b.bx + c * tmax, yb0); g.stroke(); g.restore();
        void yb;
      }
    }
    ctx.loop((dt) => {
      t += dt * 0.55;
      if (t > 1.9) t = -0.5; // 自动循环播放
      const tt = Math.max(0, t);
      // 左
      {
        const { ctx: g, w, h } = cvL;
        g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
        starOff += dt * (40 + (t >= 0 ? 260 * tt : 0));
        g.fillStyle = 'rgba(255,255,255,0.6)';
        for (const [sx, sy] of stars) { const y = ((sy * h + starOff) % h); g.fillRect(sx * w, y, 1.5, mode === 'inside' ? 4 : 1.5); }
        const oy = mode === 'outside' && t >= 0 ? -0.5 * 260 * tt * tt : 0;
        const b = drawBox(g, w, h, oy, mode === 'inside' ? '火箭内部（无引力，向上加速 g）' : '旁观者视角：火箭向上加速', '#5cc8ff');
        // 火焰
        g.fillStyle = 'rgba(255,140,60,0.8)';
        g.beginPath(); g.moveTo(b.bx + b.bw * 0.35, b.by + b.bh); g.lineTo(b.bx + b.bw * 0.5, b.by + b.bh + 30 + Math.random() * 20); g.lineTo(b.bx + b.bw * 0.65, b.by + b.bh); g.fill();
        g.save(); g.beginPath(); g.rect(b.bx, b.by, b.bw, b.bh); g.clip();
        drawPhysics(g, b, tt, mode === 'inside', oy);
        g.restore();
      }
      // 右
      {
        const { ctx: g, w, h } = cvR;
        g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
        const b = drawBox(g, w, h, 0, '地面上静止的电梯（地球引力 g）', '#ffb454');
        const grd = g.createLinearGradient(0, b.by + b.bh, 0, h);
        grd.addColorStop(0, '#2d6a3e'); grd.addColorStop(1, '#0b1f12');
        g.fillStyle = grd; g.fillRect(0, b.by + b.bh + 2, w, h);
        U.arrow(g, w - 24, h * 0.3, w - 24, h * 0.3 + 40, 'rgba(255,255,255,0.6)', 2, 8);
        U.text(g, 'g', w - 14, h * 0.3 + 20, { size: 13 });
        g.save(); g.beginPath(); g.rect(b.bx, b.by, b.bw, b.bh); g.clip();
        drawPhysics(g, b, tt, true, 0);
        g.restore();
      }
      void rocketY; void rocketV;
    }, s.box);
  }

  /* ---------- 仿真 2：弯曲的时空“橡皮膜” ---------- */
  function rubberSheet(ctx) {
    const s = ctx.sim({
      title: '时空橡皮膜：质量如何让时空弯曲',
      desc: '把时空想象成一张绷紧的橡皮膜，天体压出一个“坑”，小球沿着坑的形状滚动——这就是引力。保持质量不变、把天体压得越来越小，看看坑会变成什么样。拖动画面可旋转视角。',
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 10, maxHeight: 600 });
    let Rstar = 6; // 天体半径（以 rs 为单位）
    let az = 0.6, el = 0.62;
    const ro = U.readouts(s.panel, [
      { key: 'R', label: '天体半径 / 史瓦西半径' },
      { key: 'd', label: '中心“坑”深（相对）' },
      { key: 'state', label: '状态', wide: true },
    ]);
    U.slider(s.panel, {
      label: '天体半径（质量不变）', min: 0, max: 10, step: 0.01, value: Rstar,
      format: (v) => (v < 1 ? '< 1（黑洞）' : v.toFixed(2)) + ' r<sub>s</sub>',
      onInput: (v) => { Rstar = v; },
    });
    U.buttons(s.panel, [
      { label: '⚪ 投放小球', primary: true, onClick: () => addBall(false) },
      { label: '🪐 圆轨道小球', onClick: () => addBall(true) },
      { label: '清空', onClick: () => { balls.length = 0; } },
    ]);
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '橡皮膜只是帮助想象的<b>类比</b>：真实的时空弯曲是四维的，而且“时间”的弯曲才是日常引力的主要来源（第 7 章）。' }));

    const A = 7, Rmax = 12;
    const depth = (r) => {
      const R = Math.max(Rstar, 1);
      const bh = Rstar < 1;
      if (bh && r < 1) return NaN;
      if (r >= R) return -A * 0.5 / r;
      return -A * 0.5 * (3 * R * R - r * r) / (2 * R * R * R);
    };
    const balls = [];
    const cols = ['#5cc8ff', '#ffb454', '#a78bfa', '#4ade80', '#ff7a9a'];
    function addBall(circ) {
      const a = Math.random() * Math.PI * 2;
      const r = circ ? 5 + Math.random() * 5 : 11;
      const vc = Math.sqrt(0.5 / r);
      const v = circ ? vc : vc * (0.3 + Math.random() * 0.9);
      const dir = circ ? 1 : (Math.random() < 0.5 ? 1 : -1);
      balls.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * v * dir - (circ ? 0 : Math.cos(a) * 0.05), vy: Math.cos(a) * v * dir - (circ ? 0 : Math.sin(a) * 0.05), col: cols[balls.length % cols.length], trail: [] });
      if (balls.length > 8) balls.shift();
    }
    addBall(true); addBall(false);

    // 拖动旋转
    let drag = null;
    cv.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.canvas.setPointerCapture(e.pointerId); });
    cv.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      az += (e.clientX - drag.x) * 0.008;
      el = U.clamp(el + (e.clientY - drag.y) * 0.005, 0.15, 1.45);
      drag = { x: e.clientX, y: e.clientY };
    });
    cv.canvas.addEventListener('pointerup', () => { drag = null; });
    cv.canvas.style.cursor = 'grab';

    let flashes = [];
    ctx.loop((dt, now) => {
      const { ctx: g, w, h } = cv;
      if (!drag) az += dt * 0.05;
      g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
      const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
      const f = Math.min(w, h) * 1.25, D = 30;
      const proj = (x, y, z) => {
        const x1 = x * ca - y * sa, y1 = x * sa + y * ca;
        const up = y1 * se + z * ce, dep = y1 * ce - z * se;
        const k = f / (D + dep);
        return [w / 2 + x1 * k, h * 0.47 - up * k, dep];
      };
      const bh = Rstar < 1;
      const rMin = bh ? 1 : 0.05;
      // 环线
      const NR = 26, NA = 72;
      for (let i = 0; i <= NR; i++) {
        const r = rMin + (Rmax - rMin) * Math.pow(i / NR, 1.35);
        const z = depth(r);
        const inside = !bh && r < Rstar;
        const dn = U.clamp(-z / (A * 0.5), 0, 1);
        g.strokeStyle = inside ? `rgba(255,200,120,${0.35 + dn * 0.4})` : `hsla(${210 - dn * 180},90%,${55 + dn * 10}%,${0.25 + dn * 0.6})`;
        g.lineWidth = 1;
        g.beginPath();
        for (let j = 0; j <= NA; j++) {
          const a = (j / NA) * Math.PI * 2;
          const [px, py] = proj(r * Math.cos(a), r * Math.sin(a), z);
          j ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();
      }
      // 径向线
      for (let j = 0; j < 36; j++) {
        const a = (j / 36) * Math.PI * 2;
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const r = rMin + (Rmax - rMin) * Math.pow(i / 40, 1.35);
          const [px, py] = proj(r * Math.cos(a), r * Math.sin(a), depth(r));
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.strokeStyle = 'rgba(120,170,255,0.22)';
        g.stroke();
      }
      // 天体或视界
      if (bh) {
        // 漏斗向下延伸
        const zb = depth(1);
        for (let k = 0; k < 14; k++) {
          const z = zb - k * 0.45;
          g.strokeStyle = `rgba(255,120,60,${0.5 - k * 0.035})`;
          g.beginPath();
          for (let j = 0; j <= NA; j++) {
            const a = (j / NA) * Math.PI * 2;
            const rr = 1 - k * 0.03;
            const [px, py] = proj(rr * Math.cos(a), rr * Math.sin(a), z);
            j ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.stroke();
        }
        const [hx, hy] = proj(0, 0, zb);
        U.text(g, '事件视界：漏斗“无底”', hx, hy + 30, { align: 'center', size: 12, color: '#ff9a52', shadow: true });
      } else {
        const [sx, sy] = proj(0, 0, depth(0) + Math.min(Rstar, 3) * 0.4);
        const rad = Math.min(Rstar, 4) * f / D * 0.35 + 4;
        const col = U.blackbody(5000 + 25000 / Rstar);
        g.save(); g.shadowColor = U.rgb(col); g.shadowBlur = 40;
        const gr = g.createRadialGradient(sx - rad * 0.3, sy - rad * 0.3, 1, sx, sy, rad);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, U.rgb(col));
        g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, rad, 0, Math.PI * 2); g.fill(); g.restore();
      }
      // 小球（牛顿引力，GM = 0.5）
      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];
        const sub = 40, hs = (dt * 25) / sub;
        let dead = false;
        for (let i = 0; i < sub; i++) {
          const r = Math.hypot(b.x, b.y);
          const m = r < Rstar ? 0.5 * Math.pow(r / Rstar, 3) : 0.5;
          const acc = m / (r * r * r);
          b.vx -= acc * b.x * hs; b.vy -= acc * b.y * hs;
          b.x += b.vx * hs; b.y += b.vy * hs;
          const nr = Math.hypot(b.x, b.y);
          if (nr < Math.max(Rstar * 0.7, 1) || nr > 16) { dead = true; break; }
        }
        if (dead) {
          if (Math.hypot(b.x, b.y) < 16) flashes.push({ x: b.x, y: b.y, t: 0 });
          balls.splice(bi, 1); continue;
        }
        const r = Math.hypot(b.x, b.y);
        b.trail.push([b.x, b.y, depth(r)]);
        if (b.trail.length > 160) b.trail.shift();
        g.strokeStyle = b.col; g.globalAlpha = 0.6; g.lineWidth = 1.5;
        g.beginPath(); b.trail.forEach(([x, y, z], i) => { const [px, py] = proj(x, y, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        g.globalAlpha = 1;
        const [px, py] = proj(b.x, b.y, depth(r) + 0.15);
        U.glowCircle(g, px, py, 5, b.col, 12);
      }
      flashes = flashes.filter((fl) => (fl.t += dt) < 0.6);
      for (const fl of flashes) {
        const [px, py] = proj(fl.x, fl.y, depth(Math.max(1, Math.hypot(fl.x, fl.y))));
        g.strokeStyle = `rgba(255,200,120,${1 - fl.t / 0.6})`; g.lineWidth = 2;
        g.beginPath(); g.arc(px, py, 5 + fl.t * 40, 0, Math.PI * 2); g.stroke();
      }
      ro.set('R', bh ? '< 1' : Rstar.toFixed(2));
      ro.set('d', bh ? '∞' : (-depth(0) / (A * 0.5 * 1.5 / 10)).toFixed(1));
      ro.set('state', bh ? '<span style="color:#ff9a52">黑洞！天体已缩到自身史瓦西半径以内</span>' : Rstar < 3 ? '极端致密天体（类似中子星）' : '普通致密天体');
      void now;
    }, s.box);
  }

  App.chapter({
    id: 'spacetime', num: 3, part: 'A',
    title: '引力即时空弯曲',
    subtitle: '爱因斯坦最伟大的洞见：引力根本不是一种“力”，而是时空本身的形状。',
    summary: '等效原理、弯曲时空与测地线，理解广义相对论的核心思想。',
    sims: ['爱因斯坦电梯', '时空橡皮膜'],
    goals: ['等效原理', '光也会被引力弯曲', '时空弯曲与测地线', '爱因斯坦场方程的含义', '史瓦西解的诞生'],
    build(ctx) {
      ctx.section('“一生中最快乐的想法”', `
        <p>1907 年，爱因斯坦在专利局上班时突然想到：<b>一个从屋顶自由下落的人，是感觉不到自己的重量的。</b>他后来把这称为“一生中最快乐的想法”。</p>
        <p>今天我们对此并不陌生：国际空间站里的宇航员其实<b>仍然受到约 90% 的地球引力</b>，但他们和空间站一起在“自由下落”，所以飘了起来。反过来，一个在太空中加速的火箭里，人会被“压”在地板上，就像站在地面上一样。</p>`);
      ctx.callout('key', '<p><b>等效原理：</b>在一个足够小的封闭空间里，你无法通过任何实验区分“受到引力”和“在做加速运动”。引力效应与加速效应在局部是等价的。</p>', '🔑 等效原理');
      elevator(ctx);
      ctx.section('光也会被引力弯曲！', `
        <p>在加速火箭里，水平射出的光线必然向下弯曲（因为火箭在光飞行期间向上加速了）。根据等效原理，<b>引力场中的光线也必然弯曲</b>。</p>
        <p>这是一个惊人的预言：光没有质量，按牛顿理论似乎不应受引力影响。1919 年日全食期间，英国天文学家爱丁顿测量了太阳附近恒星的位置，发现星光确实被太阳偏折了约 <b>1.75 角秒</b>——与爱因斯坦的预言相符。这次观测让爱因斯坦一夜之间闻名世界。</p>`);
      ctx.section('时空弯曲：物质告诉时空如何弯曲，时空告诉物质如何运动', `
        <p>如果连没有质量的光都会“拐弯”，那么最自然的解释就是：<b>不是光在拐弯，而是光所走的“路”本身是弯的</b>。</p>
        <p>想象两个人从赤道上相距 100 公里的两点同时出发，都笔直地向正北走。虽然他们都没有“拐弯”，但他们之间的距离越来越近，最终在北极相遇。是什么“力”把他们拉到一起？没有力——是<b>地球表面的弯曲</b>。</p>
        <p>在广义相对论中：</p>
        <ul>
          <li>质量和能量会让周围的<b>时空发生弯曲</b>；</li>
          <li>不受其他力的物体（包括光）沿时空中“最直的路径”运动，这条路径叫做<span class="hl">测地线</span>；</li>
          <li>在弯曲时空中，测地线看起来就是弯的——我们把这种现象叫做“引力”。</li>
        </ul>`);
      rubberSheet(ctx);
      ctx.callout('tip', '<p>把天体半径滑到 <b>1 r<sub>s</sub> 以下</b>，你会看到坑变成了一个无底的“漏斗”。任何越过漏斗边缘的东西都再也爬不出来——这就是<b>黑洞</b>在时空几何中的样子。</p>');
      ctx.section('爱因斯坦场方程', `<p>1915 年 11 月，爱因斯坦写下了描述时空如何被物质弯曲的方程。它看上去很简洁，其实是 10 个相互耦合的非线性偏微分方程：</p>`);
      ctx.eq(`G<sub>μν</sub> = ${U.frac('8πG', 'c<sup>4</sup>')} T<sub>μν</sub>`, '左边：描述时空弯曲的几何量；右边：描述物质与能量分布。“物质告诉时空如何弯曲，时空告诉物质如何运动”——约翰·惠勒');
      ctx.section('战壕里诞生的黑洞解', `
        <p>场方程发表仅一个多月后，正在第一次世界大战东线战壕中服役的德国天文学家<b>卡尔·史瓦西</b>，就找到了它的第一个精确解：描述一个<b>不旋转、不带电的球形质量</b>周围的时空。这就是<span class="hl">史瓦西解</span>。</p>
        <p>这个解有一个奇怪的地方：在半径</p>`);
      ctx.eq(`r<sub>s</sub> = ${U.frac('2GM', 'c<sup>2</sup>')}`, '史瓦西半径——和第 1 章的“暗星”临界半径一模一样');
      ctx.section(null, `
        <p>处，方程中的某些项会变成无穷大。当时包括爱因斯坦在内的大多数物理学家都认为，自然界不可能真的有物体被压缩到这么小，这只是一个数学上的怪异结果。</p>
        <p>史瓦西在寄出论文几个月后因病去世。又过了近半个世纪，人们才真正理解：<b>这个半径是一个“单向膜”——事件视界</b>；而“黑洞”（black hole）这个名字，直到 1967 年才由惠勒推广开来。</p>
        <p>从下一章开始，我们正式走进黑洞。</p>`);
      ctx.callout('fact', '<p>广义相对论还解释了困扰天文学家半个世纪的“水星近日点进动”问题：水星的椭圆轨道每世纪会额外转动 <b>43 角秒</b>，牛顿理论无法解释，而广义相对论算出的结果恰好是 43″。你将在第 6 章亲眼看到这种“进动”。</p>');
      ctx.think('国际空间站离地面约 400 km，那里的引力大约是地面的 90%。为什么宇航员会“失重”？',
        '因为空间站和宇航员一起在做<b>自由落体</b>（它们同时以约 7.7 km/s 的速度横向飞行，所以一直“掉”却掉不到地面——就像第 1 章的牛顿大炮）。根据等效原理，自由下落的参考系中局部感受不到引力。');
      ctx.think('既然光会被引力弯曲，那么我们看到的太阳附近的星星，位置是偏向太阳还是远离太阳？',
        '<b>远离太阳</b>。光线经过太阳附近时向太阳一侧弯曲，我们沿着到达眼睛的光线方向反向延长去看，星星的视位置就被“推”到了离太阳更远的地方。');
    },
  });
})();
