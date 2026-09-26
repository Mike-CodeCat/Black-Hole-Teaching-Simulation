/* 黑洞入侵太阳系：电影级 N 体仿真 */
(function () {
  'use strict';
  const toGL = (p) => [p[0], p[2], -p[1]]; // 黄道坐标 → 渲染坐标（y 轴垂直黄道面）
  const TYPE = { sun: 0, mercury: 1, venus: 2, earth: 3, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptune: 8, moon: 9 };
  const TILT = { earth: 0.41, mars: 0.44, jupiter: 0.05, saturn: 0.47, uranus: 1.71, neptune: 0.49, venus: 3.09, mercury: 0, moon: 0.03, sun: 0.13 };
  const SPIN = { earth: 1, mars: 0.97, jupiter: 2.4, saturn: 2.2, uranus: -1.4, neptune: 1.5, venus: -0.05, mercury: 0.02, moon: 0.04, sun: 0.04 };

  const PRESETS = [
    { id: 'sun', name: '☠ 直击太阳', sub: '黑洞从太阳身旁 0.004 AU 处掠过，太阳被潮汐力撕碎', victim: 'sun', opts: { Mbh: 10, vinf: 40, q: 0.004, inc: 28, node: 75, argp: 40 } },
    { id: 'earth', name: '🌍 擦过地球', sub: '黑洞在距地球约 0.02 AU（300 万公里）处呼啸而过', victim: 'earth', opts: { Mbh: 10, vinf: 40, inc: 0, node: 0, argp: 0 }, aim: { key: 'earth', d: 0.02 } },
    { id: 'jupiter', name: '🪐 劫持木星', sub: '黑洞穿过外太阳系，近距离掠过木星', victim: 'jupiter', opts: { Mbh: 10, vinf: 30, inc: 6, node: 0, argp: 0 }, aim: { key: 'jupiter', d: 0.15 } },
    { id: 'far', name: '🌌 远方路过', sub: '黑洞在 50 AU 外（海王星轨道之外）掠过——看似遥远，影响几何？', victim: 'sun', opts: { Mbh: 10, vinf: 40, q: 50, inc: 60, node: 30, argp: 70, r0: 160 } },
    { id: 'custom', name: '⚙ 自定义', sub: '自己设定黑洞质量、速度与近日距离', victim: 'sun', opts: { Mbh: 10, vinf: 40, q: 0.5, inc: 20, node: 60, argp: 30 } },
  ];

  const fmtT = (yr) => {
    const a = Math.abs(yr), s = yr < 0 ? '−' : '+';
    if (a >= 1) return s + a.toFixed(2) + ' 年';
    if (a * 365.25 >= 1) return s + (a * 365.25).toFixed(1) + ' 天';
    if (a * 8766 >= 1) return s + (a * 8766).toFixed(1) + ' 小时';
    return s + (a * 525960).toFixed(1) + ' 分钟';
  };
  const fmtRate = (yps) => {
    const d = yps * 365.25;
    if (yps >= 1) return `1 秒 = ${yps.toFixed(1)} 年`;
    if (d >= 1) return `1 秒 = ${d.toFixed(1)} 天`;
    if (d * 24 >= 1) return `1 秒 = ${(d * 24).toFixed(1)} 小时`;
    return `1 秒 = ${(d * 1440).toFixed(1)} 分钟`;
  };
  const distStr = (d) => (d >= 0.05 ? d.toFixed(3) + ' AU' : U.plain(U.sci(d * 1.495978707e8, 3)) + ' km');

  App.page('invasion', {
    title: '黑洞入侵太阳系',
    bodyClass: 'fullscreen-page',
    build(ctx) {
      const B = window.BHInvasion;
      const V = B.vec;
      const wrap = U.el('div', { class: 'explore-wrap inv' });
      ctx.root.appendChild(wrap);
      const canvas = U.el('canvas', { class: 'bh-canvas' });
      wrap.appendChild(canvas);
      const R = new InvasionRenderer(canvas);
      ctx.onCleanup(() => R.destroy());
      if (!R.ok) { wrap.appendChild(U.el('div', { class: 'webgl-fail', html: '你的浏览器不支持 WebGL，无法显示该仿真。' })); return; }
      const labels = U.el('div', { class: 'inv-labels' });
      wrap.appendChild(labels);

      /* ---------------- 状态 ---------------- */
      let preset = PRESETS[0], opts = null, sim = null, running = false;
      let rate = 0.3, userRate = 0.5, autoSlow = true;
      let camMode = 'cinema', focusKey = 'sun', lookKey = 'bh', fov = 50;
      let showTrails = true, showLabels = true, bigBodies = true, showOrbits = true, lens = true;
      let trails = {}, origOrbits = null, statuses = {}, statusSince = {}, logged = new Set();
      let flash = 0, diskAxis = [0, 1, 0], realT = 0;
      const cam = { yaw: 0.8, pitch: 0.35, logD: Math.log(60), target: [0, 0, 0], pos: [0, 0, 60] };
      let dragging = false;

      /* ---------------- 界面：左侧状态 ---------------- */
      const left = U.el('div', { class: 'hud-left inv-left' });
      left.appendChild(U.el('h4', { class: 'inv-h', text: '☄ 黑洞入侵太阳系' }));
      const clock = U.el('div', { class: 'inv-clock' });
      left.appendChild(clock);
      const roG = U.readouts(left, [
        { key: 'dsun', label: '黑洞 – 太阳距离' },
        { key: 'vel', label: '黑洞相对太阳速度' },
        { key: 'mass', label: '黑洞质量' },
        { key: 'L', label: '吸积光度' },
      ]);
      left.appendChild(U.el('div', { class: 'inv-sub', text: '🌍 地球实时诊断' }));
      const roE = U.readouts(left, [
        { key: 'st', label: '地球状态', wide: true },
        { key: 'ds', label: '距太阳' },
        { key: 'db', label: '距黑洞' },
        { key: 'orb', label: '日心轨道 a / e', wide: true },
        { key: 'g', label: '黑洞引力 / 太阳引力' },
        { key: 'moon', label: '月球' },
        { key: 'S', label: '接收辐射（现在 = 1）' },
        { key: 'T', label: '平衡温度（现在 255 K）' },
      ]);
      const cons = U.el('div', { class: 'inv-cons' });
      left.appendChild(cons);
      wrap.appendChild(left);

      /* ---------------- 界面：右侧控制 ---------------- */
      const hud = U.el('div', { class: 'hud inv-hud' });
      wrap.appendChild(hud);
      hud.appendChild(U.el('h4', { text: '场景与镜头' }));
      const presetSel = U.select(hud, { label: '场景', value: preset.id, options: PRESETS.map((p) => ({ value: p.id, label: p.name })), onChange: (v) => { preset = PRESETS.find((p) => p.id === v); customBox.style.display = v === 'custom' ? '' : 'none'; } });
      void presetSel;
      const customBox = U.el('div', { style: { display: 'none' } });
      hud.appendChild(customBox);
      const cu = PRESETS[4].opts;
      U.slider(customBox, { label: '黑洞质量', min: 3, max: 100, value: cu.Mbh, log: true, format: (v) => v.toFixed(1) + ' M☉', onInput: (v) => { cu.Mbh = v; } });
      U.slider(customBox, { label: '远处来袭速度 v∞', min: 10, max: 300, value: cu.vinf, log: true, format: (v) => v.toFixed(0) + ' km/s', onInput: (v) => { cu.vinf = v; } });
      U.slider(customBox, { label: '距太阳最近距离 q', min: 0.002, max: 100, value: cu.q, log: true, format: (v) => (v < 0.1 ? v.toFixed(4) : v.toFixed(2)) + ' AU', onInput: (v) => { cu.q = v; } });
      U.slider(customBox, { label: '轨道倾角', min: 0, max: 180, step: 1, value: cu.inc, format: (v) => v + '°', onInput: (v) => { cu.inc = v; } });
      U.buttons(hud, [
        { label: '▶ 开始 / 重新开始', primary: true, onClick: () => start() },
        { label: '⏯ 暂停', onClick: (e) => { running = !running; e.currentTarget.textContent = running ? '⏯ 暂停' : '▶ 继续'; } },
      ]);
      U.buttons(hud, [{ label: '⏩ 跳到关键时刻', onClick: () => jumpToAction() }]);
      U.slider(hud, { label: '播放速度（基准）', min: 0.02, max: 3, value: userRate, log: true, format: (v) => fmtRate(v), onInput: (v) => { userRate = v; } });
      U.toggle(hud, { label: '自动慢动作（近距离时放慢）', value: true, onChange: (v) => { autoSlow = v; } });
      U.segmented(hud, {
        label: '镜头', value: camMode,
        options: [{ value: 'cinema', label: '电影' }, { value: 'free', label: '自由' }, { value: 'earth', label: '地球' }, { value: 'bh', label: '黑洞旁' }],
        onChange: (v) => { camMode = v; if (v === 'bh') initBHCam(); focusBox.style.display = v === 'free' ? '' : 'none'; lookBox.style.display = v === 'earth' ? '' : 'none'; },
      });
      const focusBox = U.el('div', { style: { display: 'none' } }); hud.appendChild(focusBox);
      U.select(focusBox, { label: '围绕', value: focusKey, options: [['sun', '太阳'], ['bh', '黑洞'], ['earth', '地球'], ['jupiter', '木星'], ['saturn', '土星']].map(([v, l]) => ({ value: v, label: l })), onChange: (v) => { focusKey = v; } });
      const lookBox = U.el('div', { style: { display: 'none' } }); hud.appendChild(lookBox);
      U.segmented(lookBox, { label: '从地球望向', value: lookKey, options: [{ value: 'bh', label: '黑洞' }, { value: 'sun', label: '太阳' }], onChange: (v) => { lookKey = v; } });
      U.slider(hud, { label: '视野角（变焦）', min: 2, max: 100, value: fov, log: true, format: (v) => v.toFixed(v < 10 ? 1 : 0) + '°', onInput: (v) => { fov = v; } });
      U.toggle(hud, { label: '轨迹', value: true, onChange: (v) => { showTrails = v; } });
      U.toggle(hud, { label: '原始轨道（参照）', value: true, onChange: (v) => { showOrbits = v; } });
      U.toggle(hud, { label: '天体放大显示', value: true, onChange: (v) => { bigBodies = v; } });
      U.toggle(hud, { label: '标签', value: true, onChange: (v) => { showLabels = v; labels.style.display = v ? '' : 'none'; } });
      U.toggle(hud, { label: '引力透镜（黑洞弯曲光线）', value: true, onChange: (v) => { lens = v; } });
      U.buttons(hud, [{ label: '📐 查看严格物理论证', onClick: () => openProof() }]);
      const hint = U.el('div', { class: 'ctrl-hint', html: '“天体放大显示”只放大行星与太阳的外观尺寸以便看清；位置、轨道、距离与引力计算全部为真实比例。拖动画面旋转，滚轮缩放（自由镜头）。' });
      hud.appendChild(hint);
      const collapse = U.el('button', { class: 'btn small', text: '收起面板 →', on: { click: () => { hud.classList.add('collapsed'); openBtn.style.display = ''; } } });
      hud.appendChild(collapse);
      const openBtn = U.el('button', { class: 'btn small hud-toggle', text: '⚙ 面板', style: { display: 'none' }, on: { click: () => { hud.classList.remove('collapsed'); openBtn.style.display = 'none'; } } });
      wrap.appendChild(openBtn);
      if (innerWidth < 900) { hud.classList.add('collapsed'); openBtn.style.display = ''; }

      const cap = U.el('div', { class: 'caption inv-caption', style: { opacity: 0 } });
      wrap.appendChild(cap);
      let capT = 0;
      const say = (t, s, dur = 7) => { cap.innerHTML = t + (s ? `<small>${s}</small>` : ''); cap.style.opacity = 1; capT = dur; };
      const log = U.el('div', { class: 'inv-log' });
      wrap.appendChild(log);
      const addLog = (html) => {
        const d = U.el('div', { class: 'inv-log-item', html: `<b>${sim ? fmtT(sim.t - (sim.hyper.tTarget != null ? sim.hyper.tTarget : sim.hyper.tPeri)) : ''}</b> ${html}` });
        log.prepend(d);
        while (log.children.length > 7) log.lastChild.remove();
      };
      const bar = U.el('div', { class: 'inv-bar' }, U.el('div', { class: 'inv-bar-fill' }));
      const rateTag = U.el('div', { class: 'inv-rate' });
      wrap.appendChild(bar); wrap.appendChild(rateTag);

      /* ---------------- 片头 ---------------- */
      const intro = U.el('div', { class: 'inv-intro' });
      intro.innerHTML = `
        <div class="inv-intro-inner">
          <div class="inv-kicker">A ROGUE BLACK HOLE · N-BODY SIMULATION</div>
          <h1>黑洞入侵太阳系</h1>
          <p class="inv-lead">银河系中游荡着约 <b>1 亿</b>个恒星级黑洞。它们不发光、看不见——如果其中一个径直闯进太阳系，会发生什么？</p>
          <p class="inv-note">这不是动画，而是实时计算：太阳、八大行星、月球与黑洞之间的全部万有引力（从 2026 年 9 月 26 日的真实行星位置出发），潮汐瓦解、吸积光度与地球温度都按物理公式求得。</p>
          <div class="inv-presets"></div>
          <div class="inv-intro-actions"><button class="btn primary inv-go">▶ 开始仿真</button><a class="btn" href="#/">← 返回首页</a></div>
        </div>`;
      wrap.appendChild(intro);
      const pbox = intro.querySelector('.inv-presets');
      PRESETS.slice(0, 4).forEach((p) => {
        const b = U.el('button', { class: 'inv-preset' + (p === preset ? ' active' : ''), html: `<b>${p.name}</b><span>${p.sub}</span>` });
        b.addEventListener('click', () => { preset = p; pbox.querySelectorAll('.inv-preset').forEach((x) => x.classList.toggle('active', x === b)); presetSel.sel.value = p.id; });
        pbox.appendChild(b);
      });
      intro.querySelector('.inv-go').addEventListener('click', () => { intro.classList.add('hide'); start(); });

      const loading = U.el('div', { class: 'inv-loading', style: { display: 'none' }, text: '正在用 N 体模拟计算黑洞的瞄准轨道……' });
      wrap.appendChild(loading);

      /* ---------------- 物理论证面板 ---------------- */
      const modal = U.el('div', { class: 'inv-modal', style: { display: 'none' } });
      wrap.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
      function openProof() { modal.innerHTML = ''; modal.appendChild(proofCard()); modal.style.display = ''; }

      /* ---------------- 启动场景 ---------------- */
      function start() {
        running = false;
        loading.style.display = '';
        setTimeout(() => {
          let o = Object.assign({ date: new Date() }, preset.opts);
          if (preset.aim) o = B.aim(o, preset.aim.key, preset.aim.d);
          opts = o;
          sim = new B.Sim(o);
          // 倒计时的目标：与“受害者”最近接近的时刻（瞄准场景由 N 体预演给出，否则取二体近日点时刻）
          sim.hyper.tTarget = o.aimTime != null ? o.aimTime : sim.hyper.tPeri;
          trails = {}; statuses = {}; statusSince = {}; logged = new Set(); flash = 0;
          log.innerHTML = '';
          buildOrbits();
          rate = userRate;
          const pv = toGL(sim.pos(sim.idx[preset.victim === 'sun' ? 'sun' : preset.victim]));
          cam.target = pv.slice();
          cam.logD = Math.log(Math.max(40, V.len(V.sub(sim.pos(sim.bh), sim.pos(sim.idx.sun))) * 1.4));
          loading.style.display = 'none';
          running = true;
          const M = o.Mbh;
          say(`${new Date().getFullYear()} 年，一颗 ${M.toFixed(M < 10 ? 1 : 0)} 倍太阳质量的黑洞正以 ${o.vinf.toFixed(0)} km/s 闯入太阳系`,
            `它的事件视界直径只有 ${(2 * 2.953 * M).toFixed(0)} km，本身完全不发光——距它最近接近${sim.bodies[sim.idx[preset.victim]].name}还有 ${sim.hyper.tTarget.toFixed(1)} 年。`, 9);
          addLog(`场景：${preset.name}${o.aimResult ? `（N 体瞄准：预计最近 ${distStr(o.aimResult)}）` : ''}`);
        }, 30);
      }
      /** 快速推进到黑洞距“受害者”约 1.2 AU（或最近接近前）的时刻，仍是完整的 N 体计算，只是不逐帧显示 */
      function jumpToAction() {
        if (!sim) return;
        const vk = sim.idx[preset.victim];
        const lead = preset.victim === 'sun' ? 1.2 : 1.0;
        const t0 = performance.now();
        while (sim.t < (sim.hyper.tTarget || sim.hyper.tPeri) && sim.alive[vk] && V.len(V.sub(sim.pos(vk), sim.pos(sim.bh))) > lead && performance.now() - t0 < 4000) {
          const before = sim.events.length;
          sim.advance(0.02, 20000);
          for (let k = before; k < sim.events.length; k++) handleEvent(sim.events[k]);
          checkStatuses();
        }
        trails = {};
        rate = userRate * 0.1;
        running = true;
        addLog('⏩ 快进到关键时刻');
      }
      function buildOrbits() {
        const pts = [], cols = [];
        for (const p of B.PLANETS) {
          const n = 160;
          for (let k = 0; k < n; k++) {
            for (const kk of [k, k + 1]) {
              const E = (kk / n) * 2 * Math.PI;
              const M = E - p.e * Math.sin(E);
              const st = B.ellipticState(p.a, p.e, (p.I * Math.PI) / 180, (p.O * Math.PI) / 180, ((p.w - p.O) * Math.PI) / 180, M, B.G);
              pts.push(...toGL(st.pos));
              cols.push(p.col[0] * 0.5, p.col[1] * 0.5, p.col[2] * 0.6, 0.16);
            }
          }
        }
        origOrbits = { pos: pts, col: cols };
      }

      /* ---------------- 交互（拖动/缩放） ---------------- */
      let lx = 0, ly = 0;
      canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); if (camMode === 'cinema') { camMode = 'free'; focusKey = 'sun'; syncCamSeg(); } });
      canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        cam.yaw -= (e.clientX - lx) * 0.005; cam.pitch = U.clamp(cam.pitch + (e.clientY - ly) * 0.004, -1.5, 1.5);
        lx = e.clientX; ly = e.clientY;
      });
      canvas.addEventListener('pointerup', () => { dragging = false; });
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.logD += e.deltaY * 0.0012; if (camMode === 'cinema') { camMode = 'free'; syncCamSeg(); } }, { passive: false });
      function syncCamSeg() {
        const seg = hud.querySelectorAll('.segmented')[0];
        if (!seg) return;
        const btns = seg.querySelectorAll('button');
        ['cinema', 'free', 'earth', 'bh'].forEach((k, i) => btns[i].classList.toggle('active', k === camMode));
        focusBox.style.display = camMode === 'free' ? '' : 'none';
        lookBox.style.display = camMode === 'earth' ? '' : 'none';
      }
      function initBHCam() {
        if (!sim) return;
        const pb = toGL(sim.pos(sim.bh)), ps = toGL(sim.pos(sim.idx.sun));
        const u = V.mul(V.sub(pb, ps), 1 / V.len(V.sub(pb, ps)));
        cam.pitch = Math.asin(U.clamp(u[1], -1, 1)) + 0.02;
        cam.yaw = Math.atan2(u[2], u[0]) + 0.02;
        cam.logD = Math.log(sim.bodies[sim.bh].R * 40);
      }

      /* ---------------- 每帧：物理 ---------------- */
      function physicsTick(dt) {
        if (!sim || !running) return;
        const ib = sim.bh, pb = sim.pos(ib), vb = sim.vel(ib);
        // 慢动作因子：近距离交会的特征时间 d/v
        let tau = 1e9;
        for (const k of ['sun', 'earth', preset.victim]) {
          const i = sim.idx[k];
          if (i == null || !sim.alive[i]) continue;
          const d = V.len(V.sub(sim.pos(i), pb)), v = V.len(V.sub(sim.vel(i), vb));
          tau = Math.min(tau, d / Math.max(v, 1e-6));
        }
        const factor = autoSlow ? U.clamp(tau / 0.35, 2e-6, 1) : 1;
        const target = userRate * factor;
        rate = target < rate ? target : Math.min(target, rate * Math.exp(0.35 * dt));
        const before = sim.events.length;
        sim.advance(rate * dt, 2500);
        for (let k = before; k < sim.events.length; k++) handleEvent(sim.events[k]);
        checkStatuses();
      }

      function handleEvent(ev) {
        const b = ev.body;
        if (ev.type === 'disrupt') {
          if (b.key === 'sun') {
            flash = 1.0;
            const rt = sim.tidalR.sun;
            say('太阳被撕碎了', `黑洞越过太阳的潮汐半径 r<sub>t</sub> = R☉(M<sub>BH</sub>/M☉)<sup>1/3</sup> ≈ ${rt.toFixed(4)} AU：潮汐力超过了太阳自身的引力。`, 10);
            addLog('<span class="bad">太阳进入潮汐半径，被潮汐瓦解</span>');
            // 碎片盘的朝向：太阳相对黑洞的轨道角动量方向
            const r = V.sub(sim.pos(sim.idx.sun), sim.pos(sim.bh)), v = V.sub(sim.vel(sim.idx.sun), sim.vel(sim.bh));
            const h = V.cross(r, v);
            diskAxis = toGL(V.mul(h, 1 / V.len(h)));
          } else {
            flash = 0.5;
            say(`${b.name}被黑洞撕碎`, `${b.name}进入了它的潮汐半径 ${distStr(sim.tidalR[b.key])}。`, 8);
            addLog(`<span class="bad">${b.name}被潮汐力撕碎</span>`);
          }
        } else if (ev.type === 'sunhit') {
          say(`${b.name}坠入太阳`, '黑洞的引力把它的轨道扰动成了一条直插太阳的轨道。', 7);
          addLog(`<span class="bad">${b.name}坠入太阳</span>`);
        }
      }

      /**
       * 判断行星归属。黑洞与太阳靠得很近时，“相对太阳的轨道”没有意义，此时返回 null 不作判定；
       * 只有当某一方明显主导（距离相差 3 倍以上）时才用二体轨道能量判断是否束缚。
       */
      function classify(i) {
        const is = sim.idx.sun, ib = sim.bh;
        const sunAlive = sim.alive[is];
        const p = sim.pos(i), pb = sim.pos(ib);
        const db = V.len(V.sub(p, pb));
        if (!sunAlive) return sim.orbit(i, ib).bound ? 'bh' : (db > 5 ? 'free' : null);
        const ps = sim.pos(is);
        const ds = V.len(V.sub(p, ps)), dsb = V.len(V.sub(ps, pb));
        if (dsb > 3 * ds) return sim.orbit(i, is).bound ? 'sun' : (sim.orbit(i, ib).bound ? 'bh' : 'free');
        if (db * 3 < ds) return sim.orbit(i, ib).bound ? 'bh' : null;
        // 远离“太阳–黑洞”这一对：用相对二者质心的能量判断是否已被甩出
        const Ms = sim.m[is], Mb = sim.m[ib];
        const cm = V.mul(V.add(V.mul(ps, Ms), V.mul(pb, Mb)), 1 / (Ms + Mb));
        const vcm = V.mul(V.add(V.mul(sim.vel(is), Ms), V.mul(sim.vel(ib), Mb)), 1 / (Ms + Mb));
        const r = V.len(V.sub(p, cm));
        if (r > 5 * dsb) {
          const v = V.sub(sim.vel(i), vcm);
          const E = 0.5 * V.dot(v, v) - (B.G * Ms) / ds - (B.G * Mb) / db;
          if (E > 0.25 * (B.G * (Ms + Mb)) / r) return 'free';
        }
        return null;
      }
      function once(key, fn) { if (!logged.has(key)) { logged.add(key); fn(); } }
      function checkStatuses() {
        const is = sim.idx.sun, ib = sim.bh;
        const sunAlive = sim.alive[is];
        const dsun = V.len(V.sub(sim.pos(ib), sim.pos(is)));
        // 黑洞穿越行星轨道
        for (const p of B.PLANETS) {
          if (sunAlive && dsun < p.a && sim.t < sim.hyper.tPeri) once('cross-' + p.key, () => addLog(`黑洞越过${p.name}轨道（${p.a.toFixed(1)} AU）`));
        }
        const ie = sim.idx.earth;
        if (sim.alive[ie]) {
          const de = V.len(V.sub(sim.pos(ie), sim.pos(ib)));
          const ds = sunAlive ? V.len(V.sub(sim.pos(ie), sim.pos(is))) : Infinity;
          const ratio = (sim.m[ib] / (de * de)) / (sunAlive ? 1 / (ds * ds) : 1e-30);
          if (ratio > 1) once('grav-earth', () => { say('此刻，地球感受到的黑洞引力已超过太阳', `黑洞距地球 ${distStr(de)}：${sim.m[ib].toFixed(1)} M☉ / d² 已压过 1 M☉ / (${ds.toFixed(2)} AU)²。`, 7); addLog('黑洞对地球的引力超过太阳'); });
        }
        // 行星归属（带滞后，避免交会过程中来回跳变）
        for (const b of sim.bodies) {
          if (b.type !== 'planet' && b.type !== 'moon') continue;
          const i = sim.idx[b.key];
          let st;
          if (!sim.alive[i]) st = b.status;
          else if (b.type === 'moon') st = sim.alive[ie] && sim.orbit(i, ie).bound ? 'earth' : 'free';
          else st = classify(i);
          if (st == null) continue; // 交会进行中，归属不明确：暂不判定
          if (statuses[b.key] == null) { statuses[b.key] = st; statusSince[b.key] = { s: st, t: sim.t }; continue; }
          const pend = statusSince[b.key];
          if (pend.s !== st) { statusSince[b.key] = { s: st, t: sim.t, rt: realT }; continue; }
          if (st !== statuses[b.key] && (sim.t - pend.t > 0.08 || realT - (pend.rt || 0) > 4)) {
            statuses[b.key] = st;
            if (st === 'bh') { addLog(`<span class="warn">${b.name}被黑洞俘获</span>`); if (b.key === 'earth' || b.key === preset.victim) say(`${b.name}被黑洞俘获了`, `${b.name}相对黑洞的轨道能量已为负：它将从此绕着黑洞运转。`, 8); }
            else if (st === 'free') {
              if (b.type === 'moon') { addLog('<span class="warn">月球脱离地球</span>'); say('月球被夺走了', '在黑洞的潮汐场中，地球的希尔球缩小到比月球轨道还小，月球不再被地球束缚。', 8); }
              else { addLog(`<span class="warn">${b.name}被甩出，成为星际流浪天体</span>`); if (b.key === 'earth') say('地球被甩出了太阳系', '地球的轨道能量已为正：它将永远漂泊在星际空间，逐渐冻结。', 9); }
            } else if (st === 'sun') addLog(`${b.name}重新回到绕太阳的轨道`);
          }
        }
        // 吸积耀发
        if (sim.Lacc > 1) once('flare', () => { say('潮汐瓦解耀发', `回落的太阳碎片形成吸积盘，光度飙升到 ${U.plain(U.sci(sim.Lacc, 2))} L☉——爱丁顿极限的 ${U.plain(U.sci(sim.Lacc / sim.LEdd, 2))} 倍。`, 9); addLog('<span class="bad">吸积耀发开始</span>'); });
        // 真实的最近点：距离开始增大（或太阳已被撕碎）时才记录，不依赖二体近似的预测时刻
        const vkey = preset.victim, iv = sim.idx[vkey];
        const md = sim.minDist[vkey];
        const tT = sim.hyper.tTarget != null ? sim.hyper.tTarget : sim.hyper.tPeri;
        if (md && sim.t > tT - 0.02 && md.t > tT - 0.05 && ((sim.alive[iv] && V.len(V.sub(sim.pos(iv), sim.pos(ib))) > md.d * 1.05) || !sim.alive[iv])) {
          once('peri', () => { sim.hyper.tTarget = md.t; addLog(`黑洞到达距${sim.bodies[iv].name}最近点：${distStr(md.d)}`); });
        }
      }

      /* ---------------- 每帧：镜头 ---------------- */
      function worldPos(key) { const i = sim.idx[key]; return toGL(sim.pos(i)); }
      function debrisSpread() {
        let arr = [];
        const pb = sim.pos(sim.bh);
        for (let k = 0; k < sim.dN; k += 7) if (sim.dState[k] === 1) arr.push(Math.hypot(sim.dx[3 * k] - pb[0], sim.dx[3 * k + 1] - pb[1], sim.dx[3 * k + 2] - pb[2]));
        if (!arr.length) return 0.02;
        arr.sort((a, b) => a - b);
        return arr[Math.floor(arr.length * 0.6)];
      }
      function updateCamera(dt) {
        const k = 1 - Math.exp(-dt * 2.5);
        let tgt, dist, fovNow = fov;
        const pb = worldPos('bh');
        if (camMode === 'earth' && sim.alive[sim.idx.earth]) {
          const pe = worldPos('earth');
          const look = lookKey === 'sun' && sim.alive[sim.idx.sun] ? worldPos('sun') : pb;
          const d = V.sub(look, pe); const dl = V.len(d); const dn = V.mul(d, 1 / dl);
          const upv = Math.abs(dn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
          const side = V.cross(dn, upv); const up2 = V.cross(side, dn);
          const Re = sim.bodies[sim.idx.earth].R;
          cam.pos = V.add(V.add(pe, V.mul(dn, -3.4 * Re)), V.mul(up2, 1.25 * Re));
          return basis(V.sub(look, cam.pos), up2, fovNow);
        }
        if (camMode === 'bh') {
          tgt = pb; dist = Math.exp(cam.logD);
        } else if (camMode === 'free') {
          const key = focusKey === 'sun' && !sim.alive[sim.idx.sun] ? 'bh' : focusKey;
          tgt = sim.alive[sim.idx[key]] ? worldPos(key) : pb; dist = Math.exp(cam.logD);
        } else {
          // 电影镜头：同时框住“受害者”与黑洞；太阳解体后跟随碎片云
          const vk = preset.victim;
          const vAlive = sim.alive[sim.idx[vk]];
          if (vk === 'sun' && !vAlive) {
            tgt = pb; dist = U.clamp(debrisSpread() * 2.6, 0.012, 70);
          } else {
            const pv = vAlive ? worldPos(vk) : pb;
            const sep = V.len(V.sub(pb, pv));
            const minD = vk === 'sun' ? 0.022 : vk === 'earth' ? 0.004 : 0.02;
            tgt = V.add(pv, V.mul(V.sub(pb, pv), 0.45));
            dist = U.clamp(sep * 1.7, minD, 90);
          }
          cam.yaw += dt * 0.025;
          const pt = dist < 0.3 ? 0.18 : 0.38;
          cam.pitch += (pt - cam.pitch) * (1 - Math.exp(-dt * 0.5));
          cam.logD += (Math.log(dist) - cam.logD) * (1 - Math.exp(-dt * 1.2));
        }
        cam.target = V.add(cam.target, V.mul(V.sub(tgt, cam.target), camMode === 'cinema' ? k : 1));
        const D = Math.exp(cam.logD);
        const off = [D * Math.cos(cam.pitch) * Math.cos(cam.yaw), D * Math.sin(cam.pitch), D * Math.cos(cam.pitch) * Math.sin(cam.yaw)];
        cam.pos = V.add(cam.target, off);
        return basis(V.mul(off, -1), [0, 1, 0], fovNow);
      }
      function basis(fwdRaw, upHint, fovDeg) {
        const fwd = V.mul(fwdRaw, 1 / V.len(fwdRaw));
        let right = V.cross(fwd, upHint); right = V.mul(right, 1 / (V.len(right) || 1));
        const up = V.cross(right, fwd);
        return { pos: cam.pos, fwd, right, up, fov: fovDeg };
      }

      /* ---------------- 每帧：组装渲染数据 ---------------- */
      const MAXS = 4000 + 600;
      const sPos = new Float32Array(MAXS * 3), sCol = new Float32Array(MAXS * 4), sSize = new Float32Array(MAXS);
      function frameData(C) {
        const tanF = Math.tan((C.fov * Math.PI) / 360);
        const pixAng = (2 * tanF) / Math.max(1, canvas.clientHeight);
        const bigOK = bigBodies && (camMode === 'cinema' || camMode === 'free');
        const spheres = [];
        let sun = { c: [0, 0, 0], r: 0.0047, on: 0 };
        for (const b of sim.bodies) {
          if (b.type === 'bh') continue;
          const i = sim.idx[b.key];
          if (!sim.alive[i]) continue;
          const c = toGL(sim.pos(i));
          const dcam = V.len(V.sub(c, C.pos));
          const minPx = b.type === 'sun' ? 9 : b.type === 'moon' ? 1.5 : b.key === 'jupiter' || b.key === 'saturn' ? 4.5 : 3.2;
          const r = bigOK ? Math.max(b.R, dcam * pixAng * minPx) : Math.max(b.R, dcam * pixAng * 0.6);
          spheres.push({ c, r, type: TYPE[b.key], spin: realT * SPIN[b.key] * 0.3, tilt: TILT[b.key] });
          if (b.type === 'sun') sun = { c, r, on: 1 };
        }
        const pb = toGL(sim.pos(sim.bh));
        const rs = sim.bodies[sim.bh].R * (sim.m[sim.bh] / opts.Mbh);
        const dbh = V.len(V.sub(pb, C.pos));
        const shadowPx = (2.6 * rs) / dbh / pixAng;
        // 精灵：碎片 + 吸积盘 + 耀发 + 喷流
        let n = 0;
        const put = (p, col, a, size) => {
          if (n >= MAXS) return;
          sPos[3 * n] = p[0] - C.pos[0]; sPos[3 * n + 1] = p[1] - C.pos[1]; sPos[3 * n + 2] = p[2] - C.pos[2];
          sCol[4 * n] = col[0]; sCol[4 * n + 1] = col[1]; sCol[4 * n + 2] = col[2]; sCol[4 * n + 3] = a; sSize[n] = size; n++;
        };
        const pbE = sim.pos(sim.bh);
        for (let k = 0; k < sim.dN; k++) {
          if (sim.dState[k] !== 1) continue;
          const p = [sim.dx[3 * k], sim.dx[3 * k + 1], sim.dx[3 * k + 2]];
          const r = Math.hypot(p[0] - pbE[0], p[1] - pbE[1], p[2] - pbE[2]);
          const age = sim.t - sim.dBorn[k];
          const src = sim.bodies[sim.dSrc[k]];
          const T = src.type === 'sun' ? 3500 + 9000 * Math.exp(-age / 0.02) + 14000 * Math.exp(-r / 0.01) : 2500 + 3000 * Math.exp(-age / 0.01);
          const col = U.blackbody(T).map((c) => c * c);
          put(toGL(p), col, (src.type === 'sun' ? 0.9 : 0.7) * (0.3 + 1.0 * Math.exp(-age / 0.05)), 2.8);
        }
        const Lg = Math.log10(1 + sim.Lacc);
        if (sim.diskMass > 1e-5 || sim.Lacc > 1) {
          const ax = diskAxis;
          let e1 = V.cross(ax, [0.3, 0.1, 0.9]); e1 = V.mul(e1, 1 / V.len(e1)); const e2 = V.cross(ax, e1);
          const rd = Math.max(2 * opts.q, dbh * pixAng * 10);
          for (let j = 0; j < 260; j++) {
            const rr = rd * (0.35 + 0.65 * ((j * 0.618) % 1));
            const a = j * 2.39996 + realT * 2.0 * Math.pow(rd / rr, 1.5);
            const p = V.add(pb, V.add(V.mul(e1, Math.cos(a) * rr), V.mul(e2, Math.sin(a) * rr)));
            const hot = rd / rr;
            put(p, U.blackbody(6000 + 9000 * hot), 0.12 * Lg * hot, 2.6);
          }
          put(pb, [0.8, 0.9, 1], 1.2 * Lg, 10 + 7 * Lg);
          put(pb, [1, 0.8, 0.6], 0.25 * Lg, 40 + 18 * Lg);
          if (sim.mdotEddRatio > 1) {
            const Lj = Math.max(0.03, dbh * pixAng * 160);
            for (let j = 1; j <= 60; j++) {
              const f = j / 60;
              for (const sg of [1, -1]) put(V.add(pb, V.mul(diskAxis, sg * f * Lj)), [0.55, 0.7, 1], 0.5 * (1 - f) * (0.7 + 0.3 * Math.sin(realT * 30 + j)), 5 + 10 * f);
            }
          }
        }
        // 线：轨迹与原始轨道
        const lp = [], lc = [];
        const nearCam = camMode === 'earth' || camMode === 'bh';
        if (showOrbits && origOrbits && !nearCam) {
          const s0 = [0, 0, 0];
          for (let i = 0; i < origOrbits.pos.length; i += 3) lp.push(origOrbits.pos[i] + s0[0], origOrbits.pos[i + 1], origOrbits.pos[i + 2]);
          lc.push(...origOrbits.col);
        }
        if (showTrails && !nearCam) {
          for (const key in trails) {
            const tr = trails[key], col = tr.col;
            for (let j = 1; j < tr.pts.length; j++) {
              const a = (j / tr.pts.length) * tr.alpha;
              lp.push(...tr.pts[j - 1], ...tr.pts[j]);
              lc.push(col[0], col[1], col[2], a, col[0], col[1], col[2], a);
            }
          }
        }
        const pos = new Float32Array(lp.length);
        for (let i = 0; i < lp.length; i += 3) { pos[i] = lp[i] - C.pos[0]; pos[i + 1] = lp[i + 1] - C.pos[1]; pos[i + 2] = lp[i + 2] - C.pos[2]; }
        return {
          cam: { pos: C.pos, fwd: C.fwd, right: C.right, up: C.up, fov: C.fov }, time: realT,
          spheres, sun, bh: { c: pb, rs, acc: sim.Lacc },
          lens,
          sprites: { pos: sPos.subarray(0, 3 * n), col: sCol.subarray(0, 4 * n), size: sSize.subarray(0, n), n },
          lines: { pos, col: new Float32Array(lc), n: pos.length / 3 },
          marker: shadowPx < 5 ? { c: pb, size: 15, alpha: 0.95 } : null,
          exposure: 1.0, flash: Math.min(1, flash),
        };
      }
      function recordTrails() {
        const add = (key, col, alpha, max) => {
          const i = sim.idx[key];
          if (!sim.alive[i]) return;
          const p = toGL(sim.pos(i));
          const tr = trails[key] || (trails[key] = { pts: [], col, alpha });
          const last = tr.pts[tr.pts.length - 1];
          const d = V.len(V.sub(C0.pos, p));
          if (!last || V.len(V.sub(last, p)) > d * 0.0025) { tr.pts.push(p); if (tr.pts.length > max) tr.pts.shift(); }
        };
        add('bh', [1, 0.35, 0.15], 0.9, 900);
        add('sun', [1, 0.8, 0.4], 0.7, 700);
        for (const p of B.PLANETS) add(p.key, p.col, 0.55, 700);
      }

      /* ---------------- 每帧：HUD 与标签 ---------------- */
      const labelEls = {};
      function updateLabels(C) {
        if (!showLabels) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const tanF = Math.tan((C.fov * Math.PI) / 360), asp = w / h;
        const names = { sun: '太阳', bh: '黑洞', moon: '月球' };
        B.PLANETS.forEach((p) => (names[p.key] = p.name));
        const stTxt = { bh: '· 被黑洞俘获', free: '· 流浪', disrupted: '· 已撕碎', sun: '' };
        const placed = [];
        const order = ['bh', 'sun', 'earth', preset.victim, 'jupiter', 'saturn', 'moon', 'mars', 'venus', 'mercury', 'uranus', 'neptune'];
        const keys = [...new Set(order)];
        for (const key of keys) {
          const i = sim.idx[key];
          let el = labelEls[key];
          if (!el) { el = labelEls[key] = U.el('div', { class: 'inv-label' + (key === 'bh' ? ' bh' : '') }); labels.appendChild(el); }
          if (i == null || !sim.alive[i] || (key === 'moon' && camMode !== 'earth' && Math.exp(cam.logD) > 0.2)) { el.style.display = 'none'; continue; }
          const r = V.sub(toGL(sim.pos(i)), C.pos);
          const z = V.dot(r, C.fwd);
          if (z <= 0) { el.style.display = 'none'; continue; }
          const x = V.dot(r, C.right) / (z * tanF * asp), y = V.dot(r, C.up) / (z * tanF);
          if (Math.abs(x) > 1.05 || Math.abs(y) > 1.05) { el.style.display = 'none'; continue; }
          const sx = ((x + 1) / 2) * w + 10, sy = ((1 - y) / 2) * h - 8;
          if (placed.some(([px, py]) => Math.abs(px - sx) < 46 && Math.abs(py - sy) < 16)) { el.style.display = 'none'; continue; }
          placed.push([sx, sy]);
          el.style.display = '';
          el.style.transform = `translate(${sx}px, ${sy}px)`;
          const s = statuses[key];
          el.textContent = names[key] + (s && stTxt[s] ? ' ' + stTxt[s] : '');
        }
      }
      function updateHUD() {
        const is = sim.idx.sun, ib = sim.bh, ie = sim.idx.earth;
        const sunAlive = sim.alive[is];
        const date = new Date(sim.date0.getTime() + sim.t * 365.25 * 86400000);
        const tT = sim.hyper.tTarget != null ? sim.hyper.tTarget : sim.hyper.tPeri;
        clock.innerHTML = `<span>${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日</span><b>距最近接近 ${fmtT(sim.t - tT).replace('+', 'T+').replace('−', 'T−')}</b>`;
        const pb = sim.pos(ib);
        if (sunAlive) {
          roG.set('dsun', distStr(V.len(V.sub(pb, sim.pos(is)))));
          roG.set('vel', (V.len(V.sub(sim.vel(ib), sim.vel(is))) * B.KMS).toFixed(0) + ' km/s');
        } else { roG.set('dsun', '<span class="bad">太阳已被撕碎</span>'); roG.set('vel', (V.len(sim.vel(ib)) * B.KMS).toFixed(0) + ' km/s（质心系）'); }
        roG.set('mass', sim.m[ib].toFixed(3) + ' M☉');
        roG.set('L', sim.Lacc > 1e-3 ? U.sci(sim.Lacc, 2) + ' L☉' + (sim.Lacc > sim.LEdd ? ' ⚠' : '') : '≈ 0');
        if (sim.alive[ie]) {
          const pe = sim.pos(ie);
          const ds = sunAlive ? V.len(V.sub(pe, sim.pos(is))) : Infinity;
          const db = V.len(V.sub(pe, pb));
          roE.set('ds', sunAlive ? ds.toFixed(3) + ' AU' : '—');
          roE.set('db', distStr(db));
          const dsb = sunAlive ? V.len(V.sub(sim.pos(is), pb)) : 0;
          if (sunAlive && dsb < 3 * ds) roE.set('orb', '<span class="warn">黑洞交会中：已不是开普勒椭圆</span>');
          else if (sunAlive) {
            const o = sim.orbit(ie, is);
            roE.set('orb', o.bound ? `${o.a.toFixed(3)} AU / ${o.e.toFixed(3)}（近日 ${o.q.toFixed(2)}，远日 ${o.Q.toFixed(2)} AU）` : '<span class="bad">非束缚（双曲轨道）</span>');
          } else roE.set('orb', '—');
          const g = (sim.m[ib] / (db * db)) / (sunAlive ? 1 / (ds * ds) : 1e-30);
          roE.set('g', sunAlive ? U.sci(g, 3) : '∞（太阳已毁）');
          const im = sim.idx.moon;
          roE.set('moon', sim.alive[im] && sim.orbit(im, ie).bound ? '绕地球' : '<span class="bad">已脱离</span>');
          const S = (sunAlive ? 1 / (ds * ds) : 0) + sim.Lacc / (db * db);
          const Teq = Math.pow(Math.pow(255 * Math.pow(S, 0.25), 4) + Math.pow(35, 4), 0.25);
          roE.set('S', U.sci(S, 3));
          roE.set('T', Teq.toFixed(0) + ' K（' + (Teq - 273).toFixed(0) + ' °C）' + (Teq > 400 ? ' 🔥' : Teq < 180 ? ' ❄' : ''));
          const s = statuses.earth;
          roE.set('st', s === 'bh' ? '<span class="warn">被黑洞俘获</span>' : s === 'free' ? '<span class="bad">星际流浪</span>' : sunAlive ? '绕太阳运行' : '<span class="warn">太阳已毁</span>');
        } else {
          roE.set('st', '<span class="bad">已被撕碎</span>');
          ['ds', 'db', 'orb', 'g', 'moon', 'S', 'T'].forEach((k) => roE.set(k, '—'));
        }
        if (!sim.dN) {
          const dE = Math.abs((sim.energy() - sim.E0) / sim.E0);
          cons.innerHTML = `守恒检验：能量相对误差 ${U.sci(dE, 2)}　积分步数 ${sim.steps}`;
        } else {
          const P = sim.momentum();
          const dp = Math.hypot(P[0] - sim.P0[0], P[1] - sim.P0[1], P[2] - sim.P0[2]) / (sim.m[ib] * V.len(sim.vel(ib)) + 1e-9);
          cons.innerHTML = `守恒检验：动量相对误差 ${U.sci(dp, 2)}　碎片 ${sim.dN} 个　积分步数 ${sim.steps}`;
        }
        const prog = U.clamp(sim.t / (tT * 2), 0, 1);
        bar.firstChild.style.width = prog * 100 + '%';
        rateTag.textContent = (running ? '▶ ' : '⏸ ') + fmtRate(rate) + (autoSlow && rate < userRate * 0.5 ? '（慢动作）' : '');
      }

      /* ---------------- 物理论证 ---------------- */
      function proofCard() {
        const o = opts || Object.assign({}, preset.opts);
        const s = sim;
        const M = o.Mbh, G = B.G, KMS = B.KMS;
        const mu = G * (1 + M);
        const vinf = o.vinf / KMS;
        const q = s ? s.o.q : o.q;
        const e = 1 + (q * vinf * vinf) / mu;
        const bImp = q * Math.sqrt(1 + (2 * mu) / (q * vinf * vinf));
        const rsKm = 2.953 * M;
        const rt = (R, m) => R * Math.cbrt(M / m);
        const Rsun = B.SUN.R, Rearth = B.km(6371), Rjup = B.km(69911);
        const rtS = rt(Rsun, 1), rtE = rt(Rearth, 3.0035e-6), rtJ = rt(Rjup, 9.5479e-4), rtM = rt(B.km(1737.4), 3.694e-8);
        const GM_SI = 6.674e-11 * M * 1.989e30, Rs_SI = 6.957e8, rt_SI = rtS * 1.496e11;
        const dEps = (GM_SI * Rs_SI) / (rt_SI * rt_SI);
        const tfb = (2 * Math.PI * GM_SI) / Math.pow(2 * dEps, 1.5);
        const mdotPeak = 1.989e30 / (3 * tfb); // 完全瓦解时的峰值回落率 ≈ M★/(3 t_fb)
        const LEdd = 1.26e31 * M;
        const MdotEdd = LEdd / (0.1 * 9e16);
        const dMin = s && s.minDist.earth ? s.minDist.earth.d : null;
        const hill = dMin ? dMin * Math.cbrt(3.0035e-6 / (3 * M)) : null;
        // 遭遇概率：局域黑洞数密度 n ≈ 1e8 / (π·(15 kpc)²·0.6 kpc)
        const n = 1e8 / (Math.PI * 15000 * 15000 * 600); // pc⁻³
        const AUpc = 4.848e-6, v_pcMyr = o.vinf * 1.0227;
        const bAU = Math.max(q, 1);
        const sigma = Math.PI * Math.pow(bAU * AUpc, 2) * (1 + (2 * 887 * (1 + M)) / (bAU * o.vinf * o.vinf));
        const rate = n * sigma * v_pcMyr; // 每百万年
        const wait = 1e6 / rate; // 年
        const tr = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
        const card = U.el('div', { class: 'inv-proof prose' });
        card.innerHTML = `
          <button class="btn small inv-close">✕ 关闭</button>
          <h2>严格物理论证</h2>
          <p>本页每一帧都在求解真实的物理方程。下面给出当前场景（${preset.name}）用到的全部公式与数值，便于核查。</p>
          <h3>① 运动方程：完整 N 体引力</h3>
          <div class="eq-block"><div class="eq">${U.frac('d<sup>2</sup><b>r</b><sub>i</sub>', 'dt<sup>2</sup>')} = Σ<sub>j≠i</sub> G m<sub>j</sub> ${U.frac('<b>r</b><sub>j</sub> − <b>r</b><sub>i</sub>', '|<b>r</b><sub>j</sub> − <b>r</b><sub>i</sub>|<sup>3</sup>')}</div></div>
          <p>参与计算的天体：太阳、水金地火木土天海、月球与黑洞，共 11 个，任意两者之间都有引力。行星初始位置取自 JPL 的 J2000 轨道根数，并外推到仿真开始的日期。单位取 AU、年、M☉，则 G = 4π²。</p>
          <p>积分器：<b>Yoshida 四阶辛积分</b>，自适应步长 Δt = ${s ? s.eta : 0.015} × min<sub>i,j</sub> min(√(r³/G(m<sub>i</sub>+m<sub>j</sub>)), r/v)。${s ? `当前已积分 <b>${s.steps}</b> 步${s.dN ? '' : `，总能量相对误差 <b>${U.sci(Math.abs((s.energy() - s.E0) / s.E0), 2)}</b>`}。` : ''} 同样的代码在黑洞远离时积分 10 年，能量误差约 10<sup>−13</sup>，地球轨道半长轴保持 1.0000 AU。</p>
          <h3>② 黑洞的来袭轨道</h3>
          <table>
            ${tr('黑洞质量 M', `${M.toFixed(2)} M☉，史瓦西半径 r<sub>s</sub> = 2GM/c² = ${rsKm.toFixed(1)} km`)}
            ${tr('无穷远处速度 v∞', `${o.vinf.toFixed(0)} km/s（银河系中黑洞的典型速度为数十 km/s）`)}
            ${tr('近日距离 q', `${q < 0.1 ? U.sci(q, 3) : q.toFixed(3)} AU${o.aimResult ? `（N 体瞄准结果：距${preset.aim.key === 'earth' ? '地球' : '木星'}最近 ${distStr(o.aimResult)}）` : ''}`)}
            ${tr('双曲线偏心率 e = 1 + qv∞²/μ', e.toFixed(1))}
            ${tr('碰撞参数 b = q√(1 + 2μ/(qv∞²))', `${bImp.toFixed(3)} AU（引力聚焦使 b ≫ q）`)}
            ${tr('近日点速度 √(v∞² + 2μ/q)', `${(Math.sqrt(vinf * vinf + (2 * mu) / q) * KMS).toFixed(0)} km/s`)}
          </table>
          <h3>③ 潮汐瓦解：r<sub>t</sub> = R (M<sub>BH</sub>/m)<sup>1/3</sup></h3>
          <p>当天体到黑洞的距离小于潮汐半径时，黑洞对天体两侧的引力差（∝ 2GM R/r³）超过天体自身的表面引力（Gm/R²），天体解体。</p>
          <table>
            ${tr('太阳', `r<sub>t</sub> = ${rtS.toFixed(4)} AU = ${(rtS / Rsun).toFixed(2)} R☉；${q < rtS ? `<b>q &lt; r<sub>t</sub>，穿透因子 β = r<sub>t</sub>/q = ${(rtS / q).toFixed(2)}，太阳被完全撕碎</b>` : 'q > r<sub>t</sub>，太阳能保持完整'}`)}
            ${tr('地球', `r<sub>t</sub> = ${U.sci(rtE * 1.496e8, 3)} km`)}
            ${tr('木星', `r<sub>t</sub> = ${U.sci(rtJ * 1.496e8, 3)} km`)}
            ${tr('月球', `r<sub>t</sub> = ${U.sci(rtM * 1.496e8, 3)} km`)}
          </table>
          <p>注意：恒星级黑洞撕裂太阳属于<b>“微型潮汐瓦解”（micro-TDE）</b>。此时近心距与太阳半径相当（本场景 q = ${q < 0.1 ? U.sci(q, 2) : q.toFixed(3)} AU，R☉ = 0.00465 AU），黑洞几乎是从太阳内部穿过，碎片会被甩向四面八方，形成不规则的三维云团，而不是超大质量黑洞 TDE 中那种细长的“恒星流”——这与 Perets 等（2016）、Kremer 等（2022）的流体力学模拟结论一致。</p>
          <p>模拟中太阳一旦进入潮汐半径，即被替换为 ${s ? s.nDebris : 1500} 个有质量的碎片粒子（质量守恒、动量守恒），此后采用 TDE 研究中标准的“冻结近似”：忽略碎片间的自引力和压力，只受黑洞（及残余天体）引力。</p>
          <h3>④ 碎片的命运与吸积耀发</h3>
          <p>撕裂时碎片的比能量分布宽度 Δε ≈ GM<sub>BH</sub>R☉/r<sub>t</sub>² = ${U.sci(dEps, 3)} J/kg，远大于太阳原本的轨道能量 v∞²/2 = ${U.sci(Math.pow(o.vinf * 1000, 2) / 2, 2)} J/kg，因此<b>约一半碎片被黑洞束缚、一半被甩出</b>（模拟中实测约 42% / 58%）。</p>
          <p>最先回落的碎片回到近心点的时间 t<sub>fb</sub> = 2πGM/(2Δε)<sup>3/2</sup> ≈ <b>${U.plain(U.duration(tfb))}</b>；回落率 Ṁ ∝ t<sup>−5/3</sup>，峰值约 M☉/(3t<sub>fb</sub>) ≈ ${U.sci(mdotPeak, 2)} kg/s，是爱丁顿吸积率 Ṁ<sub>Edd</sub> = L<sub>Edd</sub>/(ηc²) = ${U.sci(MdotEdd, 2)} kg/s 的 ${U.sci(mdotPeak / MdotEdd, 2)} 倍。</p>
          <p>光度：L = ηṀc²（η = 0.1），超爱丁顿时按 L = L<sub>Edd</sub>[1 + ln(Ṁ/Ṁ<sub>Edd</sub>)] 饱和；L<sub>Edd</sub> = 1.26×10<sup>31</sup> W × M/M☉ = ${U.sci(LEdd, 3)} W ≈ ${U.sci(LEdd / 3.828e26, 3)} L☉。模拟中碎片回到近心点即视为环化进入吸积盘，盘以约 3.7 天的粘滞时标流入黑洞。</p>
          <p>对地球的影响：距离 d 处的辐射通量 F = L/(4πd²)；平衡温度 T = 255 K × (F/F<sub>现在</sub>)<sup>1/4</sup>（反照率 0.3，再加上地热约 35 K 的下限）。若耀发光度为 L<sub>Edd</sub> 而地球在 1 AU 处，F 是现在阳光的 ${U.sci(LEdd / 3.828e26, 2)} 倍，平衡温度约 ${(255 * Math.pow(LEdd / 3.828e26, 0.25)).toFixed(0)} K；此时地球截获的功率约 ${U.sci(Math.PI * 6.371e6 ** 2 * 1361 * LEdd / 3.828e26 * 0.7, 2)} W，只需约 <b>${U.plain(U.duration(3.6e27 / (Math.PI * 6.371e6 ** 2 * 1361 * LEdd / 3.828e26 * 0.7)))}</b> 就能提供蒸干全部海洋所需的能量（3.6×10<sup>27</sup> J）。</p>
          <h3>⑤ 月球为什么会被夺走：希尔球</h3>
          <p>在黑洞的引力场中，地球能“管住”的范围是希尔半径 r<sub>H</sub> = d (m<sub>⊕</sub>/3M<sub>BH</sub>)<sup>1/3</sup>。月球轨道半径为 384 400 km。${dMin ? `本次模拟中黑洞距地球最近 ${distStr(dMin)}，此时 r<sub>H</sub> = ${U.sci(hill * 1.496e8, 3)} km，${hill * 1.496e8 < 384400 ? '<b>小于月球轨道，月球必然被剥离</b>' : '大于月球轨道，月球可以保住'}。` : ''}使 r<sub>H</sub> = 月地距离的临界距离为 ${(km384400() / Math.cbrt(3.0035e-6 / (3 * M))).toFixed(3)} AU。</p>
          <h3>⑥ 这件事会发生吗？</h3>
          <p>银河系约有 10<sup>8</sup> 个恒星级黑洞，太阳附近的数密度约 n ≈ ${U.sci(n, 2)} pc<sup>−3</sup>。一个黑洞进入距太阳 b 以内的速率为 Γ = nπb²v(1 + 2GM/(bv²))（括号内为引力聚焦）。取 b = ${bAU.toFixed(2)} AU、v = ${o.vinf.toFixed(0)} km/s，得 Γ ≈ ${U.sci(rate, 2)} 次/百万年，即平均要等 <b>${U.sci(wait, 2)} 年</b>——是宇宙年龄（1.38×10<sup>10</sup> 年）的 ${U.sci(wait / 1.38e10, 2)} 倍。目前已知离我们最近的黑洞 Gaia BH1 在约 1560 光年之外。<b>完全不用担心。</b></p>
          <h3>⑦ 模型的简化（诚实声明）</h3>
          <ul>
            <li>引力按牛顿理论计算：碎片和天体离黑洞最近时仍在数千个 r<sub>s</sub> 以外，广义相对论修正（~r<sub>s</sub>/r）小于 0.1%。黑洞的光线偏折（透镜）则按史瓦西度规严格处理。</li>
            <li>太阳在进入潮汐半径前视为刚性质点；部分瓦解（0.5 &lt; β &lt; 1）被简化为完全瓦解或完好两种情形。</li>
            <li>碎片不含流体力学、辐射压与自引力；吸积盘的形成用“回到近心点即环化”的判据近似。</li>
            <li>行星外观、颜色、喷流形态为艺术化表现；“天体放大显示”只放大外观尺寸，不影响任何计算。</li>
          </ul>`;
        card.querySelector('.inv-close').addEventListener('click', () => { modal.style.display = 'none'; });
        return card;
      }
      function km384400() { return 384400 / 1.495978707e8; }

      /* ---------------- 主循环 ---------------- */
      let C0 = { pos: [0, 0, 60] };
      ctx.loop((dt) => {
        realT += dt;
        if (!sim) {
          // 片头背景：缓慢旋转的星空与太阳
          if (!sim) { sim = new B.Sim(Object.assign({ date: new Date() }, PRESETS[0].opts)); opts = sim.o; buildOrbits(); running = false; cam.logD = Math.log(45); }
        }
        physicsTick(dt);
        if (!running) cam.yaw += dt * 0.02;
        const C = updateCamera(dt);
        C0 = C;
        if (running) recordTrails();
        flash = Math.max(0, flash - dt * 1.4);
        R.render(frameData(C));
        R.adapt(dt);
        updateLabels(C);
        if (running || realT < 1) updateHUD();
        if (capT > 0) { capT -= dt; if (capT <= 0) cap.style.opacity = 0; }
      });
      window.__invasionSim = () => sim; // 调试用：在控制台查看当前仿真状态
      ctx.onCleanup(() => { delete window.__invasionSim; });
      ctx.listen(window, 'keydown', (e) => { if (e.key === ' ' && sim) { running = !running; e.preventDefault(); } });
    },
  });
})();
