"use strict";

/* ===== Configuración de los libros ===== */
const BOOKS = {
  livre: {
    id: "livre",
    label: "Livre",
    name: "Édito A1 · Livre",
    edition: "2ᵉ édition (2022)",
    pages: 193,
    firstPage: 11,
    pageBase: "assets/pages/livre",
    audioBase: "audio/livre",
    audioData: "data/livre_audio.json",
    tocData: "data/livre_toc.json",
    audioMapUrl: "data/livre_audio_files.json",
    labelsData: "data/livre_page_labels.json",
  },
  cahier: {
    id: "cahier",
    label: "Cahier",
    name: "Édito A1 · Cahier",
    edition: "2ᵉ édition (2022)",
    pages: 145,
    firstPage: 3,
    pageBase: "assets/pages/cahier",
    audioBase: "audio/cahier",
    audioData: "data/cahier_audio.json",
    tocData: "data/cahier_toc.json",
    audioMapUrl: "data/cahier_audio_files.json",
    labelsData: "data/cahier_page_labels.json",
  },
};

/* ===== Estado ===== */
const state = {
  book: "livre",
  page: BOOKS.livre.firstPage,
  scale: 1,
  pageByBook: { livre: BOOKS.livre.firstPage, cahier: BOOKS.cahier.firstPage },  // última página por libro
  scaleByBook: { livre: 1, cahier: 1 },                                           // último zoom por libro
  markers: [],          // marcadores de la página actual
  currentTrack: null,   // pista en reproducción
  toc: [],
  markersData: [],
  audioMap: {},         // track -> filename
  pageLabels: {},       // página -> referencia de texto
  annotating: false,    // modo anotación activo
  tool: "marker",       // "marker" | "text" | "erase"
  markerColor: "#ffeb3b",
  markerSize: 0.02,     // grosor como fracción de la altura de página
  textColor: "#e53935",
  textSize: 0.032,      // fuente como fracción del ancho de página
  annotations: [],      // anotaciones de la página actual
};

const book = () => BOOKS[state.book];

/* ===== Elementos DOM ===== */
const $ = (id) => document.getElementById(id);
const el = {
  pageImg: $("page-img"),
  pageWrap: $("page-wrap"),
  pageStage: $("page-stage"),
  viewer: $("viewer"),
  overlay: $("audio-overlay"),
  tocList: $("toc-list"),
  sidebar: $("sidebar"),
  pageInput: $("page-input"),
  pageTotal: $("page-total"),
  audioCount: $("audio-count"),
  bookSwitcher: $("book-switcher"),
  bookSubtitle: $("book-subtitle"),
  player: $("player"),
  btnPlay: $("btn-play"),
  trackBadge: $("track-badge"),
  trackLabel: $("track-label"),
  trackSub: $("track-sub"),
  seek: $("seek"),
  timeCur: $("time-cur"),
  timeDur: $("time-dur"),
  transcript: $("transcript"),
  transcriptTitle: $("transcript-title"),
  transcriptBody: $("transcript-body"),
  toast: $("toast"),
  annoCanvas: $("anno-canvas"),
  annoTexts: $("anno-texts"),
  annoBar: $("anno-bar"),
};

const audio = new Audio();
audio.preload = "none";

/* ===== Utilidades ===== */
function pad3(n) { return String(n).padStart(3, "0"); }

let toastTimer = null;
function toast(msg, ms = 2600) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, ms);
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ===== Carga de datos ===== */
async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} para ${url}`);
  return r.json();
}

async function loadData() {
  const b = book();
  state.toc = await loadJSON(b.tocData).catch(() => []);
  state.markersData = await loadJSON(b.audioData).catch(() => []);
  state.audioMap = await loadJSON(b.audioMapUrl).catch(() => ({}));
  state.pageLabels = await loadJSON(b.labelsData).catch(() => ({}));
}

/* ===== Índice de unidades (desplegable, con páginas) ===== */
function renderToc() {
  el.tocList.innerHTML = "";
  state.toc.forEach((u) => {
    const li = document.createElement("li");
    li.className = "unit";

    const header = document.createElement("div");
    header.className = "unit-btn";
    header.innerHTML = `<span class="unit-num">${u.num === 11 || u.num === 12 ? "＋" : u.num}</span>
                        <span class="unit-title">${escapeHtml(u.title)}</span>
                        <span class="unit-pages">${u.start}–${u.end}</span>`;
    header.addEventListener("click", () => goToPage(u.start)); // clic en el título → ir a la unidad

    const chev = document.createElement("button");
    chev.className = "unit-chev-btn";
    chev.textContent = "▸";
    chev.title = "Desplegar/replegar";
    chev.addEventListener("click", (e) => { e.stopPropagation(); li.classList.toggle("open"); });
    header.appendChild(chev);
    li.appendChild(header);

    // sub-lista de páginas (acceso directo)
    const list = document.createElement("ul");
    list.className = "unit-pages-list";
    for (let p = u.start; p <= u.end; p++) {
      const tracks = state.markersData.filter((m) => m.page === p);
      const pageLi = document.createElement("li");
      const pb = document.createElement("button");
      pb.className = "page-btn";
      pb.dataset.page = p;
      const label = state.pageLabels[p] || "";
      pb.innerHTML = `<span class="pg">${p}</span>` +
        (label ? `<span class="pg-label">${escapeHtml(label)}</span>` : "") +
        (tracks.length ? `<span class="pg-audio">🎧 ${tracks.length}</span>` : "");
      pb.title = tracks.length
        ? tracks.map((t) => `Pista ${t.track} · ${t.title}`).join("\n")
        : `Página ${p}`;
      pb.addEventListener("click", () => goToPage(p));
      pageLi.appendChild(pb);
      list.appendChild(pageLi);
    }
    li.appendChild(list);
    el.tocList.appendChild(li);
  });
}

function highlightToc() {
  const units = el.tocList.querySelectorAll(".unit");
  units.forEach((u) => {
    const header = u.querySelector(".unit-btn");
    const txt = header.querySelector(".unit-pages").textContent;
    const m = txt.match(/(\d+)–(\d+)/);
    if (!m) return;
    const [a, z] = [Number(m[1]), Number(m[2])];
    const active = state.page >= a && state.page <= z;
    header.classList.toggle("active", active);
    u.classList.toggle("open", active); // desplegar la unidad actual
    u.querySelectorAll(".page-btn").forEach((pb) => {
      pb.classList.toggle("active", Number(pb.dataset.page) === state.page);
    });
  });
}

/* ===== Render de página ===== */
function renderPage() {
  const b = book();
  el.pageImg.src = `${b.pageBase}/page-${pad3(state.page)}.webp`;
  el.pageInput.value = state.page;
  el.pageTotal.textContent = `/ ${b.pages}`;
  el.pageInput.max = b.pages;
  renderMarkers();
  loadAnnotations();
  renderAnnotations();
  highlightToc();
  el.viewer.scrollTo({ top: 0, left: 0 });
}

function renderMarkers() {
  el.overlay.innerHTML = "";
  state.markers = [];
  const list = state.markersData.filter((m) => m.page === state.page);
  if (el.audioCount) {
    el.audioCount.textContent = list.length ? `🎧 ${list.length} audio${list.length > 1 ? "s" : ""}` : "";
    el.audioCount.title = list.length ? `${list.length} audio(s) en esta página` : "Sin audios en esta página";
  }
  list.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "audio-marker";
    const PAD = 1.35; // zona clicable un poco mayor que el pictograma
    btn.style.left = `${m.x * 100}%`;
    btn.style.top = `${m.y * 100}%`;
    btn.style.width = `${m.w * 100 * PAD}%`;
    btn.style.height = `${m.h * 100 * PAD}%`;
    btn.title = `Pista ${m.track} · ${m.title}`;
    btn.setAttribute("aria-label", `Reproducir pista ${m.track}: ${m.title}`);
    btn.addEventListener("click", () => playTrack(m.track));
    el.overlay.appendChild(btn);
    state.markers.push({ ...m, el: btn });
  });
}

/* ===== Navegación ===== */
function goToPage(p) {
  p = Math.max(1, Math.min(book().pages, p));
  state.page = p;
  state.pageByBook[state.book] = p;   // recordar ubicación en este libro
  if (isMobile()) el.sidebar.classList.add("closed"); // cerrar el menú al elegir página en móvil
  renderPage();
}

function isMobile() {
  return !!(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
}

/* ===== Zoom ===== */
function fitWidth() {
  return Math.max(200, el.viewer.clientWidth - 48);
}
function applyScale() {
  el.pageImg.style.width = `${fitWidth() * state.scale}px`;
  el.pageImg.style.height = "auto";
  requestAnimationFrame(renderAnnotations);
}
function zoomIn() { state.scale = Math.min(6, state.scale * 1.25); applyScale(); }
function zoomOut() { state.scale = Math.max(0.35, state.scale / 1.25); applyScale(); }
function zoomFit() { state.scale = 1; applyScale(); }

/* ===== Resolución de audio ===== */
function resolveAudioUrl(track) {
  const b = book();
  // Devuelve SIEMPRE un array de candidatos (aunque solo haya uno).
  if (state.audioMap[track]) {
    return [`${b.audioBase}/${state.audioMap[track]}`];
  }
  const p2 = String(track).padStart(2, "0");
  const p3 = pad3(track);
  const guesses = [
    `${p3}.mp3`, `${p2}.mp3`, `${track}.mp3`,
    `${p3}.m4a`, `${p2}.m4a`, `${track}.m4a`,
    `${p3}.wav`, `${p3}.ogg`,
  ];
  return guesses.map((g) => `${b.audioBase}/${g}`);
}

function trackInfo(track) {
  return state.markersData.find((m) => m.track === track) || null;
}

/* ===== Reproducción ===== */
function playTrack(track) {
  state.currentTrack = track;
  const info = trackInfo(track);

  state.markers.forEach((m) => m.el.classList.toggle("playing", m.track === track));

  el.trackBadge.textContent = `Pista ${track}`;
  el.trackLabel.textContent = info ? info.title : "Audio";
  el.trackSub.textContent = info
    ? `${info.unit_title} · p. ${info.page}`
    : `página ${state.page}`;

  const srcs = resolveAudioUrl(track);
  tryPlay(Array.isArray(srcs) ? srcs : [srcs], 0, track);
}

function tryPlay(srcs, idx, track) {
  if (idx >= srcs.length) {
    toast(`No se encontró el audio de la pista ${track} en ${book().audioBase}/`);
    el.player.hidden = true;
    return;
  }
  const url = srcs[idx];
  let advanced = false;
  const next = () => { if (!advanced) { advanced = true; tryPlay(srcs, idx + 1, track); } };
  audio.onerror = () => { audio.onerror = null; next(); };
  audio.src = url;
  audio.play().then(() => {
    audio.onerror = null;
    el.player.hidden = false;
    el.btnPlay.textContent = "⏸";
    el.timeDur.textContent = fmtTime(audio.duration || 0);
  }).catch((err) => {
    console.warn("play falló:", url, err && err.message);
    next();
  });
}

function togglePlay() {
  if (audio.paused) {
    audio.play().catch((e) => console.warn(e));
  } else {
    audio.pause();
  }
}

function stopAudio() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  el.player.hidden = true;
  state.currentTrack = null;
}

/* ===== Cambio de libro ===== */
function renderBookSwitcher() {
  el.bookSwitcher.innerHTML = "";
  Object.values(BOOKS).forEach((b) => {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.classList.toggle("active", b.id === state.book);
    btn.addEventListener("click", () => switchBook(b.id));
    el.bookSwitcher.appendChild(btn);
  });
}

async function switchBook(id) {
  if (id === state.book) return;
  stopAudio();
  // guardar la ubicación actual antes de cambiar
  state.pageByBook[state.book] = state.page;
  state.scaleByBook[state.book] = state.scale;
  state.book = id;
  // restaurar la ubicación guardada del libro destino
  state.page = state.pageByBook[state.book] ?? book().firstPage;
  state.scale = state.scaleByBook[state.book] ?? 1;
  state.currentTrack = null;
  el.bookSubtitle.textContent = `${book().label} · 2ᵉ édition`;
  renderBookSwitcher();
  await loadData();
  renderToc();
  renderPage();
  applyScale();
}

/* ===== Eventos ===== */
function bindEvents() {
  $("btn-prev").addEventListener("click", () => goToPage(state.page - 1));
  $("btn-next").addEventListener("click", () => goToPage(state.page + 1));
  $("nav-prev").addEventListener("click", () => goToPage(state.page - 1));
  $("nav-next").addEventListener("click", () => goToPage(state.page + 1));
  $("btn-sidebar").addEventListener("click", () => el.sidebar.classList.toggle("closed"));
  $("btn-zoom-in").addEventListener("click", zoomIn);
  $("btn-zoom-out").addEventListener("click", zoomOut);
  $("btn-fit").addEventListener("click", zoomFit);
  $("btn-show-audio").addEventListener("click", () => {
    document.body.classList.toggle("hide-audio");
    $("btn-show-audio").classList.toggle("active");
  });

  el.pageInput.addEventListener("change", () => {
    const v = parseInt(el.pageInput.value, 10);
    if (v >= 1 && v <= book().pages) goToPage(v);
    else el.pageInput.value = state.page;
  });

  el.btnPlay.addEventListener("click", togglePlay);
  el.seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (el.seek.value / 1000) * audio.duration;
  });

  $("btn-transcript").addEventListener("click", toggleTranscript);
  $("btn-transcript-close").addEventListener("click", () => { el.transcript.hidden = true; });

  audio.addEventListener("timeupdate", () => {
    el.timeCur.textContent = fmtTime(audio.currentTime);
    if (audio.duration) {
      el.seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
      el.timeDur.textContent = fmtTime(audio.duration);
    }
  });
  audio.addEventListener("ended", () => { el.btnPlay.textContent = "▶"; });
  audio.addEventListener("play", () => { el.btnPlay.textContent = "⏸"; });
  audio.addEventListener("pause", () => { el.btnPlay.textContent = "▶"; });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowRight") goToPage(state.page + 1);
    else if (e.key === "ArrowLeft") goToPage(state.page - 1);
    else if (e.key === " ") { e.preventDefault(); togglePlay(); }
  });

  window.addEventListener("resize", applyScale);

  bindAnnotationEvents();
  el.pageImg.addEventListener("load", () => renderAnnotations());
}

function toggleTranscript() {
  const info = trackInfo(state.currentTrack);
  if (!info) { toast("Ninguna pista seleccionada."); return; }
  if (el.transcript.hidden) {
    el.transcriptTitle.textContent = `Pista ${info.track} · p. ${info.page}`;
    el.transcriptBody.textContent = info.transcription || "(sin transcripción)";
    el.transcript.hidden = false;
  } else {
    el.transcript.hidden = true;
  }
}

/* ===== Anotaciones (texto + marcador) ===== */
function annoKey() { return `editoA1.annotations.${state.book}.${state.page}`; }

function loadAnnotations() {
  try { state.annotations = JSON.parse(localStorage.getItem(annoKey()) || "[]"); }
  catch { state.annotations = []; }
  if (!Array.isArray(state.annotations)) state.annotations = [];
}

function saveAnnotations() {
  try { localStorage.setItem(annoKey(), JSON.stringify(state.annotations)); } catch {}
}

function pageFrac(e) {
  const r = el.pageWrap.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  };
}

function renderAnnotations() {
  // trazos (marcador) en canvas
  const c = el.annoCanvas;
  const w = el.pageWrap.clientWidth || 1;
  const h = el.pageWrap.clientHeight || 1;
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  state.annotations.forEach((a) => {
    if (a.type !== "stroke" || !a.pts || a.pts.length < 2) return;
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = a.color || state.markerColor;
    ctx.lineWidth = (a.size || state.markerSize) * h;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    a.pts.forEach((p, i) => {
      const x = p[0] * w, y = p[1] * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  renderTexts();
}

function renderTexts() {
  el.annoTexts.innerHTML = "";
  const pageW = el.pageWrap.clientWidth || 1;
  state.annotations.forEach((a, i) => {
    if (a.type !== "text") return;
    el.annoTexts.appendChild(buildTextEl(a, i, pageW));
  });
}

function buildTextEl(a, i, pageW) {
  const d = document.createElement("div");
  d.className = "anno-text";
  d.dataset.index = i;
  d.style.left = `${a.x * 100}%`;
  d.style.top = `${a.y * 100}%`;
  d.style.width = `${(a.w || 0.25) * 100}%`;
  d.style.fontSize = `${(a.size || state.textSize) * pageW}px`;
  d.style.color = a.color || state.textColor;

  const mv = document.createElement("div");
  mv.className = "anno-move";
  mv.textContent = "⋮⋮";
  const ct = document.createElement("div");
  ct.className = "anno-content";
  ct.contentEditable = "true";
  ct.textContent = a.text || "";
  const rz = document.createElement("div");
  rz.className = "anno-resize";
  rz.textContent = "◢";
  d.appendChild(mv); d.appendChild(ct); d.appendChild(rz);

  ct.addEventListener("input", () => { a.text = ct.textContent; saveAnnotations(); });

  // borrar con clic (modo borrador)
  d.addEventListener("click", (e) => {
    if (state.tool !== "erase") return;
    e.stopPropagation();
    state.annotations.splice(i, 1);
    saveAnnotations(); renderAnnotations();
  });

  // mover arrastrando la barra superior
  mv.addEventListener("pointerdown", (e) => {
    if (state.tool === "erase") return;
    e.preventDefault(); e.stopPropagation();
    mv.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const f = pageFrac(ev);
      a.x = f.x; a.y = f.y;
      d.style.left = `${a.x * 100}%`; d.style.top = `${a.y * 100}%`;
    };
    const up = () => {
      saveAnnotations();
      mv.removeEventListener("pointermove", move);
      mv.removeEventListener("pointerup", up);
    };
    mv.addEventListener("pointermove", move);
    mv.addEventListener("pointerup", up);
  });

  // redimensionar arrastrando la esquina
  rz.addEventListener("pointerdown", (e) => {
    if (state.tool === "erase") return;
    e.preventDefault(); e.stopPropagation();
    rz.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const f = pageFrac(ev);
      a.w = Math.max(0.06, f.x - a.x);
      d.style.width = `${a.w * 100}%`;
    };
    const up = () => {
      saveAnnotations();
      rz.removeEventListener("pointermove", move);
      rz.removeEventListener("pointerup", up);
    };
    rz.addEventListener("pointermove", move);
    rz.addEventListener("pointerup", up);
  });

  return d;
}

function setTool(tool) {
  state.tool = tool;
  document.body.classList.remove("tool-marker", "tool-text", "tool-erase");
  document.body.classList.add(`tool-${tool}`);
  document.querySelectorAll(".anno-tool.tool").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === tool));
}

function setAnnotating(on) {
  state.annotating = on;
  document.body.classList.toggle("annotating", on);
  el.annoBar.hidden = !on;
  $("btn-annotate").classList.toggle("active", on);
  if (on) setTool(state.tool || "marker");
}

function clearPageAnnotations() {
  state.annotations = [];
  saveAnnotations(); renderAnnotations();
}

function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
  return Math.sqrt(x * x + y * y);
}

function eraseStrokeAt(e) {
  const f = pageFrac(e);
  let best = -1, bestD = 0.03;
  state.annotations.forEach((a, i) => {
    if (a.type !== "stroke" || !a.pts) return;
    for (let j = 1; j < a.pts.length; j++) {
      const d = distToSeg([f.x, f.y], a.pts[j - 1], a.pts[j]);
      if (d < bestD) { bestD = d; best = i; }
    }
  });
  if (best >= 0) {
    state.annotations.splice(best, 1);
    saveAnnotations(); renderAnnotations();
  }
}

function bindAnnotationEvents() {
  $("btn-annotate").addEventListener("click", () => setAnnotating(!state.annotating));
  $("anno-done").addEventListener("click", () => setAnnotating(false));
  $("anno-marker").addEventListener("click", () => setTool("marker"));
  $("anno-text").addEventListener("click", () => setTool("text"));
  $("anno-erase").addEventListener("click", () => setTool("erase"));
  $("anno-clear").addEventListener("click", clearPageAnnotations);
  $("anno-color").addEventListener("input", (e) => {
    state.markerColor = e.target.value;
    state.textColor = e.target.value;
  });
  $("anno-size").addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    state.markerSize = 0.008 + v * 0.05;
    state.textSize = 0.015 + v * 0.06;
  });

  const c = el.annoCanvas;
  let cur = null;
  c.addEventListener("pointerdown", (e) => {
    if (!state.annotating) return;
    if (state.tool === "marker") {
      const f = pageFrac(e);
      cur = { type: "stroke", pts: [[f.x, f.y]], color: state.markerColor, size: state.markerSize };
      state.annotations.push(cur);
      c.setPointerCapture(e.pointerId);
      renderAnnotations();
    } else if (state.tool === "text") {
      const f = pageFrac(e);
      state.annotations.push({ type: "text", x: f.x, y: f.y, w: 0.25, text: "", color: state.textColor, size: state.textSize });
      saveAnnotations(); renderAnnotations();
      const last = el.annoTexts.querySelector(".anno-text:last-child .anno-content");
      if (last) last.focus();
    } else if (state.tool === "erase") {
      eraseStrokeAt(e);
    }
  });
  c.addEventListener("pointermove", (e) => {
    if (!state.annotating || state.tool !== "marker" || !cur) return;
    const f = pageFrac(e);
    cur.pts.push([f.x, f.y]);
    renderAnnotations();
  });
  c.addEventListener("pointerup", () => { if (cur) { saveAnnotations(); cur = null; } });
  c.addEventListener("pointercancel", () => { cur = null; });
}

/* ===== Inicio ===== */
async function init() {
  el.bookSubtitle.textContent = `${book().label} · 2ᵉ édition`;
  if (isMobile()) el.sidebar.classList.add("closed"); // menú cerrado por defecto en móvil
  renderBookSwitcher();
  await loadData();
  renderToc();
  renderPage();
  applyScale();
  bindEvents();
}

init();
