/* 沉浸漫游：驾驶飞船接近并坠入黑洞 */
(function () {
  'use strict';
  const P = U.PHYS;

  const STOPS = [
    { r: 28, t: '你的飞船正在接近一个超大质量黑洞', s: '前方那圈发光的“光环”是吸积盘——被弯曲的光线让你同时看到了它的正面和背面' },
    { r: 14, t: '进入吸积盘外区', s: '左右两侧亮度不同：朝你运动的气体因多普勒效应更亮' },
    { r: 6, t: '距离 6 rₛ：强引力区', s: '这里的时钟比地球慢 9%，天空开始明显扭曲' },
    { r: 3, t: '越过 ISCO（3 rₛ）', s: '从这里开始，再也没有稳定的圆轨道——只能靠引擎推力悬停' },
    { r: 1.5, t: '光子球（1.5 rₛ）', s: '光在这里可以绕黑洞转圈；向侧面看，理论上能看到自己的后背' },
    { r: 1.12, t: '事件视界近在咫尺', s: '黑洞的阴影已经占据了大半个天空，外面的宇宙被压缩成一个明亮的圆' },
  ];

  App.page('explore', {
    title: '沉浸漫游',
    bodyClass: 'fullscreen-page',
    build(ctx) {
      const wrap = U.el('div', { class: 'explore-wrap' });
      ctx.root.appendChild(wrap);
      const r = BHRenderer.mount(wrap, {
        camera: { yaw: 0.3, pitch: 0.2, dist: 30, fov: 65, minDist: 1.6, maxDist: 80 },
        autoRotate: 0.02,
        params: { diskOut: 18 },
      });
      ctx.onCleanup(() => r.destroy());
      if (!r.ok) return;

      // ---- 左侧：仪表 ----
      let Msol = 4.3e6;
      const left = U.el('div', { class: 'hud-left' });
      left.appendChild(U.el('h4', { text: '飞船仪表', style: { margin: '0 0 8px', color: 'var(--accent)' } }));
      const ro = U.readouts(left, [
        { key: 'r', label: '距中心 r / r<sub>s</sub>' },
        { key: 'km', label: '实际距离' },
        { key: 'td', label: '时钟快慢（相对远处）' },
        { key: 've', label: '逃逸速度' },
        { key: 'tid', label: '头脚潮汐差', wide: true },
      ]);
      wrap.appendChild(left);

      // ---- 右侧：控制 ----
      const hud = U.el('div', { class: 'hud' });
      const toggleBtn = U.el('button', { class: 'btn small hud-toggle', text: '隐藏面板', style: { display: 'none' } });
      wrap.appendChild(hud);
      wrap.appendChild(toggleBtn);
      hud.appendChild(U.el('h4', { text: '✦ 沉浸漫游' }));
      hud.appendChild(U.el('div', { class: 'ctrl-hint', html: '拖动旋转视角，滚轮 / 双指缩放。也可以按下方按钮开始一段“坠入黑洞”的旅程。' }));
      const [goBtn] = U.buttons(hud, [
        { label: '▶ 开始坠入黑洞', primary: true, onClick: () => startJourney() },
        { label: '↺ 回到远处', onClick: () => resetView() },
      ]);
      U.slider(hud, { label: '黑洞质量', min: 5, max: 1e10, value: Msol, log: true, format: (v) => U.sci(v, 2) + ' M☉', onInput: (v) => { Msol = v; } });
      const P2 = r.params;
      U.toggle(hud, { label: '吸积盘', value: true, onChange: (v) => { P2.disk = v; } });
      U.toggle(hud, { label: '多普勒效应', value: true, onChange: (v) => { P2.doppler = v; } });
      U.toggle(hud, { label: '引力透镜', value: true, onChange: (v) => { P2.lensing = v; } });
      U.segmented(hud, { label: '背景', value: '0', options: [{ value: '0', label: '星空' }, { value: '1', label: '网格' }], onChange: (v) => { P2.bg = +v; } });
      U.slider(hud, { label: '视野角', min: 30, max: 110, step: 1, value: 65, format: (v) => v + '°', onInput: (v) => { r.cam.fov = v; } });
      U.select(hud, {
        label: '渲染质量', value: r.quality,
        options: [{ value: 'low', label: '流畅（低）' }, { value: 'medium', label: '标准（中）' }, { value: 'high', label: '精细（高）' }],
        onChange: (v) => r.setQuality(v),
      });
      const hide = U.el('button', { class: 'btn small', text: '收起面板 →', on: { click: () => { hud.classList.add('collapsed'); toggleBtn.style.display = ''; } } });
      hud.appendChild(hide);
      toggleBtn.addEventListener('click', () => { hud.classList.remove('collapsed'); toggleBtn.style.display = 'none'; });

      const cap = U.el('div', { class: 'caption', style: { opacity: 0 } });
      wrap.appendChild(cap);
      let capTimer = 0;
      const say = (t, s) => { cap.innerHTML = t + (s ? `<small>${s}</small>` : ''); cap.style.opacity = 1; capTimer = 6; };

      // ---- 旅程 ----
      let journey = null;
      function startJourney() {
        journey = { stop: 0, t: 0, done: false };
        r.autoRotate = 0;
        r.cam.minDist = 0.9;
        r.target.dist = r.cam.dist = 30;
        r.target.pitch = 0.18;
        P2.fade = 1;
        goBtn.disabled = true;
        say(STOPS[0].t, STOPS[0].s);
        journey.stop = 1;
      }
      function resetView() {
        journey = null;
        P2.fade = 1;
        r.cam.minDist = 1.6;
        r.target.dist = 30; r.cam.dist = Math.max(r.cam.dist, 2);
        r.target.pitch = 0.2;
        r.autoRotate = 0.02;
        goBtn.disabled = false;
        cap.style.opacity = 0;
      }
      r.onFrame = (dt) => {
        const d = r.cam.dist;
        if (journey && !journey.done) {
          journey.t += dt;
          // 下落速度：远处快，近处慢，便于观赏
          const rate = 0.045 * Math.max(0.35, Math.min(1.4, d / 8));
          r.target.dist = Math.max(0.96, d * (1 - rate * dt * 2));
          r.cam.dist = r.target.dist;
          r.target.yaw += dt * 0.12 / Math.max(1, d / 6);
          r.target.pitch = U.lerp(0.02, 0.18, U.clamp((d - 1) / 25, 0, 1));
          const st = STOPS[journey.stop];
          if (st && d < st.r) { say(st.t, st.s); journey.stop++; }
          if (d < 1.06) P2.fade = U.clamp((d - 0.97) / 0.09, 0, 1);
          if (d <= 0.975) {
            journey.done = true;
            P2.fade = 0;
            const rs = U.rs(Msol * P.Msun);
            const tMax = (Math.PI / 2) * rs / P.c; // 从视界自由下落到奇点的最长固有时 πGM/c³
            say('你已穿过事件视界', `从此刻起，所有方向都指向中心。对 ${U.plain(U.sci(Msol, 2))} 倍太阳质量的黑洞，你最多还有约 ${U.plain(U.duration(tMax))} 到达奇点。<br>外面的世界，将永远看到你“冻结”在视界之上。`);
            capTimer = 1e9;
            goBtn.disabled = false;
          }
        }
        if (capTimer > 0) { capTimer -= dt; if (capTimer <= 0) cap.style.opacity = 0; }
        // 仪表
        const M = Msol * P.Msun, rs = U.rs(M), rr = Math.max(d, 1.0001);
        ro.set('r', d.toFixed(3));
        ro.set('km', U.length(d * rs));
        ro.set('td', d > 1 ? Math.sqrt(1 - 1 / rr).toFixed(4) : '0（视界内）');
        ro.set('ve', d > 1 ? Math.min(1, Math.sqrt(1 / rr)).toFixed(4) + ' c' : '> c');
        const tid = (2 * P.G * M * 2) / Math.pow(d * rs, 3) / 9.8;
        ro.set('tid', U.sci(tid, 3) + ' g' + (tid > 100 ? ' 💀' : tid > 1 ? ' ⚠' : ''));
      };
      say('欢迎来到黑洞', '拖动鼠标环顾四周，或点击右侧“开始坠入黑洞”');
    },
  });
})();
