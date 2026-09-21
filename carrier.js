/* CARRIER — one clock, one stack, one pointer. Public copy is English. */
(function () {
  "use strict";
  var Z = { noise: 8, film: 18, tube: 22, membrane: 26, sigil: 40, boot: 70, theater: 200, field: 320, flash: 400 };
  var layers = {};
  var actx = null;
  var phase = 0;
  var t0 = performance.now();
  var seal = { x: 0, y: 0 };
  var wrap = null;
  var membrane = null;
  var gl = null;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function topLayer() {
    var best = null;
    Object.keys(layers).forEach(function (k) {
      var L = layers[k];
      if (!L || !L.keys) return;
      if (!best || L.z > best.z) best = L;
    });
    return best;
  }

  function claim(name, spec) {
    spec = spec || {};
    var z = spec.z != null ? spec.z : (Z[name] || 1);
    var L = layers[name] || {};
    L.name = name;
    L.z = z;
    L.keys = !!spec.keys;
    L.onEsc = spec.onEsc || null;
    L.onKey = spec.onKey || null;
    L.tick = spec.tick || null;
    layers[name] = L;
    if (spec.el) spec.el.style.zIndex = String(z);
    return L;
  }
  function release(name) {
    var L = layers[name];
    if (!L) return;
    L.keys = false;
    L.onEsc = null;
    L.onKey = null;
  }
  function audio(arm) {
    if (actx) {
      if (arm && actx.state === "suspended") actx.resume();
      return actx;
    }
    if (!arm) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    return actx;
  }

  window.addEventListener("keydown", function (e) {
    var L = topLayer();
    if (!L) return;
    if (e.key === "Escape" && L.onEsc) {
      e.preventDefault();
      e.stopImmediatePropagation();
      L.onEsc();
      return;
    }
    if (L.onKey) L.onKey(e);
  }, true);

  document.addEventListener("pointerdown", function () { audio(true); }, { once: true });

  var style = document.createElement("style");
  style.textContent = [
    "#carrier-membrane{position:fixed;top:0;left:0;width:100vw;height:100dvh;height:100vh;z-index:26;pointer-events:none}",
    "#carrier-mark{position:fixed;z-index:27;pointer-events:none;font:10px \"JetBrains Mono\",ui-monospace,monospace;letter-spacing:.42em;color:rgba(109,255,138,.45)}"
  ].join("");
  document.head.appendChild(style);

  membrane = document.createElement("canvas");
  membrane.id = "carrier-membrane";
  membrane.setAttribute("aria-hidden", "true");
  var mark = document.createElement("div");
  mark.id = "carrier-mark";
  mark.textContent = "SPECIMEN";
  document.body.appendChild(membrane);
  document.body.appendChild(mark);
  gl = membrane.getContext("2d");

  function resize() {
    var w = Math.max(2, window.innerWidth);
    var h = Math.max(2, window.innerHeight);
    if (membrane.width !== w || membrane.height !== h) {
      membrane.width = w;
      membrane.height = h;
    }
  }

  function glyph(ctx, x, y, s, seed, ph) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(seed * 2.1 + ph * 0.08);
    ctx.beginPath();
    var n = 5;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * 6.28318 + seed;
      var r0 = s * (0.15 + (i % 2) * 0.1);
      var r1 = s * (0.55 + Math.sin(seed * 3 + i) * 0.25);
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a + 1.9) * r1, Math.sin(a + 0.7) * r1);
    }
    ctx.stroke();
    ctx.restore();
  }

  function aperture(rect, ph) {
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var rx = rect.width / 2 + 46;
    var ry = rect.height / 2 + 46;
    var pts = [];
    var sides = 7;
    for (var i = 0; i < sides; i++) {
      var a = -Math.PI / 2 + (i / sides) * Math.PI * 2 + Math.sin(ph * 0.15) * 0.015;
      var wob = 1 + Math.sin(ph * 0.4 + i) * 0.012;
      pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob * 0.98]);
    }
    return pts;
  }

  function hideMembrane(on) {
    membrane.style.display = on ? "none" : "block";
    mark.style.display = on ? "none" : "block";
    if (wrap && on) wrap.style.clipPath = "";
  }

  function draw() {
    if (membrane) membrane.style.display = "none";
    if (mark) mark.style.display = "none";
    if (wrap) wrap.style.clipPath = "";
  }

  function frame(now) {
    phase = (now - t0) / 1000;
    if (!document.hidden && !reduced) draw(phase);
    else if (!document.hidden && Math.floor(phase * 8) % 2 === 0) draw(phase);
    Object.keys(layers).forEach(function (k) {
      if (layers[k].tick) layers[k].tick(phase);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.CARRIER = {
    z: Z,
    phase: function () { return phase; },
    claim: claim,
    release: release,
    audio: audio,
    seal: function () { return seal; },
    top: topLayer
  };
})();
