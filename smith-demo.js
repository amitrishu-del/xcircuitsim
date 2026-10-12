// Interactive Smith chart: a 13.56 MHz L-match into a plasma-like load (5 Ω + 117 pF sheath).
// The same matching path Xcircuitsim draws: load (orange) -> series Ltune -> shunt Cload -> generator (green).
(() => {
  "use strict";
  const canvas = document.getElementById("smith");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const Z0 = 50, R_LOAD = 5, C_SHEATH = 117.4e-12, POWER = 100;
  const DESIGN = { f: 13.56e6, L: 1.35e-6, C: 704e-12 };
  const state = { f: DESIGN.f, L: DESIGN.L, C: DESIGN.C };

  // -- complex numbers -----------------------------------------------------------
  const c = (re, im = 0) => ({ re, im });
  const add = (a, b) => c(a.re + b.re, a.im + b.im);
  const sub = (a, b) => c(a.re - b.re, a.im - b.im);
  const mul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const inv = (a) => div(c(1), a);
  const abs = (a) => Math.hypot(a.re, a.im);
  const gamma = (z) => div(sub(z, c(Z0)), add(z, c(Z0)));

  // -- circuit --------------------------------------------------------------------
  function solve(f, L, C) {
    const w = 2 * Math.PI * f;
    const zl = c(R_LOAD, -1 / (w * C_SHEATH));      // plasma: bulk R + sheath capacitance
    const z1 = add(zl, c(0, w * L));                 // + series tune inductor
    const zin = inv(add(inv(z1), c(0, w * C)));      // || shunt load capacitor
    return { w, zl, z1, zin };
  }

  // -- formatting -----------------------------------------------------------------
  const si = (v, unit, digits = 3) => {
    const p = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];
    const a = Math.abs(v);
    for (const [s, n] of p) if (a >= s * 0.9995) return `${+(v / s).toPrecision(digits)} ${n}${unit}`;
    return `${+v.toPrecision(digits)} ${unit}`;
  };
  const zt = (z) => {
    const im = Math.abs(z.im) < 1e-9 * abs(z) ? 0 : z.im;
    return `${+z.re.toPrecision(4)} ${im < 0 ? "−" : "+"} j${+Math.abs(im).toPrecision(4)} Ω`;
  };

  // -- drawing ---------------------------------------------------------------------
  let size = 0, dpr = 1, colours = {};
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function readColours() {
    colours = {
      bg: css("--chart-bg"), grid: css("--chart-grid"), ygrid: css("--chart-ygrid"), rim: css("--chart-rim"),
      trace: css("--chart-trace"), series: css("--c-series"), shunt: css("--c-shunt"), load: css("--c-load"),
      gen: css("--c-gen"), target: css("--c-target"), ink: css("--ink"), faint: css("--faint"),
    };
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    size = rect.width;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    draw();
  }
  const R = () => size * 0.44;                       // chart radius in CSS px
  const P = (g) => [size / 2 + g.re * R(), size / 2 - g.im * R()];

  function circle(cx, cy, r) { ctx.beginPath(); ctx.arc(size / 2 + cx * R(), size / 2 - cy * R(), r * R(), 0, 2 * Math.PI); ctx.stroke(); }
  function clipToChart() { ctx.save(); ctx.beginPath(); ctx.arc(size / 2, size / 2, R(), 0, 2 * Math.PI); ctx.clip(); }

  function grid(mirror) {
    const s = mirror ? -1 : 1;
    for (const r of [0.2, 0.5, 1, 2, 5]) circle(s * r / (1 + r), 0, 1 / (1 + r));
    for (const x of [0.2, 0.5, 1, 2, 5]) for (const sign of [1, -1]) circle(s * 1, sign / x, 1 / x);
  }

  function curve(points, colour, width) {
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((g, i) => { const [x, y] = P(g); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  function arrow(g0, g1, colour) {
    const [x0, y0] = P(g0), [x1, y1] = P(g1), a = Math.atan2(y1 - y0, x1 - x0), h = 12;
    ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45));
    ctx.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }
  function dot(g, colour, r) {
    const [x, y] = P(g);
    ctx.fillStyle = colour; ctx.strokeStyle = colours.bg; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  }
  function badge(g, text, colour) {
    const [x, y] = P(g);
    ctx.fillStyle = colours.bg; ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = colour; ctx.font = "600 11px -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 0.5);
  }

  function draw() {
    if (!size) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // VSWR 1.5 target
    ctx.fillStyle = colours.target; ctx.beginPath(); ctx.arc(size / 2, size / 2, R() * 0.2, 0, 2 * Math.PI); ctx.fill();
    clipToChart();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); ctx.strokeStyle = colours.ygrid; grid(true);
    ctx.setLineDash([]); ctx.strokeStyle = colours.grid; grid(false);
    ctx.restore();
    ctx.strokeStyle = colours.rim; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, R(), 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size / 2 - R(), size / 2); ctx.lineTo(size / 2 + R(), size / 2); ctx.stroke();
    // grid labels
    ctx.fillStyle = colours.faint; ctx.font = "10px -apple-system, Segoe UI, sans-serif"; ctx.textAlign = "center";
    for (const r of [0.2, 0.5, 1, 2, 5]) { const [x, y] = P(c((r - 1) / (r + 1), 0)); ctx.fillText(String(r), x, y - 5); }

    // S11 over 5–25 MHz (the sweep), dimmed
    const sweep = [];
    for (let i = 0; i <= 400; i++) { const f = 5e6 + i * 20e6 / 400; sweep.push(gamma(solve(f, state.L, state.C).zin)); }
    ctx.globalAlpha = 0.45; curve(sweep, colours.trace, 1.6); ctx.globalAlpha = 1;

    // matching path at the chosen frequency
    const s = solve(state.f, state.L, state.C);
    const N = 80, seriesArc = [], shuntArc = [];
    for (let i = 0; i <= N; i++) seriesArc.push(gamma(add(s.zl, c(0, s.w * state.L * i / N))));
    const y1 = inv(s.z1);
    for (let i = 0; i <= N; i++) shuntArc.push(gamma(inv(add(y1, c(0, s.w * state.C * i / N)))));
    curve(seriesArc, colours.series, 2.6);
    curve(shuntArc, colours.shunt, 2.6);
    arrow(seriesArc[48], seriesArc[50], colours.series);
    arrow(shuntArc[52], shuntArc[54], colours.shunt);
    badge(seriesArc[25], "1", colours.series);
    badge(shuntArc[30], "2", colours.shunt);
    dot(gamma(s.z1), colours.ink, 3.5);
    dot(gamma(s.zl), colours.load, 7);
    dot(gamma(s.zin), colours.gen, 7);
    readout(s);
  }

  function readout(s) {
    const g = gamma(s.zin), m = abs(g);
    const vswr = m < 1 ? (1 + m) / (1 - m) : Infinity;
    $("v-f").textContent = si(state.f, "Hz", 4);
    $("v-L").textContent = si(state.L, "H", 3);
    $("v-C").textContent = si(state.C, "F", 3);
    $("r-load").textContent = zt(s.zl);
    $("r-1x").textContent = `+j${(s.w * state.L).toFixed(1)} Ω`;
    $("r-1").textContent = `→ ${zt(s.z1)}`;
    $("r-2x").textContent = `−j${(1 / (s.w * state.C)).toFixed(2)} Ω (shunt)`;
    $("r-2").textContent = `→ ${zt(s.zin)}`;
    $("r-gen").textContent = zt(s.zin);
    $("r-vswr").textContent = vswr.toFixed(2);
    $("r-rl").textContent = `${(-20 * Math.log10(Math.max(m, 1e-12))).toFixed(1)} dB`;
    $("r-refl").textContent = `${si(m * m * POWER, "W", 3)} of ${POWER} W`;
  }

  // -- controls -----------------------------------------------------------------------
  const sliders = {
    f: { el: $("s-f"), from: (t) => 10e6 + t * 7e6, to: (v) => (v - 10e6) / 7e6 },
    L: { el: $("s-L"), from: (t) => DESIGN.L * (0.5 + t), to: (v) => v / DESIGN.L - 0.5 },
    C: { el: $("s-C"), from: (t) => DESIGN.C * (0.5 + t), to: (v) => v / DESIGN.C - 0.5 },
  };
  for (const [key, s] of Object.entries(sliders)) {
    s.el.value = Math.round(s.to(state[key]) * 1000);
    s.el.addEventListener("input", () => { state[key] = s.from(s.el.value / 1000); draw(); });
  }
  $("demo-reset").addEventListener("click", () => {
    Object.assign(state, DESIGN);
    for (const [key, s] of Object.entries(sliders)) s.el.value = Math.round(s.to(state[key]) * 1000);
    draw();
  });

  readColours();
  new ResizeObserver(resize).observe(canvas);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColours(); draw(); });
})();

// Click a screenshot to see it large.
(() => {
  const box = document.getElementById("lightbox");
  if (!box || !box.showModal) return;
  const img = box.querySelector("img");
  document.querySelectorAll("[data-zoom]").forEach((el) => el.addEventListener("click", () => {
    const pic = el.querySelector("img");
    img.src = pic.currentSrc || pic.src;
    img.alt = pic.alt;
    box.showModal();
  }));
  box.addEventListener("click", () => box.close());
})();
