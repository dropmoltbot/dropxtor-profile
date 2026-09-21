/* dropxtor relay v5 — carrier instrument. Public copy is English. */
(function () {
  "use strict";
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var N = REDUCE ? 1600 : (Math.min(window.innerWidth, 900) < 520 ? 3400 : 9000);
  var audioArmed = false;
  var actx = null;
  var filter = null;
  var open = true;
  var dead = false;
  var t0 = performance.now();
  var mode = 0;
  var morph = 0;
  var yaw = 0.7;
  var pitch = 0.32;
  var dist = 4.6;
  var tear = 0;
  var mx = 0;
  var my = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var pulse = 0;

  var NAMES = ["ANVILVEIN", "VECTORBLOOM", "STORM", "EMBER"];
  var LINES = [
    "a knot is a memory that refuses to be a line",
    "the field keeps the angle, not the flower",
    "the marsh is transmitting. you are the carrier",
    "one ember. the rest of the room can wait"
  ];

  function el(tag, html) {
    var n = document.createElement(tag);
    if (html) n.innerHTML = html;
    return n;
  }

  var style = document.createElement("style");
  style.textContent = [
    "#relay-root{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:40;background:#010302;cursor:crosshair;touch-action:none}",
    "#relay-root.dock{top:auto;left:auto;right:14px;bottom:18px;width:156px;height:156px;z-index:45;border:1px solid rgba(0,255,65,.28);background:#010302;box-shadow:0 0 0 1px rgba(0,0,0,.65),0 0 28px rgba(0,255,65,.16)}",
    "#relay-gl{display:block;width:100%;height:100%;touch-action:none}",
    "#relay-hud{position:absolute;left:0;right:0;bottom:6vh;text-align:center;pointer-events:none;font-family:\"JetBrains Mono\",ui-monospace,monospace;color:#d7ffe4}",
    "#relay-root.dock #relay-hud,#relay-root.dock #relay-close,#relay-root.dock #relay-phase{display:none}",
    "#relay-phase{position:absolute;top:18px;left:18px;font:11px \"JetBrains Mono\",monospace;letter-spacing:.22em;color:#6dff8a;opacity:.72;pointer-events:none}",
    "#relay-kicker{font-size:11px;letter-spacing:.46em;color:#6dff8a;opacity:.75;margin-bottom:8px}",
    "#relay-title{font-family:VT323,monospace;font-size:clamp(46px,8vw,96px);letter-spacing:.16em;line-height:.85;text-shadow:0 0 22px rgba(0,255,65,.4)}",
    "#relay-mode{margin-top:12px;font-size:13px;letter-spacing:.34em;color:#f6851b}",
    "#relay-sub{margin-top:10px;font-size:12px;letter-spacing:.06em;color:#b7c4ba;max-width:680px;margin-left:auto;margin-right:auto;padding:0 18px}",
    "#relay-keys{margin-top:14px;font-size:10px;letter-spacing:.16em;color:#6d7a72}",
    "#relay-credit{margin-top:18px;font-size:10px;letter-spacing:.22em;color:#3d4a42}",
    "#relay-close{position:absolute;top:16px;right:16px;pointer-events:auto;background:transparent;border:1px solid rgba(0,255,65,.28);color:#8d9a90;font:11px \"JetBrains Mono\",monospace;letter-spacing:.18em;padding:8px 12px;cursor:pointer}",
    "#tube-gl{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:12;pointer-events:none;mix-blend-mode:screen;opacity:.2}",
    "#relay-chip{cursor:pointer;color:#6dff8a;letter-spacing:.12em;background:transparent;border:0;font:inherit;padding:0}",
    "@media(max-width:640px){#relay-root.dock{width:104px;height:104px;right:10px;bottom:12px}#relay-title{letter-spacing:.08em}#relay-keys{letter-spacing:.06em}}"
  ].join("");
  document.head.appendChild(style);

  var root = el("div");
  root.id = "relay-root";
  root.setAttribute("data-relay", "v5");
  var canvas = el("canvas");
  canvas.id = "relay-gl";
  var phaseEl = el("div");
  phaseEl.id = "relay-phase";
  phaseEl.textContent = "PHASE 0.000";
  var hud = el("div", [
    '<div id="relay-kicker">CARRIER LOCK</div>',
    '<div id="relay-title">RELAY</div>',
    '<div id="relay-mode">ANVILVEIN</div>',
    '<div id="relay-sub">a knot is a memory that refuses to be a line</div>',
    '<div id="relay-keys">DRAG ORBIT · SCROLL DOLLY · 1–4 FIELD · ESC DOCKS THE TERMINAL</div>',
    '<div id="relay-credit">relay // dropmoltbot</div>'
  ].join(""));
  hud.id = "relay-hud";
  var closeBtn = el("button");
  closeBtn.id = "relay-close";
  closeBtn.type = "button";
  closeBtn.textContent = "ESC DOCK";
  root.appendChild(canvas);
  root.appendChild(phaseEl);
  root.appendChild(hud);
  root.appendChild(closeBtn);
  document.body.appendChild(root);

  var tube = el("canvas");
  tube.id = "tube-gl";
  tube.setAttribute("aria-hidden", "true");
  document.body.appendChild(tube);

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    var a = compile(gl, gl.VERTEX_SHADER, vs);
    var b = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!a || !b) return null;
    gl.attachShader(p, a);
    gl.attachShader(p, b);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  var gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  var glT = tube.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
  if (!gl) { root.remove(); tube.remove(); return; }

  var VS = [
    "attribute float aId;",
    "uniform float uCount,uTime,uMode,uMorph,uTear,uPoint;",
    "uniform vec2 uMouse;",
    "uniform mat4 uMVP;",
    "varying float vStr;",
    "varying float vEmber;",
    "vec3 knotAt(float t){",
    "  float R=1.28, r=0.48;",
    "  float pt=2.0*t, qt=3.0*t;",
    "  return vec3((R+r*cos(qt))*cos(pt), r*sin(qt), (R+r*cos(qt))*sin(pt));",
    "}",
    "void main(){",
    "  float id=aId;",
    "  float t=(id/uCount)*6.2831853;",
    "  vec3 c0=knotAt(t);",
    "  vec3 tang=normalize(knotAt(t+0.015)-knotAt(t-0.015));",
    "  vec3 side=normalize(cross(tang, vec3(0.0,1.0,0.0))+vec3(0.02,0.0,0.0));",
    "  vec3 bin=cross(tang, side);",
    "  float ang=id*2.399963;",
    "  float rad=0.055+0.028*fract(sin(id*12.9898)*43758.5);",
    "  vec3 rope=c0+side*cos(ang)*rad+bin*sin(ang)*rad;",
    "  float gx=mod(id,52.0)-26.0;",
    "  float gy=mod(floor(id/52.0),30.0)-15.0;",
    "  float gz=mod(floor(id/1560.0),8.0)-4.0;",
    "  vec3 lattice=vec3(gx,gy*0.72,gz)*0.105;",
    "  vec3 storm=vec3(sin(id*0.17+uTime*0.35)*2.1, fract(id*0.011+uTime*0.12)*3.4-1.7, cos(id*0.08-uTime*0.2)*1.5);",
    "  vec3 ember=normalize(rope+vec3(0.001))*(0.2+fract(sin(id*3.1)*99.0)*1.85);",
    "  vec3 alt=lattice;",
    "  if(uMode>1.5 && uMode<2.5) alt=storm;",
    "  if(uMode>2.5) alt=ember;",
    "  float k=uMode<0.5?0.0:uMorph;",
    "  vec3 target=mix(rope, alt, k);",
    "  vec4 clip=uMVP*vec4(target,1.0);",
    "  vec2 ndc=clip.xy/max(0.001,clip.w);",
    "  float pull=smoothstep(0.62,0.0,length(ndc-uMouse));",
    "  target+=normalize(target+vec3(0.001,0.0,0.0))*pull*uTear*0.9;",
    "  clip=uMVP*vec4(target,1.0);",
    "  gl_Position=clip;",
    "  gl_PointSize=clamp(uPoint*(1.7/max(0.4,clip.w)),1.0,32.0);",
    "  vStr=0.55+0.45*fract(sin(id*4.1+uTime*0.7)*999.0);",
    "  vEmber=uMode>2.5?1.0:0.0;",
    "}"
  ].join("");

  var FS = [
    "precision mediump float;",
    "varying float vStr;",
    "varying float vEmber;",
    "uniform float uAlpha;",
    "void main(){",
    "  vec2 c=gl_PointCoord-vec2(0.5);",
    "  float d=length(c);",
    "  if(d>0.5) discard;",
    "  float a=smoothstep(0.5,0.05,d)*vStr*uAlpha;",
    "  vec3 col=mix(vec3(0.12,1.0,0.36), vec3(1.0,0.48,0.07), vEmber);",
    "  float core=smoothstep(0.22,0.0,d);",
    "  col+=vec3(0.45,0.7,0.3)*core;",
    "  gl_FragColor=vec4(col,a);",
    "}"
  ].join("");

  var prog = program(gl, VS, FS);
  if (!prog) { root.remove(); tube.remove(); return; }

  var ids = new Float32Array(N);
  for (var i = 0; i < N; i++) ids[i] = i;
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW);
  var loc = {};
  ["uCount", "uTime", "uMode", "uMorph", "uTear", "uPoint", "uMouse", "uMVP", "uAlpha"].forEach(function (k) {
    loc[k] = gl.getUniformLocation(prog, k);
  });
  var aId = gl.getAttribLocation(prog, "aId");

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function persp(aspect) {
    var t = 1 / Math.tan(0.56);
    var n = 0.1, f = 40;
    return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
  }
  function view(y, p, d) {
    var cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
    var x = d * cp * sy, yy = d * sp, z = d * cp * cy;
    var fx = -x, fy = -yy, fz = -z, fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    var rx = fz, rz = -fx, rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    var ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    return new Float32Array([
      rx, ux, -fx, 0,
      0, uy, -fy, 0,
      rz, uz, -fz, 0,
      -(rx * x + rz * z), -(ux * x + uy * yy + uz * z), fx * x + fy * yy + fz * z, 1
    ]);
  }

  function resize(c, g) {
    var w = Math.max(2, Math.floor(c.clientWidth));
    var h = Math.max(2, Math.floor(c.clientHeight));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.viewport(0, 0, c.width, c.height);
    return w / Math.max(1, h);
  }

  function draw(time) {
    var aspect = resize(canvas, gl);
    var power = Math.min(1, Math.max(0, (time - 0.08) / 0.7));
    gl.clearColor(0.004, 0.01, 0.006, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(prog);
    var d = dist * (aspect < 0.85 ? 1.45 : 1);
    var mvp = mul(persp(aspect || 1), view(yaw + time * 0.08, pitch, d));
    if (power < 1 && open) {
      mvp = mul(new Float32Array([1, 0, 0, 0, 0, Math.max(0.015, power), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), mvp);
    }
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.uniform1f(loc.uCount, N);
    gl.uniform1f(loc.uTime, time);
    gl.uniform1f(loc.uMode, mode);
    gl.uniform1f(loc.uMorph, morph);
    gl.uniform1f(loc.uTear, tear);
    gl.uniform1f(loc.uPoint, (open ? 9.0 : 2.6) * (0.82 + pulse * 0.5));
    gl.uniform2f(loc.uMouse, mx, my);
    gl.uniform1f(loc.uAlpha, 0.75);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aId);
    gl.vertexAttribPointer(aId, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  var tubeProg = null;
  if (glT) {
    tubeProg = program(glT,
      "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}",
      "precision mediump float;uniform vec2 uRes;uniform float uTime;void main(){vec2 uv=gl_FragCoord.xy/uRes;float scan=0.55+0.45*sin(gl_FragCoord.y*1.45);float grille=0.84+0.16*sin(gl_FragCoord.x*2.4);float vig=smoothstep(1.15,0.3,length((uv-0.5)*vec2(1.1,1.2)));float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uTime*30.0)*43758.5453);float beam=smoothstep(0.01,0.0,abs(uv.y-fract(uTime*0.06)));vec3 col=vec3(0.04,0.7,0.26)*(0.07+scan*0.2)*grille*vig;col+=vec3(0.2,1.0,0.4)*beam*0.1;col+=(n-0.5)*0.04;gl_FragColor=vec4(col,0.55);}"
    );
    if (tubeProg) {
      var quad = glT.createBuffer();
      glT.bindBuffer(glT.ARRAY_BUFFER, quad);
      glT.bufferData(glT.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), glT.STATIC_DRAW);
    }
  }
  function drawTube(time) {
    if (!tubeProg) return;
    var boot = document.getElementById("boot-screen");
    tube.style.display = (open || (boot && boot.isConnected)) ? "none" : "block";
    if (tube.style.display === "none") return;
    resize(tube, glT);
    glT.useProgram(tubeProg);
    glT.enable(glT.BLEND);
    glT.blendFunc(glT.SRC_ALPHA, glT.ONE);
    var pos = glT.getAttribLocation(tubeProg, "aPos");
    glT.enableVertexAttribArray(pos);
    glT.vertexAttribPointer(pos, 2, glT.FLOAT, false, 0, 0);
    glT.uniform2f(glT.getUniformLocation(tubeProg, "uRes"), tube.width, tube.height);
    glT.uniform1f(glT.getUniformLocation(tubeProg, "uTime"), time);
    glT.drawArrays(glT.TRIANGLE_STRIP, 0, 4);
  }

  function setMode(m) {
    mode = m;
    morph = 0;
    var name = document.getElementById("relay-mode");
    var sub = document.getElementById("relay-sub");
    if (name) name.textContent = NAMES[m];
    if (sub) sub.textContent = LINES[m];
    if (filter && actx) {
      var now = actx.currentTime;
      filter.frequency.setTargetAtTime(160 + m * 180, now, 0.15);
    }
  }

  function ndc(e) {
    var r = canvas.getBoundingClientRect();
    mx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    my = 1 - ((e.clientY - r.top) / Math.max(1, r.height)) * 2;
  }
  canvas.addEventListener("pointerdown", function (e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    tear = 1;
    ndc(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    arm();
  });
  canvas.addEventListener("pointermove", function (e) {
    ndc(e);
    if (!dragging || !open) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-1.05, Math.min(1.05, pitch + (e.clientY - lastY) * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("pointerup", function () { dragging = false; });
  canvas.addEventListener("wheel", function (e) {
    if (!open) return;
    e.preventDefault();
    dist = Math.max(2.4, Math.min(9, dist + (e.deltaY > 0 ? 0.18 : -0.18)));
  }, { passive: false });

  function onFieldKey(e) {
    if (!open) return;
    var k = e.key;
    if (k !== "1" && k !== "2" && k !== "3" && k !== "4" && k.indexOf("Arrow") !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === "1") setMode(0);
    else if (k === "2") setMode(1);
    else if (k === "3") setMode(2);
    else if (k === "4") setMode(3);
    else if (k === "ArrowLeft") yaw -= 0.12;
    else if (k === "ArrowRight") yaw += 0.12;
    else if (k === "ArrowUp") dist = Math.max(2.4, dist - 0.25);
    else if (k === "ArrowDown") dist = Math.min(9, dist + 0.25);
  }
  function placeDock() {
    if (!window.CARRIER) return;
    var s = window.CARRIER.seal();
    if (!s || !s.x) return;
    root.style.right = "auto";
    root.style.bottom = "auto";
    var dx = s.x - (window.innerWidth / 2);
    var dy = s.y - (window.innerHeight / 2);
    var len = Math.hypot(dx, dy) || 1;
    var x = s.x + (dx / len) * 108 - 78;
    var y = s.y + (dy / len) * 108 - 78;
    x = Math.max(12, Math.min(window.innerWidth - 168, x));
    y = Math.max(12, Math.min(window.innerHeight - 168, y));
    root.style.left = Math.round(x) + "px";
    root.style.top = Math.round(y) + "px";
  }
  function syncField() {
    if (!window.CARRIER) return;
    window.CARRIER.claim("field", {
      el: root,
      z: open ? 320 : 40,
      keys: open,
      onEsc: dock,
      onKey: onFieldKey,
      tick: function () { if (!open) placeDock(); }
    });
    if (tube) tube.style.zIndex = "22";
  }
  function dock() {
    open = false;
    root.classList.add("dock");
    placeDock();
    syncField();
  }
  function expand() {
    open = true;
    root.classList.remove("dock");
    root.style.left = "";
    root.style.top = "";
    root.style.right = "";
    root.style.bottom = "";
    syncField();
    arm();
    chirp();
  }
  window.openRelay = expand;
  window.dockRelay = dock;
  closeBtn.addEventListener("click", function (e) { e.stopPropagation(); dock(); });
  root.addEventListener("click", function (e) {
    if (!open && e.target !== closeBtn) expand();
  });
  syncField();

  var scale = [0, 2, 4, 7, 9];
  function arm() {
    if (audioArmed) return;
    var shared = window.CARRIER && window.CARRIER.audio(true);
    if (!shared) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      shared = new AC();
    }
    actx = shared;
    audioArmed = true;
    filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    var gain = actx.createGain();
    gain.gain.value = 0.028;
    filter.connect(gain);
    gain.connect(actx.destination);
    [55, 55.35].forEach(function (f, i) {
      var o = actx.createOscillator();
      o.type = i ? "sine" : "triangle";
      o.frequency.value = f;
      o.connect(filter);
      o.start();
    });
    var step = 0;
    setInterval(function () {
      if (!actx) return;
      var now = actx.currentTime;
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = mode === 3 ? "sawtooth" : "triangle";
      o.frequency.value = 110 * Math.pow(2, scale[(step + mode) % scale.length] / 12);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      o.connect(g);
      g.connect(filter);
      o.start(now);
      o.stop(now + 0.55);
      step++;
      pulse = 1;
    }, 680);
  }
  function chirp() {
    if (!actx) return;
    var now = actx.currentTime;
    [196, 247, 330].forEach(function (f, i) {
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.055, now + 0.02 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      o.connect(g);
      g.connect(actx.destination);
      o.start(now);
      o.stop(now + 0.52);
    });
  }
  document.addEventListener("pointerdown", arm, { once: true });
  var chip = document.getElementById("relay-chip");
  if (chip) chip.addEventListener("click", function (e) { e.stopPropagation(); expand(); });

  var frames = 0;
  function frame(now) {
    if (dead) return;
    frames++;
    var time = (now - t0) / 1000;
    morph = Math.min(1, morph + 0.018);
    tear *= 0.965;
    pulse *= 0.92;
    if (open) phaseEl.textContent = "PHASE " + time.toFixed(3) + "  ·  " + N + " PTS";
    if (!document.hidden && (!REDUCE || frames % 2 === 0)) {
      draw(time);
      if (frames % 2 === 0) drawTube(time);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(function () {
    if (!canvas.width) { root.remove(); tube.remove(); }
  }, 8000);
})();
