/*
 * 黑洞入侵太阳系 —— 电影级渲染器（WebGL）
 * ------------------------------------------------------------
 * 1) 天空着色器：逐像素求解视线与太阳/行星/月球（解析球体、土星环）的相交，
 *    并对经过黑洞的光线施加史瓦西偏折（薄透镜近似 + 拟合的精确偏折角公式），
 *    b < b_c = 3√3/2 r_s 的光线被吞没 → 黑洞阴影；太阳被透镜化时会出现爱因斯坦环。
 * 2) 精灵（碎片、吸积盘、喷流、标记）与轨迹线以加色混合叠加。
 * 3) HDR 泛光 + ACES 色调映射。
 * 所有位置在 CPU 端以双精度换算为“相对相机”坐标后再交给 GPU，避免浮点精度问题。
 */
(function () {
  'use strict';

  const VS_FULL = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;
  const COMMON = `
precision highp float;
#define PI 3.14159265
varying vec2 vUv;
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
`;
  const SKY_FS = COMMON + `
uniform vec2 uRes;
uniform vec3 uFwd, uRight, uUp;
uniform float uTan, uTime, uPixAng, uHdr, uStar;
uniform vec4 uSph[12];
uniform vec4 uSphP[12];
uniform float uNS;
uniform vec3 uSun; uniform float uSunR, uSunOn;
uniform vec3 uBH; uniform float uRs, uLens;
uniform float uAccL;

float noise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float fbm3(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*noise(p); p=p*2.1+vec3(5.1,1.3,7.7); a*=0.5; } return s; }
vec3 blackbody(float T){
  float t = clamp(T, 800.0, 40000.0)/100.0; float r, g, b;
  if(t <= 66.0){ r = 1.0; g = 0.3900815788*log(t) - 0.6318414438; }
  else { r = 1.292936186*pow(t-60.0, -0.1332047592); g = 1.129890861*pow(t-60.0, -0.0755148492); }
  if(t >= 66.0) b = 1.0; else if(t <= 19.0) b = 0.0; else b = 0.5432067891*log(t-10.0) - 1.19625408914;
  return pow(clamp(vec3(r,g,b),0.0,1.0), vec3(2.2));
}
vec3 starField(vec3 d){
  vec3 col = vec3(0.0);
  for(int L=0; L<3; L++){
    float sc = 70.0 + 75.0*float(L);
    vec3 p = d*sc; vec3 c = floor(p); vec3 f = fract(p);
    float h = hash13(c + float(L)*37.0);
    float th = 0.968 - 0.006*float(L);
    if(h > th){
      vec3 sp = 0.3 + 0.4*vec3(hash13(c+11.1), hash13(c+23.7), hash13(c+47.3));
      vec3 dd = f - sp; float d2 = dot(dd,dd);
      float sig = clamp(uPixAng*sc*0.6, 0.02, 0.09);
      float b = pow((h-th)/(1.0-th), 3.0);
      col += blackbody(2800.0 + 11000.0*pow(hash13(c+71.9),1.6)) * b * exp(-d2/(2.0*sig*sig))*1.8;
    }
  }
  return col;
}
vec3 milkyWay(vec3 d){
  vec3 n = normalize(vec3(0.46, 0.87, 0.18));
  float y = dot(d, n);
  float band = exp(-y*y*10.0);
  float f = fbm(d*3.2); float f2 = fbm3(d*8.0 + 3.0);
  float dust = smoothstep(0.42, 0.72, fbm3(d*5.5+7.0));
  vec3 c = mix(vec3(0.30,0.24,0.55), vec3(1.0,0.80,0.58), f2);
  vec3 col = c*band*(0.15 + f*f*1.6)*(1.0 - 0.75*dust*band);
  col += vec3(0.15,0.30,0.85)*pow(fbm3(d*1.7+13.0),3.0)*0.3 + vec3(0.85,0.2,0.45)*pow(fbm3(d*2.4+29.0),4.0)*0.35;
  return col*0.2;
}
// 史瓦西光线偏折角（x = b/r_s）：对数发散项 + 多项式，最大误差 0.003 rad
float deflect(float x){
  float y = 2.5980762/x;
  float lg = y < 1e-3 ? y + 0.5*y*y : -log(1.0 - y);
  return lg + y*(-0.23019964 + y*(0.10028244 + y*(-0.95049592 + y*(1.57975783 - 0.89574997*y))));
}
float hitSphere(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = c - ro; float tca = dot(oc, rd);
  vec3 pp = oc - rd*tca; float d2 = dot(pp,pp); float r2 = r*r;
  if(d2 > r2 || tca < 0.0) return -1.0;
  return tca - sqrt(r2 - d2);
}
vec3 axisOf(float tilt){ return vec3(-sin(tilt), cos(tilt), 0.0); }

vec3 sunLightAt(vec3 p, out vec3 L){
  vec3 d = uSun - p; float r = length(d); L = d/r;
  return vec3(1.0,0.95,0.88)*uSunOn*1.6/pow(max(r,0.7),0.7);
}
vec3 accLightAt(vec3 p, out vec3 L){
  vec3 d = uBH - p; float r = length(d); L = d/r;
  float flux = uAccL/(r*r+1e-8); // 以“1 AU 处太阳光”为单位
  return vec3(0.75,0.85,1.0)*log(1.0 + flux)*0.35;
}

vec4 shadePlanet(float type, vec3 p, vec3 c, float r, float spin, float tilt, vec3 rd){
  vec3 n = normalize(p - c);
  vec3 ax = axisOf(tilt);
  vec3 ex = normalize(cross(ax, vec3(0.0,0.0,1.0)));
  vec3 ez = cross(ex, ax);
  vec3 q = vec3(dot(n,ex), dot(n,ax), dot(n,ez));
  float cs = cos(spin), sn = sin(spin);
  q = vec3(cs*q.x - sn*q.z, q.y, sn*q.x + cs*q.z);
  float lat = q.y;
  vec3 alb; float night = 0.0; float atm = 0.0; vec3 atmCol = vec3(0.4,0.6,1.0);
  if(type < 1.5){ // 水星
    float cr = fbm(q*6.0); alb = vec3(0.55,0.52,0.5)*(0.6 + 0.6*cr);
  } else if(type < 2.5){ // 金星
    float w = fbm(q*3.0 + vec3(0.0, lat*4.0, 0.0)); alb = mix(vec3(0.95,0.85,0.6), vec3(1.0,0.95,0.8), w); atm = 0.6; atmCol = vec3(1.0,0.85,0.5);
  } else if(type < 3.5){ // 地球
    float land = fbm(q*2.2 + 3.0);
    float cloud = smoothstep(0.5, 0.75, fbm(q*4.0 + vec3(uTime*0.01, 0.0, 0.0)));
    vec3 ocean = vec3(0.02,0.1,0.3);
    vec3 ground = mix(vec3(0.15,0.35,0.1), vec3(0.55,0.45,0.28), smoothstep(0.55,0.7,fbm(q*5.0)));
    alb = land > 0.52 ? ground : ocean;
    if(abs(lat) > 0.88) alb = vec3(0.9);
    alb = mix(alb, vec3(0.95), cloud*0.85);
    night = (land > 0.52 && abs(lat) < 0.8) ? smoothstep(0.62, 0.8, noise(q*40.0))*(1.0-cloud) : 0.0;
    atm = 1.0;
  } else if(type < 4.5){ // 火星
    alb = mix(vec3(0.75,0.35,0.18), vec3(0.45,0.22,0.12), smoothstep(0.45,0.65,fbm(q*3.0)));
    if(abs(lat) > 0.9) alb = vec3(0.95); atm = 0.2; atmCol = vec3(1.0,0.6,0.4);
  } else if(type < 5.5){ // 木星
    float b = lat*9.0 + fbm(q*vec3(3.0,1.0,3.0))*1.6;
    alb = mix(vec3(0.85,0.75,0.6), vec3(0.6,0.42,0.3), 0.5+0.5*sin(b*2.3));
    alb = mix(alb, vec3(0.95,0.9,0.85), smoothstep(0.6,0.95,sin(b*1.1+1.0))*0.5);
    vec2 gs = vec2(atan(q.z,q.x) - 0.6, lat + 0.33); gs.x *= 0.55;
    alb = mix(alb, vec3(0.75,0.35,0.22), smoothstep(0.1, 0.05, length(gs)));
  } else if(type < 6.5){ // 土星
    float b = lat*8.0 + fbm(q*vec3(2.0,1.0,2.0))*0.8;
    alb = mix(vec3(0.92,0.84,0.62), vec3(0.78,0.66,0.45), 0.5+0.5*sin(b*2.0));
  } else if(type < 7.5){ // 天王星
    alb = vec3(0.6,0.85,0.9)*(0.95 + 0.05*sin(lat*20.0)); atm = 0.4; atmCol = vec3(0.6,0.9,1.0);
  } else if(type < 8.5){ // 海王星
    alb = mix(vec3(0.2,0.35,0.85), vec3(0.3,0.5,0.95), 0.5+0.5*sin(lat*12.0 + fbm(q*3.0)*2.0)); atm = 0.4;
  } else { // 月球
    alb = vec3(0.6)*(0.65 + 0.45*fbm(q*5.0)) * (1.0 - 0.35*smoothstep(0.5,0.6,fbm(q*1.5+9.0)));
  }
  vec3 Ls, La;
  vec3 Is = sunLightAt(p, Ls);
  vec3 Ia = accLightAt(p, La);
  float ds = max(dot(n, Ls), 0.0), da = max(dot(n, La), 0.0);
  vec3 col = alb*(Is*ds + Ia*da + 0.004);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  col += atmCol*rim*atm*(Is*smoothstep(-0.2, 0.4, dot(n, Ls)) + Ia*0.5)*0.5;
  col += vec3(1.0,0.7,0.35)*night*smoothstep(0.1,-0.1,dot(n,Ls))*0.25;
  return vec4(col, 1.0);
}
vec3 shadeSun(vec3 p, vec3 c, float r, vec3 rd){
  vec3 n = normalize(p - c);
  float mu = max(dot(n, -rd), 0.0);
  float gran = fbm(n*28.0 + uTime*0.05);
  float spots = smoothstep(0.72, 0.8, fbm(n*4.0 + 17.0));
  vec3 col = blackbody(5772.0)*9.0*(0.35 + 0.65*mu)*(0.85 + 0.3*gran)*(1.0 - 0.6*spots);
  return col;
}
// 土星环
vec4 ringHit(vec3 ro, vec3 rd, vec3 c, float r, float tilt, out float tRing){
  vec3 ax = axisOf(tilt);
  float den = dot(rd, ax);
  tRing = -1.0;
  if(abs(den) < 1e-6) return vec4(0.0);
  float t = dot(c - ro, ax)/den;
  if(t <= 0.0) return vec4(0.0);
  vec3 p = ro + rd*t;
  float d = length(p - c)/r;
  if(d < 1.24 || d > 2.27) return vec4(0.0);
  tRing = t;
  float band = 0.55 + 0.45*sin(d*60.0)*sin(d*13.0);
  float gap = smoothstep(0.0, 0.02, abs(d - 1.95)); // 卡西尼缝
  vec3 Ls; vec3 Is = sunLightAt(p, Ls);
  vec3 col = vec3(0.85,0.78,0.62)*band*Is*(0.3 + 0.7*abs(dot(Ls, ax)));
  return vec4(col, 0.75*band*gap);
}
vec3 sunGlow(vec3 ro, vec3 rd){
  vec3 d = uSun - ro; float dist = length(d);
  float c = dot(rd, d/dist);
  float th = uSunR/dist;
  float a = acos(clamp(c, -1.0, 1.0));
  float g = th*th/(a*a + th*th*0.3);
  return blackbody(5772.0)*uSunOn*(0.35*g + 0.02*th/(a + th))*2.0;
}

// 在光线 (ro, rd) 上找最近的天体并着色；返回 alpha=0 表示没击中
vec4 traceBodies(vec3 ro, vec3 rd, float tMax){
  float best = tMax; vec4 col = vec4(0.0); 
  vec4 ringCol = vec4(0.0); float ringT = 1e30;
  for(int i=0;i<12;i++){
    if(float(i) >= uNS) break;
    vec4 S = uSph[i]; vec4 P = uSphP[i];
    float t = hitSphere(ro, rd, S.xyz, S.w);
    if(t > 0.0 && t < best){
      best = t;
      vec3 p = ro + rd*t;
      col = P.x < 0.5 ? vec4(shadeSun(p, S.xyz, S.w, rd), 1.0) : shadePlanet(P.x, p, S.xyz, S.w, P.y, P.z, rd);
    }
    if(P.x > 5.5 && P.x < 6.5){
      float tr; vec4 rc = ringHit(ro, rd, S.xyz, S.w, P.z, tr);
      if(tr > 0.0 && tr < ringT){ ringT = tr; ringCol = rc; }
    }
  }
  if(ringT < best && ringCol.a > 0.0){
    col = vec4(mix(col.rgb, ringCol.rgb, ringCol.a), max(col.a, ringCol.a));
  }
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy/uRes)*2.0 - 1.0;
  uv.x *= uRes.x/uRes.y;
  vec3 rd = normalize(uFwd + (uv.x*uRight + uv.y*uUp)*uTan);
  vec3 ro = vec3(0.0);
  vec3 col;
  float tb = dot(uBH, rd);
  bool lensed = uLens > 0.5 && tb > 0.0;
  vec4 h = traceBodies(ro, rd, lensed ? tb : 1e30);
  if(h.a > 0.99){
    col = h.rgb;
  } else {
    vec3 dir = rd; vec3 org = ro; bool dark = false;
    if(lensed){
      vec3 cp = rd*tb;
      vec3 toBH = uBH - cp;
      float b = length(toBH);
      float x = b/uRs;
      if(x < 2.5980762){ dark = true; }
      else {
        float a = deflect(x);
        vec3 nb = toBH/b;
        dir = normalize(cos(a)*rd + sin(a)*nb);
        org = cp;
      }
    }
    if(dark) col = vec3(0.0);
    else {
      vec4 h2 = traceBodies(org, dir, 1e30);
      // 太阳在黑洞“前方”时，其辉光按未偏折的视线计算；在黑洞后方时按偏折后的光线计算
      bool sunBehind = lensed && dot(uSun, rd) > tb;
      vec3 bg = (starField(dir) + milkyWay(dir))*uStar + (sunBehind ? sunGlow(org, dir) : sunGlow(ro, rd));
      col = h2.a > 0.0 ? mix(bg, h2.rgb, h2.a) : bg;
    }
    col = mix(col, h.rgb, h.a);
  }
  gl_FragColor = vec4(col*uHdr, 1.0);
}`;

  // 精灵与线：相对相机坐标 → 裁剪空间（w = 视线深度，背后的点自动被裁掉）
  const VS_SPRITE = `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform vec3 uFwd, uRight, uUp; uniform float uTan, uAspect, uPx;
varying vec4 vCol;
void main(){
  float z = dot(aPos, uFwd);
  gl_Position = vec4(dot(aPos,uRight)/(uTan*uAspect), dot(aPos,uUp)/uTan, 0.0, z);
  gl_PointSize = aSize*uPx;
  vCol = aCol;
}`;
  const FS_SPRITE = `
precision highp float;
varying vec4 vCol; uniform float uMode, uHdr;
void main(){
  vec2 q = gl_PointCoord*2.0 - 1.0;
  float r2 = dot(q,q);
  if(r2 > 1.0) discard;
  if(uMode < 0.5){
    float g = exp(-r2*4.0) + 0.15*exp(-r2*1.2);
    gl_FragColor = vec4(vCol.rgb*vCol.a*g*uHdr, 1.0);
  } else {
    // 黑洞标记：黑色核心 + 橙色细环（普通透明混合）
    float r = sqrt(r2);
    float ring = smoothstep(0.62, 0.7, r)*smoothstep(0.85, 0.72, r);
    float core = 1.0 - smoothstep(0.55, 0.62, r);
    vec3 c = mix(vec3(0.0), vec3(1.0,0.55,0.2)*1.5, ring);
    gl_FragColor = vec4(c*uHdr, max(core, ring)*vCol.a);
  }
}`;
  const VS_LINE = `
attribute vec3 aPos; attribute vec4 aCol;
uniform vec3 uFwd, uRight, uUp; uniform float uTan, uAspect;
varying vec4 vCol;
void main(){
  float z = dot(aPos, uFwd);
  gl_Position = vec4(dot(aPos,uRight)/(uTan*uAspect), dot(aPos,uUp)/uTan, 0.0, z);
  vCol = aCol;
}`;
  const FS_LINE = `precision highp float; varying vec4 vCol; uniform float uHdr; void main(){ gl_FragColor = vec4(vCol.rgb*vCol.a*uHdr, 1.0); }`;

  const BRIGHT_FS = COMMON + `
uniform sampler2D uTex; uniform float uTh, uInvHdr, uHdrScale;
void main(){ vec3 c = texture2D(uTex, vUv).rgb*uInvHdr; float l = dot(c, vec3(0.2126,0.7152,0.0722)); gl_FragColor = vec4(c*max(l-uTh,0.0)/max(l,1e-4)*uHdrScale, 1.0); }`;
  const BLUR_FS = COMMON + `
uniform sampler2D uTex; uniform vec2 uDir;
void main(){
  vec3 s = texture2D(uTex, vUv).rgb*0.227027;
  s += (texture2D(uTex, vUv + uDir*1.3846153846).rgb + texture2D(uTex, vUv - uDir*1.3846153846).rgb)*0.3162162162;
  s += (texture2D(uTex, vUv + uDir*3.2307692308).rgb + texture2D(uTex, vUv - uDir*3.2307692308).rgb)*0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;
  const COMP_FS = COMMON + `
uniform sampler2D uScene, uBA, uBB;
uniform float uInvHdr, uExposure, uTime, uFlash, uBloom;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec3 c = texture2D(uScene, vUv).rgb*uInvHdr;
  vec3 b = (texture2D(uBA, vUv).rgb*0.6 + texture2D(uBB, vUv).rgb*1.0)*uInvHdr;
  vec3 col = (c + b*uBloom)*uExposure + vec3(1.0,0.95,0.9)*uFlash;
  col = aces(col);
  vec2 q = vUv - 0.5; col *= 1.0 - dot(q,q)*0.6;
  col = pow(col, vec3(1.0/2.2));
  col += (hash12(gl_FragCoord.xy + fract(uTime)*100.0) - 0.5)*0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

  class InvasionRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      const attrs = { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' };
      let gl = canvas.getContext('webgl2', attrs);
      this.isGL2 = !!gl;
      if (!gl) gl = canvas.getContext('webgl', attrs);
      this.ok = !!gl;
      if (!gl) return;
      this.gl = gl;
      this.texType = gl.UNSIGNED_BYTE; this.texInternal = gl.RGBA; this.hdr = 0.25;
      if (this.isGL2 && gl.getExtension('EXT_color_buffer_float')) { this.texType = gl.HALF_FLOAT; this.texInternal = gl.RGBA16F; this.hdr = 1; }
      else if (!this.isGL2) {
        const hf = gl.getExtension('OES_texture_half_float'), cb = gl.getExtension('EXT_color_buffer_half_float'), lin = gl.getExtension('OES_texture_half_float_linear');
        if (hf && cb && lin) { this.texType = hf.HALF_FLOAT_OES; this.hdr = 1; }
      }
      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vbo = gl.createBuffer();
      try {
        this.pSky = this._prog(VS_FULL, SKY_FS, ['aPos']);
        this.pBright = this._prog(VS_FULL, BRIGHT_FS, ['aPos']);
        this.pBlur = this._prog(VS_FULL, BLUR_FS, ['aPos']);
        this.pComp = this._prog(VS_FULL, COMP_FS, ['aPos']);
        this.pSprite = this._prog(VS_SPRITE, FS_SPRITE, ['aPos', 'aCol', 'aSize']);
        this.pLine = this._prog(VS_LINE, FS_LINE, ['aPos', 'aCol']);
      } catch (e) { console.error(e); this.ok = false; return; }
      this.scale = /Mobi|Android/i.test(navigator.userAgent) ? 0.45 : 0.65;
      this.fbos = {};
      this.times = [];
      this._resize(true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos.scene.fb);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        this.texType = gl.UNSIGNED_BYTE; this.texInternal = gl.RGBA; this.hdr = 0.25; this._resize(true);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    _prog(vs, fs, attrs) {
      const gl = this.gl;
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    }
    _fbo(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, this.texInternal, w, h, 0, gl.RGBA, this.texType, null);
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR));
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w, h };
    }
    _resize(force) {
      const gl = this.gl, dpr = Math.min(devicePixelRatio || 1, 2);
      const cw = Math.max(2, Math.round(this.canvas.clientWidth * dpr)), ch = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
      const sw = Math.max(2, Math.round(cw * this.scale)), sh = Math.max(2, Math.round(ch * this.scale));
      if (!force && this.canvas.width === cw && this.canvas.height === ch && this.fbos.scene && this.fbos.scene.w === sw && this.fbos.scene.h === sh) return;
      this.canvas.width = cw; this.canvas.height = ch;
      for (const k in this.fbos) { gl.deleteTexture(this.fbos[k].tex); gl.deleteFramebuffer(this.fbos[k].fb); }
      const hw = Math.max(2, sw >> 1), hh = Math.max(2, sh >> 1), qw = Math.max(2, sw >> 2), qh = Math.max(2, sh >> 2);
      this.fbos = { scene: this._fbo(sw, sh), hA: this._fbo(hw, hh), hB: this._fbo(hw, hh), qA: this._fbo(qw, qh), qB: this._fbo(qw, qh) };
    }
    adapt(dt) {
      this.times.push(dt);
      if (this.times.length < 40) return;
      const avg = this.times.reduce((a, b) => a + b, 0) / this.times.length;
      this.times = [];
      if (avg > 0.045 && this.scale > 0.3) this.scale *= 0.85;
      else if (avg < 0.022 && this.scale < 1) this.scale = Math.min(1, this.scale * 1.1);
      else return;
      this._resize(true);
    }
    _full(prog, target, setup) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
      gl.useProgram(prog.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      for (let i = 1; i < 3; i++) gl.disableVertexAttribArray(i);
      setup(prog.u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    _tex(unit, tex, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); }

    /** 将世界坐标（双精度）转换为相对相机的 Float32 */
    rel(p) { return [p[0] - this.cam.pos[0], p[1] - this.cam.pos[1], p[2] - this.cam.pos[2]]; }

    /**
     * frame: { cam:{pos,fwd,right,up,fov}, time, spheres:[{c,r,type,spin,tilt}], sun:{c,r,on}, bh:{c,rs,acc,marker},
     *          sprites: {pos:Float32Array(rel), col:Float32Array, size:Float32Array, n}, lines:{pos,col,n}, exposure, flash, lens }
     */
    render(f) {
      if (!this.ok) return;
      const gl = this.gl;
      this._resize(false);
      this.cam = f.cam;
      const F = this.fbos;
      const tanF = Math.tan((f.cam.fov * Math.PI) / 360);
      const aspect = F.scene.w / F.scene.h;
      gl.disable(gl.BLEND);
      // 1) 天空 + 天体 + 透镜
      this._full(this.pSky, F.scene, (u) => {
        gl.uniform2f(u.uRes, F.scene.w, F.scene.h);
        gl.uniform3fv(u.uFwd, f.cam.fwd); gl.uniform3fv(u.uRight, f.cam.right); gl.uniform3fv(u.uUp, f.cam.up);
        gl.uniform1f(u.uTan, tanF);
        gl.uniform1f(u.uPixAng, (2 * tanF) / F.scene.h);
        gl.uniform1f(u.uTime, f.time);
        gl.uniform1f(u.uHdr, this.hdr);
        gl.uniform1f(u.uStar, f.starBright == null ? 1 : f.starBright);
        const S = new Float32Array(48), SP = new Float32Array(48);
        const n = Math.min(12, f.spheres.length);
        for (let i = 0; i < n; i++) {
          const s = f.spheres[i], r = this.rel(s.c);
          S.set([r[0], r[1], r[2], s.r], 4 * i);
          SP.set([s.type, s.spin || 0, s.tilt || 0, 0], 4 * i);
        }
        gl.uniform4fv(u.uSph, S); gl.uniform4fv(u.uSphP, SP);
        gl.uniform1f(u.uNS, n);
        gl.uniform3fv(u.uSun, this.rel(f.sun.c)); gl.uniform1f(u.uSunR, f.sun.r); gl.uniform1f(u.uSunOn, f.sun.on);
        gl.uniform3fv(u.uBH, this.rel(f.bh.c)); gl.uniform1f(u.uRs, f.bh.rs); gl.uniform1f(u.uLens, f.lens ? 1 : 0);
        gl.uniform1f(u.uAccL, f.bh.acc || 0);
      });
      // 2) 线与精灵（加色混合）
      gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fb);
      gl.viewport(0, 0, F.scene.w, F.scene.h);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const camU = (u) => {
        gl.uniform3fv(u.uFwd, f.cam.fwd); gl.uniform3fv(u.uRight, f.cam.right); gl.uniform3fv(u.uUp, f.cam.up);
        gl.uniform1f(u.uTan, tanF); gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uHdr, this.hdr);
      };
      if (f.lines && f.lines.n) {
        gl.useProgram(this.pLine.p); camU(this.pLine.u);
        this._attribs(f.lines.pos, f.lines.col, null);
        gl.drawArrays(gl.LINES, 0, f.lines.n);
      }
      if (f.sprites && f.sprites.n) {
        gl.useProgram(this.pSprite.p); camU(this.pSprite.u);
        gl.uniform1f(this.pSprite.u.uPx, this.scale * Math.min(devicePixelRatio || 1, 2));
        gl.uniform1f(this.pSprite.u.uMode, 0);
        this._attribs(f.sprites.pos, f.sprites.col, f.sprites.size);
        gl.drawArrays(gl.POINTS, 0, f.sprites.n);
      }
      if (f.marker) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.pSprite.p); camU(this.pSprite.u);
        gl.uniform1f(this.pSprite.u.uPx, this.scale * Math.min(devicePixelRatio || 1, 2));
        gl.uniform1f(this.pSprite.u.uMode, 1);
        this._attribs(new Float32Array(this.rel(f.marker.c)), new Float32Array([1, 1, 1, f.marker.alpha]), new Float32Array([f.marker.size]));
        gl.drawArrays(gl.POINTS, 0, 1);
      }
      gl.disable(gl.BLEND);
      for (let i = 0; i < 3; i++) gl.disableVertexAttribArray(i);
      // 3) 泛光
      const inv = 1 / this.hdr;
      this._full(this.pBright, F.hA, (u) => { this._tex(0, F.scene.tex, u.uTex); gl.uniform1f(u.uTh, 0.7); gl.uniform1f(u.uInvHdr, inv); gl.uniform1f(u.uHdrScale, this.hdr); });
      const blur = (s, d, dx, dy, k) => this._full(this.pBlur, d, (u) => { this._tex(0, s.tex, u.uTex); gl.uniform2f(u.uDir, (dx * k) / s.w, (dy * k) / s.h); });
      blur(F.hA, F.hB, 1, 0, 1); blur(F.hB, F.hA, 0, 1, 1);
      blur(F.hA, F.qB, 1, 0, 1.5); blur(F.qB, F.qA, 0, 1, 1.5);
      blur(F.qA, F.qB, 1, 0, 3); blur(F.qB, F.qA, 0, 1, 3);
      this._full(this.pComp, null, (u) => {
        this._tex(0, F.scene.tex, u.uScene); this._tex(1, F.hA.tex, u.uBA); this._tex(2, F.qA.tex, u.uBB);
        gl.uniform1f(u.uInvHdr, inv); gl.uniform1f(u.uExposure, f.exposure || 1); gl.uniform1f(u.uTime, f.time);
        gl.uniform1f(u.uFlash, f.flash || 0); gl.uniform1f(u.uBloom, 1.0);
      });
    }
    _attribs(pos, col, size) {
      const gl = this.gl;
      const nBytes = pos.byteLength + col.byteLength + (size ? size.byteLength : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, nBytes, gl.STREAM_DRAW);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bufferSubData(gl.ARRAY_BUFFER, pos.byteLength, col);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, pos.byteLength);
      if (size) {
        gl.bufferSubData(gl.ARRAY_BUFFER, pos.byteLength + col.byteLength, size);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, pos.byteLength + col.byteLength);
      } else gl.disableVertexAttribArray(2);
    }
    destroy() {
      if (!this.gl) return;
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
  window.InvasionRenderer = InvasionRenderer;
})();
