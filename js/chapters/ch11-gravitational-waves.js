/* 第 11 章：引力波——聆听黑洞并合 */
(function () {
  'use strict';
  const P = U.PHYS;

  function merger(ctx) {
    const s = ctx.sim({
      title: '双黑洞并合：时空的涟漪',
      desc: '两个黑洞相互绕转，不断以引力波的形式辐射能量，于是越转越近、越转越快，最终在一瞬间合并成一个更大的黑洞，并像被敲响的钟一样“铃宕”几下归于平静。背景颜色表示时空被拉伸（橙）或压缩（蓝）的程度（已夸张放大）。',
      wide: true,
    });
    const cv = U.canvas(s.stage, { aspect: 16 / 8, maxHeight: 520 });
    const wave = U.canvas(s.stage, { height: 120 });
    let q = 0.8, speed = 1, Mtot = 65, sound = false;
    const ro = U.readouts(s.panel, [
      { key: 'a', label: '两黑洞间距' },
      { key: 'f', label: '引力波频率' },
      { key: 'v', label: '绕转速度' },
      { key: 'state', label: '阶段' },
    ]);
    U.slider(s.panel, { label: '质量比 m₂/m₁', min: 0.1, max: 1, step: 0.01, value: q, format: (v) => v.toFixed(2), onInput: (v) => { q = v; reset(); } });
    U.slider(s.panel, { label: '总质量（影响真实频率）', min: 5, max: 200, step: 1, value: Mtot, format: (v) => v + ' M☉', onInput: (v) => { Mtot = v; } });
    U.slider(s.panel, { label: '播放速度', min: 0.2, max: 3, step: 0.05, value: 1, format: (v) => v.toFixed(2) + '×', onInput: (v) => { speed = v; } });
    const sbox = U.el('div'); s.panel.appendChild(sbox);
    U.buttons(sbox, [
      { label: '↺ 重新开始', primary: true, onClick: () => reset() },
      { label: '🔊 同步声音（高 2 个八度）', onClick: (e) => { sound = !sound; e.currentTarget.classList.toggle('active', sound); if (sound) audioOn(); else audioOff(); } },
      { label: '♪ 播放真实时长的“啁啾”', onClick: () => realChirp() },
    ]);

    // ---- 物理状态（单位 G = c = M = 1）----
    let a, phi, t, merged, tm, hist, Am, phim;
    const aMerge = 2.3;
    function reset() { a = 10; phi = 0; t = 0; merged = false; tm = 0; hist = []; }
    reset();
    const nu = () => q / ((1 + q) * (1 + q));
    const wQNM = 0.55, tauQNM = 11;
    function step(dt) {
      if (!merged) {
        const sub = 20, h = dt / sub;
        for (let i = 0; i < sub; i++) {
          a -= ((64 / 5) * nu() / (a * a * a)) * h;
          if (a <= aMerge) { merged = true; tm = t; Am = (4 * nu()) / aMerge; phim = 2 * phi; break; }
          phi += Math.pow(a, -1.5) * h;
          t += h;
        }
        if (merged) t = tm;
      } else t += dt;
      // 源处的 h(t) 与相位
      let A, ph;
      if (!merged) { A = (4 * nu()) / a; ph = 2 * phi; }
      else { const d = t - tm; A = Am * Math.exp(-d / tauQNM); ph = phim + wQNM * d; }
      hist.push({ t, A, ph });
      if (hist.length > 4000) hist.shift();
      return { A, ph };
    }
    function sample(tr) { // 推迟时刻的 h
      if (!hist.length || tr < hist[0].t) return null;
      let lo = 0, hi = hist.length - 1;
      if (tr >= hist[hi].t) return hist[hi];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (hist[m].t <= tr) lo = m; else hi = m; }
      return hist[lo];
    }

    // ---- 声音 ----
    let actx = null, osc = null, gain = null;
    function audioOn() {
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        osc = actx.createOscillator(); gain = actx.createGain();
        osc.type = 'sine'; gain.gain.value = 0;
        osc.connect(gain).connect(actx.destination); osc.start();
      } catch (e) { console.warn(e); }
    }
    function audioOff() { try { if (osc) { osc.stop(); osc.disconnect(); } } catch (e) { /* 忽略 */ } osc = null; }
    ctx.onCleanup(() => { audioOff(); if (actx) actx.close(); });
    function realChirp() {
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(), gn = actx.createGain();
        o.connect(gn).connect(actx.destination);
        const T = 1.2, N = 400;
        const fr = new Float32Array(N), am = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          const x = (i / N) * T;
          const tc = 1.0;
          if (x < tc) { const f = 35 * Math.pow(1 - x / (tc + 0.005), -3 / 8); fr[i] = Math.min(f, 250) * 4; am[i] = 0.05 + 0.25 * Math.pow(Math.min(f, 250) / 250, 0.9); }
          else { fr[i] = 250 * 4; am[i] = 0.3 * Math.exp(-(x - tc) / 0.03); }
        }
        const now = actx.currentTime + 0.05;
        o.frequency.setValueCurveAtTime(fr, now, T);
        gn.gain.setValueCurveAtTime(am, now, T);
        o.start(now); o.stop(now + T + 0.05);
      } catch (e) { console.warn(e); }
    }

    // ---- 渲染 ----
    const off = document.createElement('canvas');
    const OW = 200, OH = 100;
    off.width = OW; off.height = OH;
    const octx = off.getContext('2d');
    const img = octx.createImageData(OW, OH);
    ctx.loop((dt) => {
      const cur = step(dt * 55 * speed);
      const { ctx: g, w, h } = cv;
      const span = 90; // 视野半宽（M）
      const sc = w / 2 / span;
      // 波场
      const data = img.data;
      for (let j = 0; j < OH; j++) {
        for (let i = 0; i < OW; i++) {
          const x = ((i + 0.5) / OW - 0.5) * 2 * span;
          const y = ((j + 0.5) / OH - 0.5) * 2 * span * (h / w);
          const R = Math.hypot(x, y);
          const smp = sample(t - R);
          let v = 0;
          if (smp) v = (smp.A * 9) / Math.max(R, 6) * Math.cos(smp.ph - 2 * Math.atan2(y, x));
          v = U.clamp(v * 3, -1, 1);
          const k = (j * OW + i) * 4;
          if (v > 0) { data[k] = 255 * v; data[k + 1] = 140 * v; data[k + 2] = 40 * v; }
          else { data[k] = 40 * -v; data[k + 1] = 120 * -v; data[k + 2] = 255 * -v; }
          data[k + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.globalAlpha = 1;
      g.drawImage(off, 0, 0, w, h);
      g.fillStyle = 'rgba(2,3,8,0.35)'; g.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      // 黑洞
      const m1 = 1 / (1 + q), m2 = q / (1 + q);
      if (!merged) {
        const r1 = a * m2, r2 = a * m1;
        const x1 = cx + Math.cos(phi) * r1 * sc, y1 = cy + Math.sin(phi) * r1 * sc;
        const x2 = cx - Math.cos(phi) * r2 * sc, y2 = cy - Math.sin(phi) * r2 * sc;
        U.drawBH(g, x1, y1, Math.max(4, m1 * 1.2 * sc), 0, true);
        U.drawBH(g, x2, y2, Math.max(4, m2 * 1.2 * sc), 0, true);
      } else {
        const d = t - tm;
        if (d < 8) { const fl = 1 - d / 8; g.fillStyle = `rgba(255,240,210,${fl * 0.8})`; g.beginPath(); g.arc(cx, cy, 10 + d * 12, 0, 6.283); g.fill(); }
        const wob = 1 + 0.25 * Math.exp(-d / tauQNM) * Math.cos(wQNM * d);
        g.save(); g.translate(cx, cy); g.scale(wob, 1 / wob);
        U.drawBH(g, 0, 0, Math.max(5, 0.95 * 1.2 * sc), 0, true);
        g.restore();
      }
      U.text(g, '橙：空间被拉伸　蓝：空间被压缩（振幅已放大约 10²⁰ 倍）', 12, h - 14, { size: 11, color: 'rgba(255,255,255,0.6)', shadow: true });

      // 波形图
      {
        const { ctx: q2, w: ww, h: hh } = wave;
        q2.fillStyle = '#05070e'; q2.fillRect(0, 0, ww, hh);
        q2.strokeStyle = 'rgba(255,255,255,0.08)'; q2.beginPath(); q2.moveTo(0, hh / 2); q2.lineTo(ww, hh / 2); q2.stroke();
        const Tspan = 500;
        q2.strokeStyle = '#ffb454'; q2.lineWidth = 1.5; q2.beginPath();
        let first = true;
        for (const e of hist) {
          if (e.t < t - Tspan) continue;
          const x = ww - ((t - e.t) / Tspan) * ww;
          const y = hh / 2 - e.A * Math.cos(e.ph) * hh * 0.9 * 1.9;
          first ? q2.moveTo(x, y) : q2.lineTo(x, y); first = false;
        }
        q2.stroke();
        U.text(q2, '引力波波形 h(t)：“啁啾”信号——频率和振幅同时迅速增大', 10, 14, { size: 11, color: 'rgba(255,255,255,0.55)' });
      }

      // 读数
      const unitS = (P.G * Mtot * P.Msun) / P.c ** 3; // 1 M 对应的秒数
      const unitM = (P.G * Mtot * P.Msun) / P.c ** 2;
      const wgw = merged ? wQNM : 2 * Math.pow(a, -1.5);
      const fHz = wgw / (2 * Math.PI) / unitS;
      ro.set('a', merged ? '—（已合并）' : U.length(a * unitM));
      ro.set('f', fHz.toFixed(0) + ' Hz');
      ro.set('v', merged ? '—' : (Math.sqrt(1 / a) * 100).toFixed(0) + '% 光速');
      ro.set('state', !merged ? (a > 5 ? '旋近（inspiral）' : '临近合并！') : (t - tm < 40 ? '并合 → 铃宕（ringdown）' : '平静：一个新的、更大的黑洞'));
      if (osc && actx) {
        osc.frequency.setTargetAtTime(Math.min(2000, fHz * 4), actx.currentTime, 0.02);
        gain.gain.setTargetAtTime(U.clamp(cur.A * 1.8, 0, 0.35), actx.currentTime, 0.03);
      }
    }, s.box);
  }

  function detector(ctx) {
    const s = ctx.sim({
      title: '引力波探测器：如何测量十亿亿分之一米？',
      desc: '左：当引力波垂直穿过纸面，一圈自由漂浮的小球会被交替地在两个方向上拉伸和压缩。右：LIGO 的两条 4 km 长臂正好一条被拉长、一条被缩短，两束激光重新汇合时的干涉亮度随之变化。',
    });
    const wrap = U.el('div', { class: 'split-stage' });
    s.stage.appendChild(wrap);
    const L = U.el('div'), R = U.el('div'); wrap.append(L, R);
    const c1 = U.canvas(L, { aspect: 1, maxHeight: 380 });
    const c2 = U.canvas(R, { aspect: 1, maxHeight: 380 });
    let pol = 'plus', amp = 0.25, f = 0.6;
    U.segmented(s.panel, { label: '偏振模式', value: pol, options: [{ value: 'plus', label: '+ 偏振' }, { value: 'cross', label: '× 偏振' }], onChange: (v) => { pol = v; } });
    U.slider(s.panel, { label: '振幅（极度夸张）', min: 0, max: 0.4, step: 0.01, value: amp, format: (v) => v.toFixed(2), onInput: (v) => { amp = v; } });
    U.slider(s.panel, { label: '频率', min: 0.1, max: 2, step: 0.01, value: f, format: (v) => v.toFixed(2) + ' Hz（演示）', onInput: (v) => { f = v; } });
    s.panel.appendChild(U.el('div', { class: 'ctrl-hint', html: '真实的 GW150914 让 4 km 臂长变化了约 4×10<sup>−18</sup> m——质子直径的千分之一。相当于把地球到比邻星（4.2 光年）的距离测准到一根头发丝的宽度。' }));
    let ph = 0;
    ctx.loop((dt) => {
      ph += dt * f * 2 * Math.PI;
      const hval = amp * Math.sin(ph);
      // 左：粒子环
      {
        const { ctx: g, w, h } = c1;
        g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.3;
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.setLineDash([3, 4]); g.beginPath(); g.arc(cx, cy, R0, 0, 6.283); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * 6.283;
          let x = Math.cos(a) * R0, y = Math.sin(a) * R0;
          if (pol === 'plus') { x *= 1 + hval / 2; y *= 1 - hval / 2; }
          else { const nx = x + (hval / 2) * y, ny = y + (hval / 2) * x; x = nx; y = ny; }
          U.glowCircle(g, cx + x, cy + y, 5, '#5cc8ff', 10);
        }
        U.text(g, '自由漂浮的测试粒子环', 10, 16, { size: 12, color: 'rgba(255,255,255,0.6)' });
      }
      // 右：迈克耳孙干涉仪
      {
        const { ctx: g, w, h } = c2;
        g.fillStyle = '#020308'; g.fillRect(0, 0, w, h);
        const bx = w * 0.25, by = h * 0.72;
        const Lx = w * 0.55 * (1 + (pol === 'plus' ? hval / 2 : 0));
        const Ly = h * 0.55 * (1 - (pol === 'plus' ? hval / 2 : 0));
        g.strokeStyle = 'rgba(255,60,60,0.7)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Lx, by); g.moveTo(bx, by); g.lineTo(bx, by - Ly); g.stroke();
        g.fillStyle = '#ccd'; g.fillRect(bx + Lx, by - 12, 5, 24); g.fillRect(bx - 12, by - Ly - 5, 24, 5);
        g.save(); g.translate(bx, by); g.rotate(-Math.PI / 4); g.fillStyle = 'rgba(200,220,255,0.7)'; g.fillRect(-14, -2, 28, 4); g.restore();
        g.fillStyle = '#ff4d4d'; g.fillRect(bx - 60, by - 5, 30, 10); U.text(g, '激光', bx - 45, by + 18, { align: 'center', size: 11 });
        // 探测器亮度 ∝ sin²(相位差)
        const bright = pol === 'plus' ? Math.pow(Math.sin(hval * 6), 2) : 0.0;
        U.glowCircle(g, bx, by + 50, 10, `rgba(255,${Math.round(80 + 170 * bright)},${Math.round(80 + 100 * bright)},${0.15 + 0.85 * bright})`, 30 * bright + 2);
        U.text(g, '光电探测器', bx + 18, by + 50, { size: 11, color: 'rgba(255,255,255,0.6)' });
        U.text(g, 'LIGO 型干涉仪（每臂 4 km）', 10, 16, { size: 12, color: 'rgba(255,255,255,0.6)' });
        if (pol === 'cross') U.text(g, '× 偏振与两臂成 45°：这台干涉仪对它不敏感', 10, 36, { size: 11, color: '#ffb454' });
      }
    }, s.box);
  }

  App.chapter({
    id: 'gravitational-waves', num: 11, part: 'C',
    title: '引力波：聆听黑洞并合',
    subtitle: '2015 年 9 月 14 日，人类第一次“听”到了宇宙的声音——来自 13 亿光年外两个黑洞的碰撞。',
    summary: '双黑洞旋近、并合与铃宕；引力波如何产生、如何被 LIGO 探测到。',
    sims: ['双黑洞并合', '引力波探测器'],
    goals: ['什么是引力波', '双黑洞并合的三个阶段', '“啁啾”信号', 'LIGO 的工作原理', '多信使天文学'],
    build(ctx) {
      ctx.section('时空也会“起波浪”', `
        <p>把一块石头扔进池塘，水面会泛起涟漪。广义相对论认为，时空本身也是可以振动的“介质”：当大质量天体加速运动（例如两个黑洞相互绕转）时，它们会在时空中激起以光速传播的涟漪——<span class="hl">引力波</span>。</p>
        <p>爱因斯坦在 1916 年预言了引力波，但他认为这种效应实在太弱，人类永远不可能探测到。引力波经过时，会让空间在一个方向拉伸、在垂直方向压缩，但即使是宇宙中最剧烈的事件，传到地球时造成的相对形变也只有约 <b>10<sup>−21</sup></b>。</p>`);
      merger(ctx);
      ctx.section('并合的三个阶段', `
        <ol>
          <li><b>旋近（inspiral）</b>：两个黑洞相互绕转，引力波带走能量，轨道慢慢缩小。间距越小转得越快，辐射也越强——正反馈让这个过程越来越快。</li>
          <li><b>并合（merger）</b>：当间距缩小到几倍视界半径时，两个黑洞以超过光速一半的速度相撞，视界融合成一个。</li>
          <li><b>铃宕（ringdown）</b>：新生的黑洞形状不规则，会像被敲响的钟一样振荡几下，通过辐射引力波迅速变成标准的克尔黑洞（“无毛”）。</li>
        </ol>
        <p>这个过程产生的信号频率和振幅都迅速增大，转换成声音就像鸟叫一样“啾——”的一声，所以被称为<span class="hl">啁啾（chirp）</span>信号。点击上面的“♪ 播放真实时长的啁啾”听听看（已把音调提高两个八度以便用普通耳机听到）。</p>`);
      ctx.callout('fact', `<p><b>GW150914：人类探测到的第一个引力波事件</b></p><ul>
        <li>13 亿年前，一个 36 倍和一个 29 倍太阳质量的黑洞并合，形成一个 62 倍太阳质量的黑洞；</li>
        <li>“消失”的 <b>3 倍太阳质量</b>在约 0.2 秒内全部转化成了引力波能量（E = mc²）；</li>
        <li>峰值功率约 3.6×10<sup>49</sup> W，<b>超过可观测宇宙中所有恒星发光功率之和的 50 倍</b>；</li>
        <li>信号先后到达美国利文斯顿和汉福德的两台 LIGO 探测器，时间相差 7 毫秒。</li></ul>
        <p>雷纳·韦斯、巴里·巴里什和基普·索恩因此获得了 2017 年诺贝尔物理学奖。</p>`);
      ctx.section('怎样测量比质子还小一千倍的变化？', `<p>LIGO 是一台巨大的<b>迈克耳孙激光干涉仪</b>。它有两条互相垂直、各长 4 km 的真空管道。激光被分成两束，分别在两条臂中来回反射约 300 次，再重新汇合。平时两束光恰好相互抵消，探测器是暗的；当引力波经过，一条臂变长、另一条变短，两束光不再完全抵消，探测器就会“亮”起来。</p>`);
      detector(ctx);
      ctx.section('引力波天文学的新时代', `
        <ul>
          <li><b>1974 年</b>：赫尔斯和泰勒发现一对相互绕转的中子星（脉冲双星），其轨道衰减速率与引力波带走能量的预言完全吻合——引力波存在的第一个间接证据（1993 年诺贝尔奖）。</li>
          <li><b>2017 年 8 月 17 日</b>：LIGO/Virgo 探测到两颗中子星并合（GW170817），全球约 70 台望远镜随后看到了它的伽马射线暴和“千新星”——<b>多信使天文学</b>诞生，也证实了宇宙中的金、铂等重元素大量产生于中子星并合。</li>
          <li><b>至今</b>：已探测到约 300 个引力波事件，绝大多数来自双黑洞并合，建立起了黑洞的“人口普查”。</li>
          <li><b>2023 年</b>：包括中国脉冲星测时阵列（CPTA，利用“中国天眼” FAST）在内的多个国际团队，发现了纳赫兹引力波背景的证据，可能来自宇宙中无数对超大质量黑洞的绕转。</li>
          <li><b>未来</b>：欧洲的 LISA 以及中国的<b>“太极”</b>和<b>“天琴”</b>计划将在太空中部署臂长数十万到数百万公里的激光干涉仪，聆听超大质量黑洞的并合。</li>
        </ul>`);
      ctx.callout('key', '<p>① 加速运动的质量会产生以光速传播的引力波；② 双黑洞经历旋近、并合、铃宕三个阶段，产生“啁啾”信号；③ LIGO 用 4 km 激光干涉仪测到 10<sup>−18</sup> m 量级的臂长变化；④ 引力波让我们第一次直接“听到”黑洞，开启了多信使天文学。</p>');
      ctx.think('地球绕太阳公转也会产生引力波吗？为什么我们从未担心过它？',
        '会产生，但功率只有约 <b>200 瓦</b>——相当于几盏灯泡！以这个速率，地球轨道要缩小到撞上太阳需要约 10<sup>23</sup> 年，远超宇宙年龄。只有质量极大、速度接近光速的致密天体系统，才能产生可探测的引力波。');
      ctx.think('为什么 LIGO 要建两台相隔 3000 公里的探测器？',
        '① <b>排除干扰</b>：地震、卡车、雷电等本地噪声不可能同时出现在两地，而真正的引力波信号会在两地几乎同时出现（间隔不超过光传播时间 10 毫秒）；② <b>定位</b>：利用到达时间差可以大致确定引力波来自天空中的哪个方向，加上意大利的 Virgo 和日本的 KAGRA，定位会更精确。');
    },
  });
})();
