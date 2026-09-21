/* dropxtor relay v4 — living carrier. Public copy is English. */
(function () {
  "use strict";
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var HOLD = /(?:\?|&)chamber(?:=|&|$)/.test(location.search);
  var audioArmed = false;
  var actx = null;
  var open = true;
  var dead = false;
  var t0 = performance.now();

  function el(tag, css, html) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (html) n.innerHTML = html;
    return n;
  }

  var style = document.createElement("style");
  style.textContent = [
    "#relay-root{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:10050;background:#020502;cursor:crosshair;transition:opacity .55s ease}",
    "#relay-root.dock{top:auto;left:auto;right:14px;bottom:18px;width:148px;height:148px;z-index:45;border:1px solid rgba(0,255,65,.28);background:#020502;box-shadow:0 0 0 1px rgba(0,0,0,.6), 0 0 24px rgba(0,255,65,.12)}",
    "#relay-root.dock canvas{cursor:pointer}",
    "#relay-root.gone{opacity:0;pointer-events:none}",
    "#relay-gl{display:block;width:100%;height:100%}",
    "#relay-hud{position:absolute;left:0;right:0;bottom:7vh;text-align:center;pointer-events:none;font-family:\"JetBrains Mono\",ui-monospace,monospace;color:#d7ffe4}",
    "#relay-root.dock #relay-hud{display:none}",
    "#relay-kicker{font-size:11px;letter-spacing:.42em;color:#6dff8a;opacity:.72;margin-bottom:10px}",
    "#relay-title{font-family:VT323,monospace;font-size:clamp(42px,8vw,92px);letter-spacing:.18em;line-height:.9;text-shadow:0 0 18px rgba(0,255,65,.45)}",
    "#relay-sub{margin-top:14px;font-size:12px;letter-spacing:.16em;color:#8d9a90}",
    "#relay-credit{margin-top:22px;font-size:10px;letter-spacing:.22em;color:#3d4a42}",
    "#relay-close{position:absolute;top:16px;right:16px;pointer-events:auto;background:transparent;border:1px solid rgba(0,255,65,.28);color:#8d9a90;font:11px \"JetBrains Mono\",monospace;letter-spacing:.18em;padding:8px 12px;cursor:pointer}",
    "#relay-root.dock #relay-close{display:none}",
    "#tube-gl{position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;z-index:12;pointer-events:none;mix-blend-mode:screen;opacity:.22}",
    "#relay-chip{cursor:pointer;color:#6dff8a;letter-spacing:.12em;background:transparent;border:0;font:inherit;padding:0}",
    "@media(max-width:640px){#relay-root.dock{width:108px;height:108px;right:10px;bottom:12px}#relay-title{letter-spacing:.08em}}"
  ].join("");
  document.head.appendChild(style);

  var root = el("div");
  root.id = "relay-root";
  root.setAttribute("data-relay", "v4");
  var canvas = el("canvas");
  canvas.id = "relay-gl";
  var hud = el("div", "", [
    '<div id="relay-kicker">CARRIER LOCK</div>',
    '<div id="relay-title">RELAY</div>',
    '<div id="relay-sub">A LIVING KNOT · NOT A PICTURE OF ONE</div>',
    '<div id="relay-credit">relay // dropmoltbot</div>'
  ].join(""));
  hud.id = "relay-hud";
  var closeBtn = el("button");
  closeBtn.id = "relay-close";
  closeBtn.type = "button";
  closeBtn.textContent = "ESC DOCK";
  root.appendChild(canvas);
  root.appendChild(hud);
  root.appendChild(closeBtn);
  document.documentElement.appendChild(root);

  var tube = el("canvas");
  tube.id = "tube-gl";
  tube.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(tube);

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
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }

  var gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
  var glT = tube.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
  if (!gl) {
    root.remove();
    tube.remove();
    return;
  }

  var VS = "attribute vec3 aPos;uniform mat4 uMVP;uniform float uShift;void main(){vec4 p=uMVP*vec4(aPos,1.0);p.x+=uShift*p.w;gl_Position=p;gl_PointSize=2.2;}";
  var FS = "precision mediump float;uniform vec3 uColor;uniform float uAlpha;void main(){gl_FragColor=vec4(uColor,uAlpha);}";
  var prog = program(gl, VS, FS);
  if (!prog) { root.remove(); tube.remove(); return; }

  var loc = {
    mvp: gl.getUniformLocation(prog, "uMVP"),
    shift: gl.getUniformLocation(prog, "uShift"),
    color: gl.getUniformLocation(prog, "uColor"),
    alpha: gl.getUniformLocation(prog, "uAlpha")
  };

  function knot(segs) {
    var R = 1.15, r = 0.38, p = 2, q = 3, out = [];
    for (var i = 0; i <= segs; i++) {
      var t = (i / segs) * Math.PI * 2;
      var pt = p * t, qt = q * t;
      out.push((R + r * Math.cos(qt)) * Math.cos(pt), r * Math.sin(qt), (R + r * Math.cos(qt)) * Math.sin(pt));
    }
    return new Float32Array(out);
  }
  function stars(n) {
    var o = [];
    for (var i = 0; i < n; i++) {
      var th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), rad = 2.4 + Math.random() * 1.6;
      o.push(rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph) * 0.55, rad * Math.sin(ph) * Math.sin(th));
    }
    return new Float32Array(o);
  }
  var knotBuf = gl.createBuffer();
  var knotData = knot(REDUCE ? 220 : 480);
  gl.bindBuffer(gl.ARRAY_BUFFER, knotBuf);
  gl.bufferData(gl.ARRAY_BUFFER, knotData, gl.STATIC_DRAW);
  var starBuf = gl.createBuffer();
  var starData = stars(REDUCE ? 40 : 90);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
  gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function persp(aspect) {
    var t = 1 / Math.tan(0.62);
    var n = 0.1, f = 40;
    return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
  }
  function view(yaw, pitch, dist) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var x = dist * cp * sy, y = dist * sp, z = dist * cp * cy;
    var fx = -x, fy = -y, fz = -z, fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    var rx = fz, ry = 0, rz = -fx, rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    var ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    return new Float32Array([rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0, -(rx * x + ry * y + rz * z), -(ux * x + uy * y + uz * z), fx * x + fy * y + fz * z, 1]);
  }

  var mx = 0.5, my = 0.42;
  root.addEventListener("pointermove", function (e) {
    var r = root.getBoundingClientRect();
    mx = (e.clientX - r.left) / Math.max(1, r.width);
    my = (e.clientY - r.top) / Math.max(1, r.height);
  });

  function resize(c, g) {
    var dpr = 1;
    var w = Math.max(2, c.clientWidth), h = Math.max(2, c.clientHeight);
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
      g.viewport(0, 0, c.width, c.height);
    }
    return c.width / c.height;
  }

  function drawKnot(aspect, time) {
    resize(canvas, gl);
    var power = Math.min(1, (time - 0.15) / 0.7);
    if (power < 0) power = 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.008, 0.02, 0.01, open ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(prog);
    var yaw = time * 0.35 + (mx - 0.5) * 0.7;
    var pitch = 0.35 + (0.5 - my) * 0.45;
    var dist = open ? (aspect < 0.9 ? 7.2 : 4.1) : 3.4;
    var mvp = mul(persp(aspect || 1), view(yaw, pitch, dist));
    if (power < 1 && open) {
      mvp = mul(new Float32Array([1, 0, 0, 0, 0, Math.max(0.012, power), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), mvp);
    }
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(loc.shift, 0);
    gl.uniform3f(loc.color, 0.15, 0.45, 0.22);
    gl.uniform1f(loc.alpha, open ? 0.35 : 0.2);
    gl.drawArrays(gl.POINTS, 0, starData.length / 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, knotBuf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var passes = [
      [0.004, 0.95, 0.25, 0.12, 0.22],
      [-0.004, 0.15, 0.85, 0.35, 0.28],
      [0, 0.05, 1, 0.28, 0.85],
      [0.0015, 1, 0.55, 0.12, 0.35]
    ];
    for (var i = 0; i < passes.length; i++) {
      gl.uniform1f(loc.shift, passes[i][0]);
      gl.uniform3f(loc.color, passes[i][1], passes[i][2], passes[i][3]);
      gl.uniform1f(loc.alpha, passes[i][4] * (0.35 + power * 0.65));
      gl.drawArrays(gl.LINE_STRIP, 0, knotData.length / 3);
    }
  }

  var tubeProg = null;
  if (glT) {
    tubeProg = program(glT,
      "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}",
      "precision mediump float;uniform vec2 uRes;uniform float uTime;void main(){vec2 uv=gl_FragCoord.xy/uRes;float scan=0.55+0.45*sin(gl_FragCoord.y*1.45);float grille=0.82+0.18*sin(gl_FragCoord.x*2.4);float vig=smoothstep(1.2,0.28,length((uv-0.5)*vec2(1.15,1.25)));float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+uTime*33.0)*43758.5453);float beam=smoothstep(0.012,0.0,abs(uv.y-fract(uTime*0.07)));vec3 col=vec3(0.05,0.72,0.28)*(0.08+scan*0.22)*grille*vig;col+=vec3(0.25,1.0,0.45)*beam*0.12;col+=(n-0.5)*0.05;gl_FragColor=vec4(col,0.62);}"
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
    glT.viewport(0, 0, tube.width, tube.height);
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

  function dock() {
    open = false;
    root.classList.add("dock");
    root.setAttribute("aria-label", "Open relay");
  }
  function expand() {
    open = true;
    root.classList.remove("dock");
    arm();
    chirp();
  }
  window.openRelay = expand;
  window.dockRelay = dock;

  closeBtn.addEventListener("click", function (e) { e.stopPropagation(); dock(); });
  root.addEventListener("click", function () { if (!open) expand(); });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open && root.isConnected && !root.classList.contains("dock")) {
      e.stopImmediatePropagation();
      dock();
    }
  }, true);

  function arm() {
    if (audioArmed) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    audioArmed = true;
    var filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    var gain = actx.createGain();
    gain.gain.value = 0.012;
    filter.connect(gain);
    gain.connect(actx.destination);
    var a = actx.createOscillator();
    a.type = "sawtooth";
    a.frequency.value = 44;
    var b = actx.createOscillator();
    b.type = "sine";
    b.frequency.value = 88;
    a.connect(filter);
    b.connect(filter);
    a.start();
    b.start();
    window.addEventListener("relay-open", function () {
      var now = actx.currentTime;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(240, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
      filter.frequency.exponentialRampToValueAtTime(260, now + 1.1);
    });
  }
  function chirp() {
    window.dispatchEvent(new Event("relay-open"));
    if (!actx) return;
    var now = actx.currentTime;
    [220, 330, 494].forEach(function (f, i) {
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.02 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      o.connect(g);
      g.connect(actx.destination);
      o.start(now);
      o.stop(now + 0.5);
    });
  }
  document.addEventListener("pointerdown", arm, { once: true });

  var chip = document.getElementById("relay-chip");
  if (chip) chip.addEventListener("click", function () { expand(); });

  var frames = 0;
  function frame(now) {
    if (dead) return;
    frames++;
    var time = (now - t0) / 1000;
    if (!HOLD && open && time > 4.2 && !root.classList.contains("dock")) dock();
    if (document.hidden) { requestAnimationFrame(frame); return; }
    var aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    if (!REDUCE || frames % 2 === 0) drawKnot(aspect, time);
    if (frames % 2 === 0) drawTube(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setTimeout(function () {
    if (open && !HOLD) dock();
  }, 6200);
})();
