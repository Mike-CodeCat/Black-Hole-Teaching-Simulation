/* 通用工具：DOM 构建、画布、控件、格式化、物理常数 */
(function () {
  'use strict';
  const U = {};

  U.PHYS = {
    G: 6.674e-11,
    c: 2.998e8,
    hbar: 1.0546e-34,
    kB: 1.381e-23,
    sigma: 5.67e-8,
    Msun: 1.989e30,
    Rsun: 6.957e8,
    Mearth: 5.972e24,
    Rearth: 6.371e6,
    AU: 1.496e11,
    ly: 9.461e15,
    year: 3.156e7,
    ageUniverse: 1.38e10, // 年
  };
  U.rs = (M) => (2 * U.PHYS.G * M) / (U.PHYS.c * U.PHYS.c);

  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** 创建元素：U.el('div', {class:'a', html:'..', on:{click:fn}}, child...) */
  U.el = function (tag, props, ...children) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'on') for (const ev in v) e.addEventListener(ev, v[ev]);
        else e.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };

  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smoothstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /** 科学计数法（HTML），如 1.23×10⁸ */
  U.sci = function (x, digits = 3) {
    if (x === 0) return '0';
    if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    const neg = x < 0;
    x = Math.abs(x);
    const e = Math.floor(Math.log10(x));
    if (e >= -2 && e < 5) {
      let s = x.toPrecision(digits);
      if (s.includes('.') && !s.includes('e')) s = s.replace(/0+$/, '').replace(/\.$/, '');
      if (s.includes('e')) s = String(Number(s));
      return (neg ? '−' : '') + s;
    }
    let m = x / Math.pow(10, e);
    let ms = m.toPrecision(digits);
    if (Number(ms) >= 10) { ms = (Number(ms) / 10).toPrecision(digits); return (neg ? '−' : '') + ms + '×10<sup>' + (e + 1) + '</sup>'; }
    ms = ms.replace(/\.?0+$/, '');
    return (neg ? '−' : '') + (ms === '1' ? '' : ms + '×') + '10<sup>' + e + '</sup>';
  };
  U.fix = (x, d = 2) => (Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-3 && x !== 0) ? U.sci(x, d + 1) : Number(x).toFixed(d));

  /** 长度的人性化表示 */
  U.length = function (m) {
    const P = U.PHYS;
    if (m < 1e-12) return U.sci(m) + ' m';
    if (m < 1e-6) return U.sci(m * 1e9) + ' nm';
    if (m < 1e-3) return U.sci(m * 1e6) + ' μm';
    if (m < 1) return U.sci(m * 1e3) + ' mm';
    if (m < 1e3) return U.sci(m) + ' m';
    if (m < 0.1 * P.AU) return U.sci(m / 1e3) + ' km';
    if (m < 0.1 * P.ly) return U.sci(m / P.AU) + ' 天文单位';
    return U.sci(m / P.ly) + ' 光年';
  };
  /** 时间（秒）的人性化表示 */
  U.duration = function (s) {
    const y = U.PHYS.year;
    if (s < 1e-6) return U.sci(s * 1e9) + ' 纳秒';
    if (s < 1e-3) return U.sci(s * 1e6) + ' 微秒';
    if (s < 1) return U.sci(s * 1e3) + ' 毫秒';
    if (s < 120) return U.sci(s) + ' 秒';
    if (s < 7200) return U.sci(s / 60) + ' 分钟';
    if (s < 2 * 86400) return U.sci(s / 3600) + ' 小时';
    if (s < y) return U.sci(s / 86400) + ' 天';
    return U.sci(s / y) + ' 年';
  };

  /** 去掉 HTML，把 <sup> 转成 Unicode 上标（用于 canvas 文本） */
  U.plain = function (html) {
    const map = { '-': '⁻', '−': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(html).replace(/<sup>(.*?)<\/sup>/g, (m, g) => g.split('').map((ch) => map[ch] || ch).join('')).replace(/<[^>]+>/g, '');
  };

  /** 可见光波长 (nm) → RGB 字符串 */
  U.wavelengthRGB = function (nm, alpha = 1) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm <= 780) { r = 1; }
    let f = 1;
    if (nm < 380 || nm > 780) f = 0;
    else if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 700) f = 0.3 + 0.7 * (780 - nm) / 80;
    if (nm > 780) { r = 0.35; g = 0.08; b = 0.08; f = Math.max(0.15, 1 - (nm - 780) / 1500); }
    if (nm < 380) { r = 0.4; g = 0.2; b = 0.6; f = 0.5; }
    const c = (v) => Math.round(255 * Math.pow(v * f, 0.8));
    return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
  };

  /** 黑体颜色（归一化 sRGB 0..1），T 单位 K */
  U.blackbody = function (T) {
    const t = U.clamp(T, 1000, 40000) / 100;
    let r, g, b;
    if (t <= 66) { r = 1; g = 0.3900815788 * Math.log(t) - 0.6318414438; }
    else { r = 1.292936186 * Math.pow(t - 60, -0.1332047592); g = 1.129890861 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 1; else if (t <= 19) b = 0; else b = 0.5432067891 * Math.log(t - 10) - 1.19625408914;
    return [U.clamp(r, 0, 1), U.clamp(g, 0, 1), U.clamp(b, 0, 1)];
  };
  U.rgb = (arr, a = 1, k = 1) => `rgba(${Math.round(arr[0] * 255 * k)},${Math.round(arr[1] * 255 * k)},${Math.round(arr[2] * 255 * k)},${a})`;

  /**
   * 创建高 DPI 画布，自动随容器宽度缩放。绘图坐标使用 CSS 像素。
   * opts: {aspect, height, minHeight, maxHeight}
   */
  U.canvas = function (parent, opts = {}) {
    const canvas = U.el('canvas', { class: opts.class || 'sim-canvas' });
    parent.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const obj = { canvas, ctx, w: 0, h: 0, dpr: 1, _cbs: [] };
    obj.resize = function () {
      const w = Math.max(50, parent.clientWidth);
      let h = opts.height || w / (opts.aspect || 16 / 9);
      if (opts.minHeight) h = Math.max(h, opts.minHeight);
      if (opts.maxHeight) h = Math.min(h, opts.maxHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (Math.abs(w - obj.w) < 0.5 && Math.abs(h - obj.h) < 0.5 && dpr === obj.dpr) return;
      obj.w = w; obj.h = h; obj.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      obj._cbs.forEach((f) => f(w, h));
    };
    obj.onResize = (f) => obj._cbs.push(f);
    const ro = new ResizeObserver(() => obj.resize());
    ro.observe(parent);
    obj.destroy = () => ro.disconnect();
    obj.resize();
    return obj;
  };

  /** 获取指针在元素内的 CSS 坐标 */
  U.pointer = (ev, el) => {
    const r = el.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  /* ---------------- 控件 ---------------- */
  let uid = 0;
  /** 滑块：{label, min, max, step, value, log, format(v), onInput(v)} */
  U.slider = function (parent, o) {
    const id = 'sl' + ++uid;
    const toPos = (v) => (o.log ? Math.log10(v) : v);
    const fromPos = (p) => (o.log ? Math.pow(10, p) : p);
    const valEl = U.el('span', { class: 'ctrl-val' });
    const input = U.el('input', {
      type: 'range', id,
      min: toPos(o.min), max: toPos(o.max),
      step: o.step || (o.log ? 0.01 : (o.max - o.min) / 200),
      value: toPos(o.value),
    });
    const row = U.el('div', { class: 'ctrl' },
      U.el('div', { class: 'ctrl-head' }, U.el('label', { for: id, html: o.label }), valEl),
      input,
      o.hint ? U.el('div', { class: 'ctrl-hint', html: o.hint }) : null);
    parent.appendChild(row);
    const fmt = o.format || ((v) => U.fix(v, 2));
    const api = {
      el: row, input,
      get value() { return fromPos(parseFloat(input.value)); },
      set(v, fire = true) {
        input.value = toPos(v);
        valEl.innerHTML = fmt(api.value);
        if (fire && o.onInput) o.onInput(api.value);
      },
    };
    const upd = () => {
      valEl.innerHTML = fmt(api.value);
      input.style.setProperty('--p', ((input.value - input.min) / (input.max - input.min)) * 100 + '%');
    };
    input.addEventListener('input', () => { upd(); o.onInput && o.onInput(api.value); });
    const origSet = api.set;
    api.set = (v, fire = true) => { origSet(v, fire); upd(); };
    upd();
    return api;
  };

  U.select = function (parent, o) {
    const sel = U.el('select');
    o.options.forEach((op) => sel.appendChild(U.el('option', { value: op.value, text: op.label })));
    sel.value = o.value;
    sel.addEventListener('change', () => o.onChange && o.onChange(sel.value));
    const row = U.el('div', { class: 'ctrl' }, o.label ? U.el('div', { class: 'ctrl-head' }, U.el('label', { html: o.label })) : null, sel);
    parent.appendChild(row);
    return { el: row, sel, get value() { return sel.value; }, set(v) { sel.value = v; o.onChange && o.onChange(v); } };
  };

  U.toggle = function (parent, o) {
    const input = U.el('input', { type: 'checkbox' });
    input.checked = !!o.value;
    const row = U.el('label', { class: 'toggle' }, input, U.el('span', { class: 'toggle-ui' }), U.el('span', { class: 'toggle-label', html: o.label }));
    input.addEventListener('change', () => o.onChange && o.onChange(input.checked));
    parent.appendChild(row);
    return { el: row, input, get value() { return input.checked; }, set(v) { input.checked = v; o.onChange && o.onChange(v); } };
  };

  /** 按钮组：[{label, onClick, primary, class}] */
  U.buttons = function (parent, list) {
    const g = U.el('div', { class: 'btn-group' });
    const btns = list.map((b) => {
      const e = U.el('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.class ? ' ' + b.class : ''), html: b.label, on: { click: b.onClick } });
      g.appendChild(e);
      return e;
    });
    parent.appendChild(g);
    return btns;
  };

  /** 分段选择：[{value,label}] */
  U.segmented = function (parent, o) {
    const g = U.el('div', { class: 'segmented' });
    const btns = {};
    o.options.forEach((op) => {
      const b = U.el('button', { html: op.label, on: { click: () => api.set(op.value) } });
      btns[op.value] = b;
      g.appendChild(b);
    });
    const row = U.el('div', { class: 'ctrl' }, o.label ? U.el('div', { class: 'ctrl-head' }, U.el('label', { html: o.label })) : null, g);
    parent.appendChild(row);
    const api = {
      el: row, value: o.value,
      set(v, fire = true) {
        api.value = v;
        for (const k in btns) btns[k].classList.toggle('active', k === String(v));
        if (fire && o.onChange) o.onChange(v);
      },
    };
    api.set(o.value, false);
    return api;
  };

  /** 读数面板：[{key,label}] → {set(key, html)} */
  U.readouts = function (parent, list) {
    const box = U.el('div', { class: 'readouts' });
    const map = {};
    list.forEach((it) => {
      const v = U.el('span', { class: 'ro-val', html: '—' });
      map[it.key] = v;
      box.appendChild(U.el('div', { class: 'ro' + (it.wide ? ' wide' : '') }, U.el('span', { class: 'ro-label', html: it.label }), v));
    });
    parent.appendChild(box);
    return {
      el: box,
      set(k, html) { if (map[k] && map[k]._h !== html) { map[k].innerHTML = html; map[k]._h = html; } },
    };
  };

  /* ---------------- 数学排版小工具 ---------------- */
  U.frac = (a, b) => `<span class="frac"><span>${a}</span><span>${b}</span></span>`;
  U.sqrt = (a) => `<span class="sqrt"><span>${a}</span></span>`;

  /* ---------------- 绘图小工具 ---------------- */
  U.glowCircle = function (ctx, x, y, r, color, blur = 20) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  /** 绘制“黑洞”图标：黑色圆 + 光环 */
  U.drawBH = function (ctx, x, y, r, t = 0, ring = true) {
    if (ring) {
      const g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.2);
      g.addColorStop(0, 'rgba(255,190,110,0.85)');
      g.addColorStop(0.25, 'rgba(255,130,60,0.35)');
      g.addColorStop(1, 'rgba(255,100,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  U.arrow = function (ctx, x1, y1, x2, y2, color, w = 2, head = 8) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
    ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  U.text = function (ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = o.font || `${o.size || 12}px ${U.FONT}`;
    ctx.fillStyle = o.color || 'rgba(230,236,245,0.85)';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4; }
    ctx.fillText(s, x, y);
    ctx.restore();
  };
  U.FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';

  /** 在画布上画坐标轴图表 */
  U.plotFrame = function (ctx, box, o) {
    const { x, y, w, h } = box;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h);
    ctx.stroke();
    if (o.xlabel) U.text(ctx, o.xlabel, x + w, y + h + 14, { align: 'right', size: 11, color: 'rgba(200,210,230,0.7)' });
    if (o.ylabel) U.text(ctx, o.ylabel, x + 4, y - 8, { size: 11, color: 'rgba(200,210,230,0.7)' });
    ctx.restore();
  };

  /** 伪随机数（可复现） */
  U.rng = function (seed = 1) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  };

  window.U = U;
})();
