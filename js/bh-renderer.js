/*
 * 实时黑洞光线追踪渲染器（WebGL）
 * ------------------------------------------------------------
 * 物理模型：史瓦西（不旋转）黑洞，单位取史瓦西半径 rs = 1。
 * 光线在弯曲时空中的轨迹等价于满足下式的“伪牛顿”运动：
 *     d²x/dλ² = -(3/2) h² x / r⁵ ,   h = |x × dx/dλ|（守恒的“角动量”）
 * 这与史瓦西度规下的光子轨道方程 u'' + u = (3/2) rs u² 完全等价。
 * 吸积盘：位于赤道面，内缘默认取最内稳定圆轨道 ISCO = 3 rs；
 * 颜色由黑体温度决定，并计入多普勒效应（相对论性集束）与引力红移。
 * 后期：HDR 泛光（bloom）+ ACES 色调映射；可切换“EHT 望远镜模式”。
 */
(function () {
  'use strict';

  const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

  const COMMON = `
precision highp float;
#define PI 3.14159265
varying vec2 vUv;
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
`;

  const SCENE_FS = (steps) => COMMON + `
#define MAX_STEPS ${steps}
uniform vec2 uRes;
uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd;
uniform float uTanFov, uTime, uPixAng;
uniform vec2 uShift;
uniform float uDisk, uDiskIn, uDiskOut, uDoppler, uGrav, uDiskTemp, uDiskBright, uDiskSpeed;
uniform float uLensing, uBg, uStarBright, uHdrScale, uFar, uHorizonGlow;
uniform vec3 uSrcDir;

float noise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm3(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*noise(p); p=p*2.1+vec3(5.1,1.3,7.7); a*=0.5; } return s; }

// 黑体辐射颜色（线性空间）
vec3 blackbody(float T){
  float t = clamp(T, 800.0, 40000.0)/100.0;
  float r, g, b;
  if(t <= 66.0){ r = 1.0; g = 0.3900815788*log(t) - 0.6318414438; }
  else { r = 1.292936186*pow(t-60.0, -0.1332047592); g = 1.129890861*pow(t-60.0, -0.0755148492); }
  if(t >= 66.0) b = 1.0; else if(t <= 19.0) b = 0.0; else b = 0.5432067891*log(t-10.0) - 1.19625408914;
  vec3 c = clamp(vec3(r,g,b), 0.0, 1.0);
  c = pow(c, vec3(2.2));
  return c * smoothstep(600.0, 1600.0, T);
}

vec3 starField(vec3 d){
  vec3 col = vec3(0.0);
  for(int L=0; L<3; L++){
    float sc = 70.0 + 75.0*float(L);
    vec3 p = d*sc; vec3 c = floor(p); vec3 f = fract(p);
    float h = hash13(c + float(L)*37.0);
    float th = 0.972 - 0.006*float(L);
    if(h > th){
      vec3 sp = 0.3 + 0.4*vec3(hash13(c+11.1), hash13(c+23.7), hash13(c+47.3));
      vec3 dd = f - sp; float d2 = dot(dd,dd);
      float sig = clamp(uPixAng*sc*0.6, 0.02, 0.09);
      float b = pow((h-th)/(1.0-th), 3.0);
      float temp = 2800.0 + 11000.0*pow(hash13(c+71.9), 1.6);
      col += blackbody(temp) * b * (exp(-d2/(2.0*sig*sig))*1.6 + exp(-d2/(sig*sig*30.0))*0.03);
    }
  }
  return col;
}

vec3 milkyWay(vec3 d){
  vec3 n = normalize(vec3(0.25, 1.0, -0.35));
  float y = dot(d, n);
  float band = exp(-y*y*10.0);
  float f = fbm(d*3.2);
  float f2 = fbm3(d*8.0 + 3.0);
  float dust = smoothstep(0.42, 0.72, fbm3(d*5.5+7.0));
  vec3 c = mix(vec3(0.30,0.24,0.55), vec3(1.0,0.80,0.58), f2);
  vec3 col = c * band * (0.15 + f*f*1.6) * (1.0 - 0.75*dust*band);
  float neb1 = pow(fbm3(d*1.7+13.0), 3.0);
  float neb2 = pow(fbm3(d*2.4+29.0), 4.0);
  col += vec3(0.15,0.30,0.85)*neb1*0.35 + vec3(0.85,0.2,0.45)*neb2*0.45;
  return col*0.22;
}

vec3 gridBg(vec3 d){
  float lon = atan(d.z, d.x); float lat = asin(clamp(d.y,-1.0,1.0));
  float nx = lon/(PI/12.0); float ny = lat/(PI/12.0);
  float gx = abs(fract(nx)-0.5); float gy = abs(fract(ny)-0.5);
  float line = max(smoothstep(0.43,0.49,gx), smoothstep(0.43,0.49,gy));
  float chk = mod(floor(nx)+floor(ny), 2.0);
  vec3 base = d.z < 0.0 ? vec3(0.08,0.22,0.55) : vec3(0.55,0.22,0.08);
  base *= 0.55 + 0.45*chk;
  return mix(base, vec3(0.95), line)*0.55;
}

vec3 galaxySrc(vec3 d){
  float c = dot(d, uSrcDir);
  if(c < 0.97) return vec3(0.0);
  vec3 t1 = normalize(cross(uSrcDir, vec3(0.0,1.0,0.001)));
  vec3 t2 = cross(uSrcDir, t1);
  vec2 q = vec2(dot(d,t1), dot(d,t2)*1.6) / 0.045;
  float r = length(q); float th = atan(q.y, q.x);
  float arms = 0.5 + 0.5*cos(2.0*th - 5.0*log(r+0.08));
  float disk = exp(-r*2.2) * (0.35 + 0.9*pow(arms,3.0)) * (0.6 + 0.8*fbm3(vec3(q*3.0, 1.0)));
  float core = exp(-r*r*40.0);
  return vec3(0.55,0.7,1.0)*disk*1.1 + vec3(1.0,0.85,0.6)*core*3.0;
}

vec3 background(vec3 d){
  if(uBg > 0.5 && uBg < 1.5) return gridBg(d);
  vec3 col = (starField(d) + milkyWay(d)) * uStarBright;
  if(uBg > 1.5) col = col*0.6 + galaxySrc(d);
  return col;
}

float diskNoise(float a, float r, float seed){
  vec3 q = vec3(cos(a)*3.2, sin(a)*3.2, log(r)*9.0 + seed*7.31);
  float n = fbm(q);
  float ridge = 1.0 - abs(2.0*noise(q*vec3(2.0,2.0,3.5) + seed) - 1.0);
  return n*0.75 + ridge*ridge*0.35;
}

vec4 shadeDisk(vec3 p, vec3 rd){
  float r = length(p.xz);
  float phi = atan(p.z, p.x);
  float omega = uDiskSpeed*sqrt(0.5/(r*r*r));
  float T = 10.0;
  float ph1 = fract(uTime/T), ph2 = fract(uTime/T + 0.5);
  float w1 = 1.0 - abs(2.0*ph1 - 1.0);
  float s1 = floor(uTime/T), s2 = floor(uTime/T + 0.5);
  float n1 = diskNoise(phi - omega*ph1*T, r, mod(s1, 17.0));
  float n2 = diskNoise(phi - omega*ph2*T, r, mod(s2, 17.0) + 31.0);
  float n = mix(n2, n1, w1);
  n = (n - 0.5)*(1.0 + 0.6*abs(2.0*w1-1.0)) + 0.5; // 抵消混合造成的对比度损失

  float edgeIn = smoothstep(uDiskIn*0.97, uDiskIn*1.35, r);
  float edgeOut = 1.0 - smoothstep(uDiskOut*0.55, uDiskOut, r);
  float dens = edgeIn*edgeOut*clamp(0.18 + 1.25*pow(max(n,0.0), 1.8), 0.0, 1.5);

  // Shakura–Sunyaev/Novikov–Thorne 温度分布 T ∝ r^(-3/4) (1-√(rin/r))^(1/4)
  float x = uDiskIn / r;
  float tp = pow(x, 0.75)*pow(max(1.0 - sqrt(x), 0.0), 0.25)/0.488;

  // 多普勒效应：盘物质以（局部静止观者测得的）速度 β 绕行
  vec3 vdir = vec3(-p.z, 0.0, p.x)/r * sign(uDiskSpeed);
  float beta = min(sqrt(0.5/max(r-1.0, 0.05)), 0.96);
  float gam = inversesqrt(1.0 - beta*beta);
  float cosT = dot(vdir, -rd);
  float dop = mix(1.0, 1.0/(gam*(1.0 - beta*cosT)), uDoppler);
  // 引力红移：发射处与相机处的时钟快慢之比
  float rc = length(uCamPos);
  float gr = mix(1.0, sqrt(max(1.0 - 1.0/r, 0.0)/max(1.0 - 1.0/rc, 0.02)), uGrav);
  float g = dop*gr;
  float Tobs = uDiskTemp*tp*g;
  vec3 em = blackbody(Tobs) * pow(g, 4.0) * pow(tp, 3.0) * uDiskBright * 2.2;
  float alpha = clamp(dens, 0.0, 1.0)*0.92;
  return vec4(em*(0.55 + 0.9*n), alpha);
}

void main(){
  vec2 uv = (gl_FragCoord.xy/uRes)*2.0 - 1.0;
  uv.x *= uRes.x/uRes.y;
  uv -= uShift;
  vec3 rd = normalize(uCamFwd + (uv.x*uCamRight + uv.y*uCamUp)*uTanFov);
  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 hv = cross(pos, vel);
  float kL = 1.5*dot(hv, hv)*uLensing;
  float r2 = dot(pos,pos);
  vec3 acc = -kL*pos/pow(r2, 2.5);
  vec3 col = vec3(0.0);
  float A = 0.0;
  bool escaped = false;
  float minR = 1e5;
  for(int i=0; i<MAX_STEPS; i++){
    float r = sqrt(r2);
    float dt = clamp(0.055*r, 0.004, 2.0);
    if(r < 1.6) dt = min(dt, 0.04*r);
    vec3 np = pos + vel*dt + 0.5*acc*dt*dt;
    float nr2 = dot(np, np);
    vec3 nacc = -kL*np/pow(nr2, 2.5);
    vec3 nv = vel + 0.5*(acc + nacc)*dt;
    if(uDisk > 0.5 && pos.y*np.y < 0.0){
      float t = pos.y/(pos.y - np.y);
      vec3 hp = mix(pos, np, t);
      float hr = length(hp.xz);
      if(hr > uDiskIn*0.95 && hr < uDiskOut){
        vec4 d = shadeDisk(hp, normalize(mix(vel, nv, t)));
        col += (1.0 - A)*d.rgb*d.a;
        A += (1.0 - A)*d.a;
        if(A > 0.985) break;
      }
    }
    pos = np; vel = nv; acc = nacc; r2 = nr2;
    minR = min(minR, nr2);
    if(nr2 < 1.0) break;
    if(nr2 > uFar*uFar && dot(np, nv) > 0.0){ escaped = true; break; }
  }
  if(escaped) col += (1.0 - A)*background(normalize(vel));
  // 掠过光子球的光线附近加一点微弱辉光（示意），帮助辨认阴影边缘
  if(escaped) col += (1.0 - A)*uHorizonGlow*vec3(1.0,0.6,0.3)*exp(-max(sqrt(minR)-1.5, 0.0)*5.0)*0.015;
  gl_FragColor = vec4(col*uHdrScale, 1.0);
}`;

  const BRIGHT_FS = COMMON + `
uniform sampler2D uTex; uniform float uTh, uInvHdr, uHdrScale;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb*uInvHdr;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = max(l - uTh, 0.0)/max(l, 1e-4);
  gl_FragColor = vec4(c*k*uHdrScale, 1.0);
}`;

  const BLUR_FS = COMMON + `
uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 s = texture2D(uTex, vUv).rgb*0.227027;
  s += texture2D(uTex, vUv + uDir*1.3846153846).rgb*0.3162162162;
  s += texture2D(uTex, vUv - uDir*1.3846153846).rgb*0.3162162162;
  s += texture2D(uTex, vUv + uDir*3.2307692308).rgb*0.0702702703;
  s += texture2D(uTex, vUv - uDir*3.2307692308).rgb*0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;

  const COMPOSITE_FS = COMMON + `
uniform sampler2D uScene, uBloomA, uBloomB;
uniform float uBloom, uExposure, uEht, uInvHdr, uTime, uFade;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(uScene, vUv).rgb*uInvHdr;
  vec3 bA = texture2D(uBloomA, vUv).rgb*uInvHdr;
  vec3 bB = texture2D(uBloomB, vUv).rgb*uInvHdr;
  vec3 col = (c + (bA*0.55 + bB*0.9)*uBloom)*uExposure;
  if(uEht > 0.5){
    float L = dot(bB, vec3(0.3,0.55,0.15))*uExposure*1.6;
    L = 1.0 - exp(-L*1.4);
    col = clamp(vec3(2.0*L, 2.0*L - 0.5, 2.0*L - 1.0), 0.0, 1.0);
    col = pow(col, vec3(2.2));
  } else {
    col = aces(col);
  }
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q,q)*0.55;
  col = pow(col, vec3(1.0/2.2));
  col += (hash12(gl_FragCoord.xy + fract(uTime)*100.0) - 0.5)*0.012;
  gl_FragColor = vec4(col*uFade, 1.0);
}`;

  const QUALITY = { low: 160, medium: 280, high: 450 };

  class BHRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} opts  quality, interactive, params, camera
     */
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.opts = opts;
      this.params = Object.assign({
        disk: true, doppler: true, grav: true, lensing: true,
        bg: 0, // 0 星空 1 网格 2 背景星系
        diskTemp: 5200, diskBright: 0.7, diskIn: 3.0, diskOut: 14.0, diskSpeed: 2.5,
        starBright: 1.0, bloom: 1.0, exposure: 1.0, eht: false, horizonGlow: 1.0,
        srcDir: [0, 0, -1], fade: 1,
      }, opts.params || {});
      this.cam = Object.assign({ yaw: 0.9, pitch: 0.12, dist: 20, fov: 60, roll: 0.0, minDist: 2.2, maxDist: 60 }, opts.camera || {});
      this.target = { yaw: this.cam.yaw, pitch: this.cam.pitch, dist: this.cam.dist };
      this.autoRotate = opts.autoRotate != null ? opts.autoRotate : 0.03;
      this.quality = opts.quality || (/Mobi|Android/i.test(navigator.userAgent) ? 'low' : 'medium');
      this.renderScale = opts.renderScale || (this.quality === 'low' ? 0.45 : 0.6);
      this.maxScale = opts.maxScale || 1.0;
      this.time = 0;
      this.running = false;
      this.visible = true;
      this.frameTimes = [];
      this.onFrame = null;
      this.ok = this._init();
      if (this.ok && opts.interactive !== false) this._bindControls();
      if (this.ok && 'IntersectionObserver' in window) {
        this._io = new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; });
        this._io.observe(canvas);
      }
    }

    _init() {
      const attrs = { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: !!this.opts.preserve, powerPreference: 'high-performance' };
      let gl = this.canvas.getContext('webgl2', attrs);
      this.isGL2 = !!gl;
      if (!gl) gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
      if (!gl) return false;
      this.gl = gl;
      // 选择 HDR 纹理格式
      this.texType = gl.UNSIGNED_BYTE; this.texInternal = gl.RGBA; this.hdrScale = 0.25;
      if (this.isGL2 && gl.getExtension('EXT_color_buffer_float')) {
        this.texType = gl.HALF_FLOAT; this.texInternal = gl.RGBA16F; this.hdrScale = 1;
      } else if (!this.isGL2) {
        const hf = gl.getExtension('OES_texture_half_float');
        const cb = gl.getExtension('EXT_color_buffer_half_float');
        const lin = gl.getExtension('OES_texture_half_float_linear');
        if (hf && cb && lin) { this.texType = hf.HALF_FLOAT_OES; this.hdrScale = 1; }
      }
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.buf = buf;
      try {
        this.progScene = this._program(SCENE_FS(QUALITY[this.quality] || 280));
        this.progBright = this._program(BRIGHT_FS);
        this.progBlur = this._program(BLUR_FS);
        this.progComp = this._program(COMPOSITE_FS);
      } catch (e) {
        console.error(e);
        return false;
      }
      this.fbos = {};
      this._resize(true);
      if (!this._checkFBO()) {
        // 回退到 8 位纹理
        this.texType = gl.UNSIGNED_BYTE; this.texInternal = gl.RGBA; this.hdrScale = 0.25;
        this._resize(true);
      }
      return true;
    }

    setQuality(q) {
      if (!this.ok || q === this.quality) return;
      this.quality = q;
      this.gl.deleteProgram(this.progScene.p);
      this.progScene = this._program(SCENE_FS(QUALITY[q]));
      this.renderScale = q === 'low' ? 0.45 : q === 'high' ? 0.85 : 0.6;
      this.frameTimes = [];
    }

    _program(fs) {
      const gl = this.gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      return { p, u };
    }

    _fbo(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, this.texInternal, w, h, 0, gl.RGBA, this.texType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w, h };
    }
    _checkFBO() {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fb);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok;
    }

    _resize(force) {
      const gl = this.gl;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(2, Math.round(this.canvas.clientWidth * dpr));
      const ch = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
      const sw = Math.max(2, Math.round(cw * this.renderScale)), sh = Math.max(2, Math.round(ch * this.renderScale));
      if (!force && this.canvas.width === cw && this.canvas.height === ch && this.fbos.scene && this.fbos.scene.w === sw && this.fbos.scene.h === sh) return;
      this.canvas.width = cw; this.canvas.height = ch;
      for (const k in this.fbos) { gl.deleteTexture(this.fbos[k].tex); gl.deleteFramebuffer(this.fbos[k].fb); }
      const hw = Math.max(2, sw >> 1), hh = Math.max(2, sh >> 1);
      const qw = Math.max(2, sw >> 2), qh = Math.max(2, sh >> 2);
      this.fbos = {
        scene: this._fbo(sw, sh),
        hA: this._fbo(hw, hh), hB: this._fbo(hw, hh),
        qA: this._fbo(qw, qh), qB: this._fbo(qw, qh),
      };
    }

    _bindControls() {
      const c = this.canvas;
      const pts = new Map();
      let lastPinch = 0;
      c.style.touchAction = 'none';
      c.style.cursor = 'grab';
      const down = (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); c.style.cursor = 'grabbing'; this._lastInteract = performance.now(); };
      const move = (e) => {
        if (!pts.has(e.pointerId)) return;
        const p = pts.get(e.pointerId);
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 1) {
          this.target.yaw -= dx * 0.006;
          this.target.pitch = U.clamp(this.target.pitch + dy * 0.005, -1.45, 1.45);
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (lastPinch) this.target.dist = U.clamp(this.target.dist * (lastPinch / d), this.cam.minDist, this.cam.maxDist);
          lastPinch = d;
        }
        this._lastInteract = performance.now();
      };
      const up = (e) => { pts.delete(e.pointerId); lastPinch = 0; c.style.cursor = 'grab'; };
      const wheel = (e) => {
        e.preventDefault();
        this.target.dist = U.clamp(this.target.dist * Math.exp(e.deltaY * 0.001), this.cam.minDist, this.cam.maxDist);
        this._lastInteract = performance.now();
      };
      c.addEventListener('pointerdown', down);
      c.addEventListener('pointermove', move);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', wheel, { passive: false });
    }

    cameraVectors() {
      const { yaw, pitch, dist, roll } = this.cam;
      const pos = [dist * Math.cos(pitch) * Math.cos(yaw), dist * Math.sin(pitch), dist * Math.cos(pitch) * Math.sin(yaw)];
      const len = Math.hypot(...pos);
      const fwd = pos.map((v) => -v / len);
      let right = [fwd[1] * 0 - fwd[2] * 1, fwd[2] * 0 - fwd[0] * 0, fwd[0] * 1 - fwd[1] * 0]; // fwd × up(0,1,0)
      const rl = Math.hypot(...right) || 1;
      right = right.map((v) => v / rl);
      let up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      if (roll) {
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const r2 = right.map((v, i) => v * cr + up[i] * sr);
        const u2 = up.map((v, i) => v * cr - right[i] * sr);
        right = r2; up = u2;
      }
      return { pos, fwd, right, up };
    }

    start() {
      if (!this.ok || this.running) return;
      this.running = true;
      let last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        this._raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!this.visible || document.hidden) return;
        this.update(dt);
        this.render();
        this._adapt(dt);
        if (this.onFrame) this.onFrame(dt, this);
      };
      this._raf = requestAnimationFrame(loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this._raf); }

    update(dt) {
      this.time += dt;
      const idle = !this._lastInteract || performance.now() - this._lastInteract > 2500;
      if (idle && this.autoRotate) this.target.yaw += this.autoRotate * dt;
      const k = 1 - Math.exp(-dt * 5);
      this.cam.yaw += (this.target.yaw - this.cam.yaw) * k;
      this.cam.pitch += (this.target.pitch - this.cam.pitch) * k;
      this.cam.dist += (this.target.dist - this.cam.dist) * k;
    }

    /** 根据帧时间自动调节渲染分辨率 */
    _adapt(dt) {
      if (this.opts.fixedScale) return;
      this.frameTimes.push(dt);
      if (this.frameTimes.length < 40) return;
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes = [];
      if (avg > 0.045 && this.renderScale > 0.3) this.renderScale = Math.max(0.3, this.renderScale * 0.82);
      else if (avg < 0.021 && this.renderScale < this.maxScale) this.renderScale = Math.min(this.maxScale, this.renderScale * 1.12);
      else return;
      this._resize(true);
    }

    _draw(prog, target, setup) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
      gl.useProgram(prog.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      setup(prog.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    _tex(unit, tex, loc) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
    }

    render() {
      if (!this.ok) return;
      const gl = this.gl;
      this._resize(false);
      const P = this.params;
      const F = this.fbos;
      const cv = this.cameraVectors();
      const tanFov = Math.tan((this.cam.fov * Math.PI) / 360);
      // 1) 光线追踪主场景
      this._draw(this.progScene, F.scene, (u) => {
        gl.uniform2f(u.uRes, F.scene.w, F.scene.h);
        gl.uniform3fv(u.uCamPos, cv.pos);
        gl.uniform3fv(u.uCamRight, cv.right);
        gl.uniform3fv(u.uCamUp, cv.up);
        gl.uniform3fv(u.uCamFwd, cv.fwd);
        gl.uniform1f(u.uTanFov, tanFov);
        gl.uniform1f(u.uPixAng, (2 * tanFov) / F.scene.h);
        gl.uniform2f(u.uShift, this.cam.shiftX || 0, this.cam.shiftY || 0);
        gl.uniform1f(u.uTime, this.time);
        gl.uniform1f(u.uDisk, P.disk ? 1 : 0);
        gl.uniform1f(u.uDiskIn, P.diskIn);
        gl.uniform1f(u.uDiskOut, P.diskOut);
        gl.uniform1f(u.uDoppler, P.doppler ? 1 : 0);
        gl.uniform1f(u.uGrav, P.grav ? 1 : 0);
        gl.uniform1f(u.uDiskTemp, P.diskTemp);
        gl.uniform1f(u.uDiskBright, P.diskBright);
        gl.uniform1f(u.uDiskSpeed, P.diskSpeed);
        gl.uniform1f(u.uLensing, P.lensing ? 1 : 0);
        gl.uniform1f(u.uBg, P.bg);
        gl.uniform1f(u.uStarBright, P.starBright);
        gl.uniform1f(u.uHdrScale, this.hdrScale);
        gl.uniform1f(u.uFar, Math.max(30, this.cam.dist * 1.3));
        gl.uniform1f(u.uHorizonGlow, P.horizonGlow);
        gl.uniform3fv(u.uSrcDir, P.srcDir);
      });
      const inv = 1 / this.hdrScale;
      // 2) 泛光：提取高亮 → 半分辨率模糊 → 四分之一分辨率模糊
      this._draw(this.progBright, F.hA, (u) => {
        this._tex(0, F.scene.tex, u.uTex);
        gl.uniform1f(u.uTh, P.eht ? 0.0 : 0.6);
        gl.uniform1f(u.uInvHdr, inv);
        gl.uniform1f(u.uHdrScale, this.hdrScale);
      });
      const blur = (src, dst, dx, dy, spread) => this._draw(this.progBlur, dst, (u) => {
        this._tex(0, src.tex, u.uTex);
        gl.uniform2f(u.uDir, (dx * spread) / src.w, (dy * spread) / src.h);
      });
      blur(F.hA, F.hB, 1, 0, 1); blur(F.hB, F.hA, 0, 1, 1);
      blur(F.hA, F.qB, 1, 0, 1.5); blur(F.qB, F.qA, 0, 1, 1.5);
      const iters = P.eht ? 5 : 1;
      for (let i = 0; i < iters; i++) {
        const s = P.eht ? 1.5 + i * 0.8 : 2.5;
        blur(F.qA, F.qB, 1, 0, s); blur(F.qB, F.qA, 0, 1, s);
      }
      // 3) 合成 + 色调映射
      this._draw(this.progComp, null, (u) => {
        this._tex(0, F.scene.tex, u.uScene);
        this._tex(1, F.hA.tex, u.uBloomA);
        this._tex(2, F.qA.tex, u.uBloomB);
        gl.uniform1f(u.uBloom, P.bloom);
        gl.uniform1f(u.uExposure, P.exposure);
        gl.uniform1f(u.uEht, P.eht ? 1 : 0);
        gl.uniform1f(u.uInvHdr, inv);
        gl.uniform1f(u.uTime, this.time);
        gl.uniform1f(u.uFade, P.fade);
      });
    }

    destroy() {
      this.stop();
      if (this._io) this._io.disconnect();
      if (this.gl) {
        const ext = this.gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    }
  }

  /** 便捷方法：在容器中创建渲染器（含加载失败提示） */
  BHRenderer.mount = function (container, opts = {}) {
    const canvas = U.el('canvas', { class: 'bh-canvas' });
    container.appendChild(canvas);
    const r = new BHRenderer(canvas, opts);
    if (!r.ok) {
      container.appendChild(U.el('div', { class: 'webgl-fail', html: '你的浏览器不支持 WebGL，无法显示实时光线追踪画面。<br>请使用最新版 Chrome / Edge / Firefox 并开启硬件加速。' }));
    } else {
      r.start();
    }
    return r;
  };

  window.BHRenderer = BHRenderer;
})();
