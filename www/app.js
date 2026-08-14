/* ============================================================
   ACTA DE PARTIDO v2
   Registro de jugadas por voz con doble reloj:
   minuto de partido  <->  minuto real del vídeo original.
   ============================================================ */
(function () {
"use strict";

/* ---------------- utilidades ---------------- */
var $ = function (id) { return document.getElementById(id); };
var pad = function (n) { return String(n).padStart(2, "0"); };
var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

function fmtMS(sec) {                       // 75:03
  sec = Math.max(0, Math.round(sec));
  return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
}
function fmtHMS(sec) {                      // 01:15:03
  sec = Math.max(0, Math.round(sec));
  return pad(Math.floor(sec / 3600)) + ":" + pad(Math.floor(sec / 60) % 60) + ":" + pad(sec % 60);
}
function fmtTC(sec, fps) {                  // 01:15:03:12
  sec = Math.max(0, sec);
  var whole = Math.floor(sec);
  var fr = Math.round((sec - whole) * fps);
  if (fr >= fps) { fr = 0; whole++; }
  return pad(Math.floor(whole / 3600)) + ":" + pad(Math.floor(whole / 60) % 60) + ":" +
         pad(whole % 60) + ":" + pad(fr);
}
/* acepta "12", "12:30", "1:05:20", "1h5m20s", "90s" */
function parseTime(str) {
  if (str == null) return null;
  str = String(str).trim().replace(",", ".");
  if (!str) return null;
  var m = str.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+(?:\.\d+)?)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) {
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  }
  var p = str.split(":").map(function (x) { return parseFloat(x); });
  if (p.some(isNaN)) return null;
  if (p.length === 1) return p[0] * 60;              // "12" = minuto 12
  if (p.length === 2) return p[0] * 60 + p[1];       // mm:ss
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return null;
}
function norm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
var NUM = { cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,
  diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,
  diecinueve:19,veinte:20,veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,
  veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,treinta:30,cuarenta:40,
  cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,cien:100,ciento:100 };
function words2num(s) {
  var t = norm(s).split(" "), n = null, i;
  for (i = 0; i < t.length; i++) {
    if (/^\d{1,3}$/.test(t[i])) { n = (n || 0) + parseInt(t[i], 10); continue; }
    if (t[i] === "y") continue;
    if (Object.prototype.hasOwnProperty.call(NUM, t[i])) n = (n || 0) + NUM[t[i]];
    else if (n !== null) break;
  }
  return (n !== null && n >= 0 && n <= 200) ? n : null;
}

/* ---------------- modelo ---------------- */
var DEFAULT_TAGS = [
  { id: "ataque",     label: "Ataque" },
  { id: "defensa",    label: "Defensa" },
  { id: "transicion", label: "Transición" },
  { id: "abp",        label: "Balón parado" },
  { id: "fisico",     label: "Físico" },
  { id: "gol",        label: "Gol" },
  { id: "ocasion",    label: "Ocasión" },
  { id: "perdida",    label: "Pérdida" },
  { id: "recuperacion", label: "Recuperación" },
  { id: "duelo",      label: "Duelo" },
  { id: "tarjeta",    label: "Tarjeta" },
  { id: "cambio",     label: "Cambio" },
  { id: "tactico",    label: "Táctico" }
];
var TAG_KEYS = {
  ataque: ["ataque","ataco","atacando","ofensiva","ofensivo","remate","centro","desmarque","asistencia","regate","finalizacion","area rival"],
  defensa: ["defensa","defiendo","defensivo","defensiva","marca","marcaje","achico","achicar","corte","cortar","despeje","despejo","entrada","cobertura","basculacion","achique","repliegue"],
  transicion: ["transicion","contra","contraataque","contragolpe","robo","segunda jugada","balance"],
  abp: ["corner","esquina","falta","penalti","penalty","saque de banda","saque de esquina","libre directo","balon parado","abp","barrera"],
  fisico: ["fisico","fisicamente","cansancio","cansado","fundido","sprint","esprint","ritmo","lesion","molestia","piernas","sin aire","llego justo"],
  gol: ["gol","goles","marcamos","marcan","empate","1 0","gol nuestro"],
  ocasion: ["ocasion","ocasiones","tiro","disparo","remate a puerta","mano a mano","palo","parada","paradon"],
  perdida: ["perdida","pierdo","perdemos","regalo","perdiendo el balon"],
  recuperacion: ["recuperacion","recupero","recuperamos","robo el balon","le quito"],
  duelo: ["duelo","dividida","uno contra uno","1 contra 1","salto","choque"],
  tarjeta: ["tarjeta","amarilla","roja","amonestacion","expulsion","expulsado"],
  cambio: ["cambio","sustitucion","entra","sale del campo","relevo"],
  tactico: ["tactico","tactica","sistema","estructura","linea","altura de la linea","posicionamiento","estructura de","salida de balon"]
};
var RATE_KEYS = {
  1:  ["bien","buena","bueno","acierto","acertado","correcto","perfecto","genial","muy bien","positivo","me gusta","limpio","brillante","excelente"],
  "-1": ["mal","mala","error","fallo","mejorable","tarde","lento","negativo","pierdo","me equivoco","no llego","flojo","dudo","precipito","regalo","desastre"]
};

function newMatch() {
  var d = new Date();
  return {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    home: { name: "Local", players: [] },
    away: { name: "Visitante", players: [] },
    competition: "",
    date: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
    periods: [
      { label: "1ª parte", durationMin: 45, videoStartSec: null, elapsedSec: 0, running: false, startedAt: null },
      { label: "2ª parte", durationMin: 45, videoStartSec: null, elapsedSec: 0, running: false, startedAt: null }
    ],
    activePeriod: 0,
    tags: DEFAULT_TAGS.slice(),
    events: []
  };
}
var DEFAULT_PREFS = { autoSave: true, wakeLock: true, beep: true, lang: "es-ES", fps: 25, csvSemicolon: true, micMode: "hold" };

/* ---------------- almacenamiento ---------------- */
var LS_MATCHES = "acta.v2.matches", LS_CUR = "acta.v2.current", LS_PREFS = "acta.v2.prefs";
var matches = [], match = null, prefs = Object.assign({}, DEFAULT_PREFS);

function loadAll() {
  try { matches = JSON.parse(localStorage.getItem(LS_MATCHES) || "[]") || []; } catch (e) { matches = []; }
  if (!Array.isArray(matches)) matches = [];
  matches = matches.filter(function (m) {
    if (!m || typeof m !== "object") return false;
    try { migrate(m); return true; } catch (e) { return false; }
  });
  try { prefs = Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(LS_PREFS) || "{}")); } catch (e) {}
  var cur = localStorage.getItem(LS_CUR);
  match = matches.filter(function (m) { return m.id === cur; })[0] || matches[0] || null;
  if (!match) { match = newMatch(); matches.push(match); }
}
/* Normaliza un partido cargado de localStorage o importado de un .json:
   completa campos que falten y descarta forma inválida en vez de dejar
   que rendered/exportaciones exploten más tarde con datos a medias. */
function migrate(m) {
  if (!m.periods || !m.periods.length) m.periods = newMatch().periods;
  m.periods.forEach(function (p) {
    if (typeof p.elapsedSec !== "number") p.elapsedSec = 0;
    p.running = false; p.startedAt = null;
    if (p.videoStartSec === undefined) p.videoStartSec = null;
    if (typeof p.durationMin !== "number" || p.durationMin <= 0) p.durationMin = 45;
    if (typeof p.label !== "string" || !p.label) p.label = "Parte";
  });
  if (typeof m.activePeriod !== "number" || !m.periods[m.activePeriod]) m.activePeriod = 0;
  if (!Array.isArray(m.tags) || !m.tags.length) m.tags = DEFAULT_TAGS.slice();
  if (!m.home || typeof m.home !== "object") m.home = { name: "Local", players: [] };
  if (!m.away || typeof m.away !== "object") m.away = { name: "Visitante", players: [] };
  if (!Array.isArray(m.home.players)) m.home.players = [];
  if (!Array.isArray(m.away.players)) m.away.players = [];
  if (typeof m.id !== "string" || !m.id) m.id = uid();
  if (!Array.isArray(m.events)) m.events = [];
  m.events = m.events.filter(function (e) { return e && typeof e === "object"; }).map(function (e) {
    return {
      id: (typeof e.id === "string" && e.id) ? e.id : uid(),
      p: (typeof e.p === "number" && m.periods[e.p]) ? e.p : 0,
      e: typeof e.e === "number" && e.e >= 0 ? e.e : 0,
      side: (e.side === "home" || e.side === "away") ? e.side : null,
      playerId: e.playerId || null,
      tags: Array.isArray(e.tags) ? e.tags : [],
      rating: (e.rating === 1 || e.rating === -1) ? e.rating : 0,
      note: typeof e.note === "string" && e.note ? e.note : "Marca",
      ts: typeof e.ts === "number" ? e.ts : Date.now()
    };
  });
}
var saveTimer = null;
function save(now) {
  match.updatedAt = Date.now();
  clearTimeout(saveTimer);
  var doIt = function () {
    try {
      localStorage.setItem(LS_MATCHES, JSON.stringify(matches));
      localStorage.setItem(LS_CUR, match.id);
      localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
    } catch (e) { toast("No se ha podido guardar: almacenamiento lleno"); }
  };
  if (now) doIt(); else saveTimer = setTimeout(doIt, 400);
}

/* ---------------- motor de tiempos ---------------- */
function periodBaseSec(i) {
  var s = 0;
  for (var k = 0; k < i && k < match.periods.length; k++) s += match.periods[k].durationMin * 60;
  return s;
}
function matchSecOf(ev) { return periodBaseSec(ev.p) + ev.e; }
function videoSecOf(ev) {
  var p = match.periods[ev.p];
  if (!p || p.videoStartSec == null) return null;
  return p.videoStartSec + ev.e;
}
/* etiqueta de minuto tipo 12'  /  45+2'  */
function minLabel(pi, e) {
  var p = match.periods[pi]; if (!p) return "?";
  var dur = p.durationMin * 60, base = periodBaseSec(pi);
  if (e > dur) {
    var extra = Math.max(1, Math.ceil((e - dur) / 60));
    return Math.round((base + dur) / 60) + "+" + extra + "'";
  }
  return (Math.floor((base + e) / 60) + 1) + "'";
}
/* conversión inversa: segundo de vídeo -> {p, e} */
function videoToPeriod(vs) {
  var best = null;
  match.periods.forEach(function (p, i) {
    if (p.videoStartSec != null && vs >= p.videoStartSec) {
      if (!best || p.videoStartSec > match.periods[best.p].videoStartSec) best = { p: i, e: vs - p.videoStartSec };
    }
  });
  if (best) return best;
  var first = null;
  match.periods.forEach(function (p, i) { if (first === null && p.videoStartSec != null) first = i; });
  return first === null ? null : { p: first, e: 0 };
}
/* minuto hablado ("minuto 23") -> parte + segundos dentro de esa parte.
   El minuto 23 abarca de 22:00 a 22:59, por eso se resta uno. */
function matchMinToPeriod(n) {
  var target = Math.max(0, (n - 1) * 60);
  for (var i = 0; i < match.periods.length; i++) {
    var base = periodBaseSec(i), dur = match.periods[i].durationMin * 60;
    if (target < base + dur || i === match.periods.length - 1) {
      return { p: i, e: Math.max(0, target - base) };
    }
  }
  return { p: 0, e: target };
}
function isSynced() { return match.periods.some(function (p) { return p.videoStartSec != null; }); }
function allSynced() { return match.periods.every(function (p) { return p.videoStartSec != null; }); }

/* ---------------- reloj ---------------- */
var tickTimer = null;
function activeP() { return match.periods[match.activePeriod]; }
function elapsedNow(p) {
  return p.elapsedSec + (p.running && p.startedAt ? (Date.now() - p.startedAt) / 1000 : 0);
}
function toggleClock() {
  var p = activeP();
  if (p.running) {
    p.elapsedSec = elapsedNow(p); p.running = false; p.startedAt = null;
    beep(440, 90);
  } else {
    p.running = true; p.startedAt = Date.now();
    beep(660, 90); requestWakeLock();
  }
  save(); paintClock(); renderPeriods();
}
function nudge(sec) {
  var p = activeP();
  p.elapsedSec = Math.max(0, elapsedNow(p) + sec);
  if (p.running) p.startedAt = Date.now();
  save(); paintClock();
}
/* congela el cronómetro de la parte activa del partido actual, sumando el
   tiempo real transcurrido a elapsedSec. Hay que llamarla siempre antes de
   cambiar de partido (match) o de parte, si no el tiempo corrido mientras
   estaba en marcha se pierde sin más. */
function pauseActivePeriod() {
  if (!match) return;
  var p = activeP();
  if (p.running) { p.elapsedSec = elapsedNow(p); p.running = false; p.startedAt = null; }
}
function setPeriod(i) {
  if (i === match.activePeriod) return;
  pauseActivePeriod();
  match.activePeriod = i;
  save(); paintClock(); renderPeriods(); renderCapture();
}
function paintClock() {
  var p = activeP(), e = elapsedNow(p);
  $("tbClock").textContent = fmtMS(periodBaseSec(match.activePeriod) + e);
  $("tbClock").classList.toggle("running", !!p.running);
  $("tbVideoClock").textContent = p.videoStartSec == null ? "--:--:--" : fmtHMS(p.videoStartSec + e);
  $("btnClock").innerHTML = p.running ? "&#10073;&#10073;" : "&#9654;";
  $("btnClock").classList.toggle("on", !!p.running);
}
tickTimer = setInterval(function () {
  if (match && activeP().running) paintClock();
}, 250);
setInterval(function () { if (match && activeP().running) save(); }, 10000);

var wakeLockRef = null;
function requestWakeLock() {
  if (!prefs.wakeLock || !navigator.wakeLock || wakeLockRef) return;
  navigator.wakeLock.request("screen").then(function (w) {
    wakeLockRef = w;
    w.addEventListener("release", function () { wakeLockRef = null; });
  }).catch(function () {});
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && match && activeP().running) requestWakeLock();
  /* en móvil (Safari/PWA sobre todo) "beforeunload" no siempre llega a
     tiempo si el sistema mata la app en segundo plano: forzamos guardado
     aquí para no perder la última jugada dictada. */
  if (document.visibilityState === "hidden" && match) save(true);
});
window.addEventListener("pagehide", function () { if (match) save(true); });

/* ---------------- sonido ---------------- */
var actx = null;
function beep(hz, ms) {
  if (!prefs.beep) return;
  try {
    var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    actx = actx || new C();
    if (actx.state === "suspended") actx.resume();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = hz;
    g.gain.setValueAtTime(0.09, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + ms / 1000);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + ms / 1000);
  } catch (e) {}
}
var toastTimer = null;
function toast(msg) {
  var t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}

/* ---------------- detección automática ---------------- */
function detectTags(raw) {
  var s = " " + norm(raw) + " ", found = [];
  Object.keys(TAG_KEYS).forEach(function (tid) {
    if (!match.tags.some(function (t) { return t.id === tid; })) return;
    for (var i = 0; i < TAG_KEYS[tid].length; i++) {
      if (s.indexOf(" " + TAG_KEYS[tid][i] + " ") > -1) { found.push(tid); return; }
    }
  });
  return found;
}
function detectRating(raw) {
  var s = " " + norm(raw) + " ", best = 0, bi = -1;
  [1, -1].forEach(function (r) {
    RATE_KEYS[r === 1 ? 1 : "-1"].forEach(function (k) {
      var p = s.lastIndexOf(" " + k + " ");
      if (p > bi) { bi = p; best = r; }
    });
  });
  return best;
}
function detectPlayer(raw) {
  var s = " " + norm(raw) + " ", hit = null;
  ["home", "away"].forEach(function (side) {
    match[side].players.forEach(function (pl) {
      var n = norm(pl.name);
      if (!hit && n.length >= 4 && s.indexOf(" " + n + " ") > -1) hit = { side: side, playerId: pl.id };
      var m = s.match(/\b(?:el |la |dorsal |numero )(\d{1,2})\b/);
      if (!hit && m && String(pl.num) === m[1]) hit = { side: side, playerId: pl.id };
    });
  });
  return hit;
}

/* ---------------- eventos ---------------- */
var ctx = { side: null, playerId: null };

function addEvent(text, elapsedOverride, periodOverride) {
  var pi = periodOverride == null ? match.activePeriod : periodOverride;
  var e = elapsedOverride == null ? elapsedNow(match.periods[pi]) : elapsedOverride;
  var det = detectPlayer(text || "");
  var ev = {
    id: uid(),
    p: pi,
    e: Math.max(0, Math.round(e)),
    side: ctx.side || (det ? det.side : null),
    playerId: ctx.playerId || (det ? det.playerId : null),
    tags: detectTags(text || ""),
    rating: detectRating(text || ""),
    note: (text || "Marca").trim(),
    ts: Date.now()
  };
  match.events.push(ev);
  save(); beep(880, 110);
  renderAll();
  return ev;
}
function delEvent(id) {
  match.events = match.events.filter(function (e) { return e.id !== id; });
  save(); renderAll();
}
function sortedEvents(list) {
  return (list || match.events).slice().sort(function (a, b) {
    return matchSecOf(a) - matchSecOf(b);
  });
}
function playerOf(ev) {
  if (!ev.side || !ev.playerId) return null;
  return match[ev.side].players.filter(function (p) { return p.id === ev.playerId; })[0] || null;
}
function tagLabel(id) {
  var t = match.tags.filter(function (x) { return x.id === id; })[0];
  return t ? t.label : id;
}

/* ---------------- reconocimiento de voz ---------------- */
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var rec = null, listening = false, keepAlive = false, stampP = null, stampE = null;

function speechAvailable() { return !!SR; }
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/* ---- texto del botón de micro (según disponibilidad y modo elegido) ---- */
function micIdleLabel() {
  if (!speechAvailable()) {
    return isIOS() ? "Pulsa y dicta con el<br>micrófono del teclado"
                    : "Dictado no disponible<br>pulsa para escribir";
  }
  return prefs.micMode === "hold" ? "Grabar nota" : "Grabar notas";
}
function micListeningLabel() {
  return prefs.micMode === "hold" ? "Escuchando&hellip;<br>suelta para terminar"
                                   : "Escuchando&hellip;<br>pulsa para parar";
}
function paintMicLabel() {
  $("btnMic").querySelector(".mic-label").innerHTML = listening ? micListeningLabel() : micIdleLabel();
}

/* ---- buffer de resultados finales: el motor de reconocimiento a veces
   reenvía el mismo resultado marcado "final" varias veces con la
   transcripción cada vez más larga antes de cerrar la frase de verdad.
   Nos quedamos siempre con la revisión más reciente y solo confirmamos la
   jugada cuando el texto deja de cambiar o cuando aparece contenido en un
   resultado distinto (señal de que el anterior ya cerró). ---- */
var finalBuf = { idx: -1, text: "", stampP: null, stampE: null };
var finalTimer = null;
var FINAL_STABLE_MS = 500;
function resetFinalBuf() {
  clearTimeout(finalTimer); finalTimer = null;
  finalBuf = { idx: -1, text: "", stampP: null, stampE: null };
}
function commitFinalBuf() {
  clearTimeout(finalTimer); finalTimer = null;
  if (finalBuf.idx === -1) return;
  var txt = finalBuf.text.trim();
  var savedP = finalBuf.stampP, savedE = finalBuf.stampE;
  finalBuf = { idx: -1, text: "", stampP: null, stampE: null };
  if (!txt) return;
  if (!voiceCommand(txt)) {
    var t = txt.charAt(0).toUpperCase() + txt.slice(1);
    if (prefs.autoSave) addEvent(t, savedE, savedP);
    else pendingDraft(t, savedE, savedP);
  }
}

function startRec() {
  if (!SR) {
    /* Safari e iOS no traen Web Speech API. El teclado del sistema sí dicta:
       abrimos la nota manual con el minuto ya sellado y el foco puesto. */
    if (isIOS()) { openManualNote(true); return; }
    modalInfo("Dictado no disponible",
      "<p>Este navegador no incluye reconocimiento de voz. Usa <b>Chrome</b> o <b>Edge</b> (en el móvil, Chrome). " +
      "Mientras tanto puedes usar <b>Escribir nota</b>, que registra el minuto igual.</p>");
    return;
  }
  rec = new SR();
  rec.lang = prefs.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onstart = function () {
    listening = true; keepAlive = true;
    resetFinalBuf();
    $("btnMic").classList.add("rec");
    paintMicLabel();
    setTranscript("", true);
    beep(1100, 70);
  };
  rec.onspeechstart = function () {
    stampP = match.activePeriod;
    stampE = elapsedNow(activeP());
    $("micStamp").textContent = "sellado en " + minLabel(stampP, stampE) +
      (match.periods[stampP].videoStartSec == null ? "" : "  ·  vídeo " + fmtHMS(match.periods[stampP].videoStartSec + stampE));
  };
  rec.onresult = function (ev) {
    var interim = "";
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      var r = ev.results[i];
      if (finalBuf.idx !== -1 && i !== finalBuf.idx) commitFinalBuf();
      if (r.isFinal) {
        if (finalBuf.idx === -1) {
          finalBuf.idx = i;
          finalBuf.stampP = stampP; finalBuf.stampE = stampE;
          stampP = null; stampE = null;
          $("micStamp").textContent = "";
        }
        finalBuf.text = r[0].transcript;
        clearTimeout(finalTimer);
        finalTimer = setTimeout(commitFinalBuf, FINAL_STABLE_MS);
      } else interim += r[0].transcript;
    }
    setTranscript(interim, !interim);
    highlightTags(interim);
  };
  rec.onerror = function (e) {
    if (e.error === "no-speech" || e.error === "aborted") return;
    keepAlive = false;
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      modalInfo("Micrófono bloqueado",
        "<p>El navegador ha denegado el micrófono.</p><p>En el móvil: ajustes del sitio &rarr; permitir micrófono. " +
        "En el ordenador, si has abierto el archivo con doble clic, Chrome no recuerda el permiso: sirve la carpeta " +
        "(<code>python -m http.server 8000</code>) y entra en <code>localhost:8000</code>, o instala la app como PWA.</p>");
    } else if (e.error === "network") {
      toast("El dictado necesita conexión a internet");
    } else toast("Fallo del micrófono: " + e.error);
    stopRec();
  };
  rec.onend = function () {
    commitFinalBuf();
    if (keepAlive && listening) { try { rec.start(); } catch (err) {} }
    else stopRec();
  };
  try { rec.start(); } catch (err) {}
}
function stopRec() {
  commitFinalBuf();
  listening = false; keepAlive = false;
  if (rec) { try { rec.stop(); } catch (e) {} }
  $("btnMic").classList.remove("rec");
  paintMicLabel();
  $("micStamp").textContent = "";
  setTranscript("", true);
  highlightTags("");
  beep(520, 70);
}
function setTranscript(text, placeholder) {
  var el = $("transcript");
  if (placeholder || !text) {
    el.innerHTML = '<span class="ph">' + (listening ? "Te escucho&hellip;" : "Aquí aparecerá lo que dictes&hellip;") + "</span>";
  } else el.innerHTML = '<span class="interim">' + esc(text) + "</span>";
}
function highlightTags(text) {
  var found = text ? detectTags(text) : [];
  [].forEach.call(document.querySelectorAll("#quickTags .chip[data-tag]"), function (c) {
    c.classList.toggle("on", found.indexOf(c.dataset.tag) > -1);
  });
}

/* ---------------- comandos de voz ---------------- */
function voiceCommand(raw) {
  var s = norm(raw);
  if (/^(pausa|para|parar|pausar|stop)$/.test(s)) { if (activeP().running) toggleClock(); return true; }
  if (/^(sigue|seguir|reanuda|reanudar|continua|continuar|play|dale|arranca)$/.test(s)) { if (!activeP().running) toggleClock(); return true; }
  if (/^(segunda parte|segundo tiempo|empieza la segunda parte)$/.test(s)) { setPeriod(1); toast("2ª parte"); beep(660, 140); return true; }
  if (/^(primera parte|primer tiempo)$/.test(s)) { setPeriod(0); toast("1ª parte"); return true; }
  if (/^(borra|borrar|borra la ultima|borrar la ultima|quita la ultima|elimina la ultima|anula)$/.test(s)) {
    if (match.events.length) { match.events.pop(); save(); renderAll(); beep(300, 140); }
    return true;
  }
  if (/^(marca|marcar|marcalo|ojo|apunta esto)$/.test(s)) { addEvent("Marca", stampE, stampP); return true; }
  if (/^(local|equipo local|nuestro|nosotros)$/.test(s)) { ctx.side = "home"; renderCtxBar(); return true; }
  if (/^(visitante|equipo visitante|rival|ellos)$/.test(s)) { ctx.side = "away"; renderCtxBar(); return true; }
  if (/^(sin equipo|neutro|ninguno)$/.test(s)) { ctx.side = null; ctx.playerId = null; renderCtxBar(); return true; }
  if (/^(mas diez|adelanta diez)$/.test(s)) { nudge(10); return true; }
  if (/^(menos diez|atrasa diez)$/.test(s)) { nudge(-10); return true; }
  var m = s.match(/^(?:minuto|corrige minuto|cambia a minuto)\s+(.+)$/);
  if (m) {
    var n = words2num(m[1]);
    if (n !== null && match.events.length) {
      var last = match.events[match.events.length - 1];
      var loc = matchMinToPeriod(n);
      last.p = loc.p; last.e = loc.e;
      save(); renderAll(); beep(660, 90);
      return true;
    }
  }
  return false;
}
function pendingDraft(text, e, p) {
  var ev = addEvent(text, e, p);
  openEventEditor(ev.id);
}

/* ============================================================
   RENDER
   ============================================================ */
function renderAll() {
  renderTopbar(); renderPeriods(); renderCapture(); renderEvents();
  renderSetup(); renderSummary();
  $("evCount").textContent = match.events.length;
}
function renderTopbar() {
  $("tbTeams").textContent = (match.home.name || "Local") + "  —  " + (match.away.name || "Visitante");
  var bits = [];
  if (match.competition) bits.push(match.competition);
  if (match.date) bits.push(match.date.split("-").reverse().join("/"));
  bits.push(match.events.length + " jugadas");
  $("tbMeta").textContent = bits.join("  ·  ");
  paintClock();
}
function renderPeriods() {
  var bar = $("periodBar"); bar.innerHTML = "";
  match.periods.forEach(function (p, i) {
    var b = document.createElement("button");
    b.className = "pbtn" + (i === match.activePeriod ? " active" : (p.elapsedSec > 0 ? " done" : ""));
    b.textContent = p.label + (p.videoStartSec == null ? "  ⚠" : "");
    b.onclick = function () { setPeriod(i); };
    bar.appendChild(b);
  });
  var nudgeWrap = document.createElement("span");
  nudgeWrap.style.cssText = "display:flex;gap:6px;margin-left:auto;flex:none";
  [["−10s", -10], ["+10s", 10]].forEach(function (n) {
    var b = document.createElement("button");
    b.className = "pbtn"; b.textContent = n[0];
    b.onclick = function () { nudge(n[1]); };
    nudgeWrap.appendChild(b);
  });
  var bSet = document.createElement("button");
  bSet.className = "pbtn"; bSet.textContent = "⏱ fijar";
  bSet.onclick = openClockSetter;
  nudgeWrap.appendChild(bSet);
  bar.appendChild(nudgeWrap);
}
function renderCapture() {
  $("syncWarn").classList.toggle("hidden", allSynced());
  renderCtxBar();
  var qt = $("quickTags"); qt.innerHTML = "";
  match.tags.forEach(function (t) {
    var b = document.createElement("button");
    b.className = "chip"; b.dataset.tag = t.id; b.textContent = t.label;
    b.onclick = function () { addEvent(t.label); toast(t.label + " en " + minLabel(match.activePeriod, elapsedNow(activeP()))); };
    qt.appendChild(b);
  });
  var rl = $("recentList");
  var last = sortedEvents().slice(-4).reverse();
  rl.innerHTML = last.length ? "" : '<div class="empty">Todavía no hay jugadas.<br>El minuto se sella en cuanto empiezas a hablar.</div>';
  last.forEach(function (ev) { rl.appendChild(eventNode(ev)); });
}
function renderCtxBar() {
  var bar = $("ctxBar"); if (!bar) return;
  bar.innerHTML = "";
  [["home", match.home.name || "Local"], [null, "Sin equipo"], ["away", match.away.name || "Visitante"]].forEach(function (o) {
    var b = document.createElement("button");
    b.className = "chip side" + (ctx.side === o[0] ? " on" : "");
    b.textContent = o[1];
    b.onclick = function () { ctx.side = o[0]; ctx.playerId = null; renderCtxBar(); };
    bar.appendChild(b);
  });
  if (ctx.side) {
    var sel = document.createElement("select");
    sel.style.cssText = "max-width:190px;margin-top:0";
    sel.innerHTML = '<option value="">Sin jugador</option>' + match[ctx.side].players.map(function (p) {
      return '<option value="' + p.id + '"' + (ctx.playerId === p.id ? " selected" : "") + ">" + esc(p.num + " " + p.name) + "</option>";
    }).join("");
    sel.onchange = function () { ctx.playerId = sel.value || null; };
    bar.appendChild(sel);
  }
}
function eventNode(ev) {
  var d = document.createElement("div");
  d.className = "ev " + (ev.rating > 0 ? "pos" : ev.rating < 0 ? "neg" : "neu");
  var vs = videoSecOf(ev), pl = playerOf(ev);
  var who = [];
  if (ev.side) who.push(match[ev.side].name || (ev.side === "home" ? "Local" : "Visitante"));
  if (pl) who.push(pl.num + " " + pl.name);
  d.innerHTML =
    '<div class="ev-top">' +
      '<span class="ev-min">' + minLabel(ev.p, ev.e) + "</span>" +
      '<span class="ev-vid">' + (vs == null ? "sin sincronía" : "▶ " + fmtHMS(vs)) + "</span>" +
      '<span class="ev-per">' + esc(match.periods[ev.p] ? match.periods[ev.p].label : "?") + "</span>" +
      (who.length ? '<span class="ev-who">' + esc(who.join(" · ")) + "</span>" : "") +
    "</div>" +
    '<div class="ev-note">' + esc(ev.note) + "</div>" +
    (ev.tags.length ? '<div class="ev-tags">' + ev.tags.map(function (t) { return '<span class="tg">' + esc(tagLabel(t)) + "</span>"; }).join("") + "</div>" : "");
  var acts = document.createElement("div"); acts.className = "ev-acts";
  var bEdit = document.createElement("button"); bEdit.textContent = "Editar";
  bEdit.onclick = function () { openEventEditor(ev.id); };
  var bCopy = document.createElement("button"); bCopy.textContent = "Copiar tiempo";
  bCopy.onclick = function () {
    var txt = vs == null ? minLabel(ev.p, ev.e) : fmtHMS(vs);
    copyText(txt); toast("Copiado: " + txt);
  };
  var bDel = document.createElement("button"); bDel.textContent = "Borrar";
  bDel.onclick = function () { if (confirm("¿Borrar esta jugada?")) delEvent(ev.id); };
  acts.appendChild(bEdit); acts.appendChild(bCopy); acts.appendChild(bDel);
  d.appendChild(acts);
  return d;
}
function renderEvents() {
  var fT = norm($("fltText").value || ""), fP = $("fltPeriod").value,
      fTeam = $("fltTeam").value, fTag = $("fltTag").value, fR = $("fltRating").value;
  var list = sortedEvents().filter(function (ev) {
    if (fT && norm(ev.note).indexOf(fT) === -1) return false;
    if (fP !== "" && String(ev.p) !== fP) return false;
    if (fTeam && ev.side !== fTeam) return false;
    if (fTag && ev.tags.indexOf(fTag) === -1) return false;
    if (fR !== "" && String(ev.rating) !== fR) return false;
    return true;
  });
  var box = $("eventsList"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<div class="empty">Sin jugadas que mostrar.</div>'; return; }
  list.forEach(function (ev) { box.appendChild(eventNode(ev)); });
}
function fillFilters() {
  var p = $("fltPeriod"), keep = p.value;
  p.innerHTML = '<option value="">Todas las partes</option>' +
    match.periods.map(function (x, i) { return '<option value="' + i + '">' + esc(x.label) + "</option>"; }).join("");
  p.value = keep;
  var t = $("fltTag"), keepT = t.value;
  t.innerHTML = '<option value="">Todas las etiquetas</option>' +
    match.tags.map(function (x) { return '<option value="' + x.id + '">' + esc(x.label) + "</option>"; }).join("");
  t.value = keepT;
  $("fltTeam").options[1].textContent = match.home.name || "Local";
  $("fltTeam").options[2].textContent = match.away.name || "Visitante";
}

/* ---------------- ajustes ---------------- */
var rosterSide = "home";
function renderSetup() {
  $("cfgHomeName").value = match.home.name;
  $("cfgAwayName").value = match.away.name;
  $("cfgCompetition").value = match.competition || "";
  $("cfgDate").value = match.date || "";
  $("prefAutoSave").checked = prefs.autoSave;
  $("prefWakeLock").checked = prefs.wakeLock;
  $("prefBeep").checked = prefs.beep;
  $("prefMicMode").value = prefs.micMode;
  $("prefLang").value = prefs.lang;
  $("csvSemicolon").checked = prefs.csvSemicolon;
  $("expFps").value = String(prefs.fps);

  var pc = $("periodsCfg"); pc.innerHTML = "";
  match.periods.forEach(function (p, i) {
    var row = document.createElement("div"); row.className = "per-row";
    row.innerHTML =
      '<label>Parte<input type="text" value="' + esc(p.label) + '" data-k="label" data-i="' + i + '"></label>' +
      '<label>Duración (min)<input type="number" min="1" max="60" value="' + p.durationMin + '" data-k="dur" data-i="' + i + '"></label>' +
      '<label>Empieza en el vídeo<input type="text" placeholder="p. ej. 3:20" value="' +
        (p.videoStartSec == null ? "" : fmtHMS(p.videoStartSec)) + '" data-k="vs" data-i="' + i + '"></label>';
    var del = document.createElement("button");
    del.className = "btn ghost"; del.textContent = "✕"; del.title = "Quitar parte";
    del.disabled = match.periods.length <= 2;
    del.onclick = function () {
      if (match.events.some(function (e) { return e.p === i; })) { toast("Esa parte tiene jugadas"); return; }
      match.periods.splice(i, 1);
      if (match.activePeriod >= match.periods.length) match.activePeriod = match.periods.length - 1;
      save(); renderAll(); fillFilters();
    };
    row.appendChild(del);
    pc.appendChild(row);
  });
  [].forEach.call(pc.querySelectorAll("input"), function (inp) {
    inp.onchange = function () {
      var i = +inp.dataset.i, k = inp.dataset.k, p = match.periods[i];
      if (k === "label") p.label = inp.value || "Parte " + (i + 1);
      if (k === "dur") p.durationMin = Math.max(1, Math.min(60, parseInt(inp.value, 10) || 45));
      if (k === "vs") {
        var v = parseTime(inp.value);
        p.videoStartSec = (inp.value.trim() === "") ? null : (v == null ? p.videoStartSec : v);
        inp.value = p.videoStartSec == null ? "" : fmtHMS(p.videoStartSec);
      }
      save(); renderAll(); fillFilters();
    };
  });
  renderRoster(); renderTagsCfg();
  $("engineInfo").innerHTML = "Dictado: " + (speechAvailable() ? "disponible en este navegador" :
    "no disponible aquí (usa Chrome o Edge)") + ". Los datos se guardan en este dispositivo.";
}
function renderRoster() {
  [].forEach.call(document.querySelectorAll(".rt"), function (b) {
    b.classList.toggle("active", b.dataset.side === rosterSide);
  });
  var box = $("rosterList"); box.innerHTML = "";
  var list = match[rosterSide].players;
  if (!list.length) { box.innerHTML = '<span class="hint">Sin jugadores todavía.</span>'; return; }
  list.slice().sort(function (a, b) { return (parseInt(a.num, 10) || 99) - (parseInt(b.num, 10) || 99); })
    .forEach(function (p) {
      var s = document.createElement("span"); s.className = "pl";
      s.innerHTML = "<b>" + esc(p.num) + "</b> " + esc(p.name) + ' <span class="x">✕</span>';
      s.querySelector(".x").onclick = function () {
        match[rosterSide].players = list.filter(function (x) { return x.id !== p.id; });
        save(); renderRoster(); renderCtxBar();
      };
      box.appendChild(s);
    });
}
function renderTagsCfg() {
  var box = $("tagsCfg"); box.innerHTML = "";
  match.tags.forEach(function (t) {
    var s = document.createElement("span"); s.className = "chip";
    s.innerHTML = esc(t.label) + ' <span class="x">✕</span>';
    s.querySelector(".x").onclick = function () {
      match.tags = match.tags.filter(function (x) { return x.id !== t.id; });
      save(); renderTagsCfg(); renderCapture(); fillFilters();
    };
    box.appendChild(s);
  });
}
function renderSummary() {
  var s = $("summary"); if (!s) return;
  var evs = match.events;
  var pos = evs.filter(function (e) { return e.rating > 0; }).length;
  var neg = evs.filter(function (e) { return e.rating < 0; }).length;
  var byTag = {};
  evs.forEach(function (e) { e.tags.forEach(function (t) { byTag[t] = (byTag[t] || 0) + 1; }); });
  var top = Object.keys(byTag).sort(function (a, b) { return byTag[b] - byTag[a]; }).slice(0, 6);
  s.innerHTML =
    '<div class="sum-grid">' +
      '<div class="sum-box"><div class="n">' + evs.length + '</div><div class="l">jugadas</div></div>' +
      '<div class="sum-box"><div class="n" style="color:var(--good)">' + pos + '</div><div class="l">positivas</div></div>' +
      '<div class="sum-box"><div class="n" style="color:var(--bad)">' + neg + '</div><div class="l">mejorables</div></div>' +
      top.map(function (t) {
        return '<div class="sum-box"><div class="n">' + byTag[t] + '</div><div class="l">' + esc(tagLabel(t)) + "</div></div>";
      }).join("") +
    "</div>";
}

/* ============================================================
   MODALES
   ============================================================ */
function openModal(html) {
  $("modalCard").innerHTML = html;
  $("modal").hidden = false;
}
function closeModal() { $("modal").hidden = true; }
$("modal").addEventListener("click", function (e) { if (e.target.id === "modal") closeModal(); });

function modalInfo(title, html) {
  openModal("<h2>" + esc(title) + "</h2>" + html +
    '<div class="modal-actions"><button class="btn" id="mOk">Entendido</button></div>');
  $("mOk").onclick = closeModal;
}
/* cierra cualquier modal abierto, va a Ajustes y enfoca/resalta el campo
   "empieza en el vídeo" de la primera parte que falte por sincronizar */
function focusSyncSetting() {
  closeModal();
  var idx = 0;
  for (var i = 0; i < match.periods.length; i++) {
    if (match.periods[i].videoStartSec == null) { idx = i; break; }
  }
  showView("setup");
  setTimeout(function () {
    var input = document.querySelector('#periodsCfg input[data-i="' + idx + '"][data-k="vs"]');
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus();
    input.classList.add("flash");
    setTimeout(function () { input.classList.remove("flash"); }, 1500);
  }, 60);
}
function syncMissingModal() {
  openModal(
    "<h2>Falta la sincronía</h2><p>Indica en Ajustes en qué minuto del vídeo empieza cada parte.</p>" +
    '<div class="modal-actions"><button class="btn ghost" id="fsC">Cerrar</button><button class="btn" id="fsGo">Ir a Ajustes</button></div>'
  );
  $("fsC").onclick = closeModal;
  $("fsGo").onclick = focusSyncSetting;
}
function openClockSetter() {
  var p = activeP(), e = elapsedNow(p);
  openModal(
    "<h2>Fijar el reloj</h2>" +
    '<label>Tiempo transcurrido de <b>' + esc(p.label) + '</b> (mm:ss)<input type="text" id="mkE" value="' + fmtMS(e) + '"></label>' +
    '<label>…o tiempo del vídeo original (hh:mm:ss)<input type="text" id="mkV" value="' +
      (p.videoStartSec == null ? "" : fmtHMS(p.videoStartSec + e)) + '" ' + (p.videoStartSec == null ? "disabled" : "") + "></label>" +
    '<p class="hint">Rellena el que te resulte más cómodo: se convierten entre sí.</p>' +
    '<div class="modal-actions"><button class="btn ghost" id="mkC">Cancelar</button><button class="btn" id="mkOk">Aplicar</button></div>'
  );
  $("mkE").oninput = function () {
    var v = parseTime($("mkE").value);
    if (v != null && p.videoStartSec != null) $("mkV").value = fmtHMS(p.videoStartSec + v);
  };
  $("mkV").oninput = function () {
    var v = parseTime($("mkV").value);
    if (v != null && p.videoStartSec != null) $("mkE").value = fmtMS(Math.max(0, v - p.videoStartSec));
  };
  $("mkC").onclick = closeModal;
  $("mkOk").onclick = function () {
    var v = parseTime($("mkE").value);
    if (v == null) { toast("Tiempo no válido"); return; }
    p.elapsedSec = Math.max(0, v);
    if (p.running) p.startedAt = Date.now();
    save(); paintClock(); closeModal();
  };
}
function openManualNote(fromMic) {
  var p = activeP(), e = elapsedNow(p);   // el minuto se sella al abrir, no al guardar
  openModal(
    "<h2>Nueva jugada</h2>" +
    (fromMic ? '<p class="hint" style="color:var(--warn)">Este navegador no dicta por sí solo. ' +
      'Pulsa el <b>micrófono del teclado</b> del móvil y habla: el minuto ya está sellado en ' +
      minLabel(match.activePeriod, e) + ".</p>" : "") +
    '<label>Minuto de partido (' + esc(p.label) + ', mm:ss)<input type="text" id="mnE" value="' + fmtMS(e) + '"></label>' +
    '<label>Nota<textarea id="mnT" rows="4" placeholder="Qué pasa y con qué información contabas al decidir"></textarea></label>' +
    '<div class="modal-actions"><button class="btn ghost" id="mnC">Cancelar</button><button class="btn" id="mnOk">Guardar</button></div>'
  );
  $("mnC").onclick = closeModal;
  $("mnOk").onclick = function () {
    var v = parseTime($("mnE").value);
    var ev = addEvent($("mnT").value.trim() || "Marca", v == null ? e : v, match.activePeriod);
    closeModal();
    if (!fromMic) openEventEditor(ev.id);
  };
  setTimeout(function () { $("mnT").focus(); }, 60);
}
function openAtVideo() {
  if (!isSynced()) { syncMissingModal(); return; }
  openModal(
    "<h2>Añadir por minuto de vídeo</h2>" +
    '<label>Tiempo del vídeo original (hh:mm:ss)<input type="text" id="mvV" placeholder="1:12:40"></label>' +
    '<div class="hint" id="mvPrev">—</div>' +
    '<label>Nota<textarea id="mvT" rows="4"></textarea></label>' +
    '<div class="modal-actions"><button class="btn ghost" id="mvC">Cancelar</button><button class="btn" id="mvOk">Guardar</button></div>'
  );
  $("mvV").oninput = function () {
    var v = parseTime($("mvV").value);
    var r = v == null ? null : videoToPeriod(v);
    $("mvPrev").textContent = r ? "→ " + match.periods[r.p].label + ", minuto " + minLabel(r.p, r.e) : "—";
  };
  $("mvC").onclick = closeModal;
  $("mvOk").onclick = function () {
    var v = parseTime($("mvV").value);
    if (v == null) { toast("Tiempo no válido"); return; }
    var r = videoToPeriod(v);
    if (!r) { toast("No hay parte sincronizada para ese tiempo"); return; }
    addEvent($("mvT").value.trim() || "Marca", r.e, r.p);
    closeModal();
  };
  setTimeout(function () { $("mvV").focus(); }, 60);
}
function openEventEditor(id) {
  var ev = match.events.filter(function (e) { return e.id === id; })[0];
  if (!ev) return;
  var vs = videoSecOf(ev);
  openModal(
    "<h2>Editar jugada</h2>" +
    '<label>Parte<select id="eeP">' + match.periods.map(function (p, i) {
      return '<option value="' + i + '"' + (i === ev.p ? " selected" : "") + ">" + esc(p.label) + "</option>";
    }).join("") + "</select></label>" +
    '<div class="grid2">' +
      '<label>Tiempo en la parte (mm:ss)<input type="text" id="eeE" value="' + fmtMS(ev.e) + '"></label>' +
      '<label>Tiempo del vídeo (hh:mm:ss)<input type="text" id="eeV" value="' + (vs == null ? "" : fmtHMS(vs)) + '" ' + (vs == null ? "disabled" : "") + "></label>" +
    "</div>" +
    '<label>Nota<textarea id="eeT" rows="4">' + esc(ev.note) + "</textarea></label>" +
    '<label>Equipo</label><div class="chips" id="eeSide"></div>' +
    '<label style="margin-top:12px">Jugador<select id="eePl"></select></label>' +
    '<label>Valoración</label><div class="chips" id="eeRate"></div>' +
    '<label style="margin-top:12px">Etiquetas</label><div class="chips" id="eeTags"></div>' +
    '<div class="modal-actions"><button class="btn ghost" id="eeC">Cerrar</button><button class="btn" id="eeOk">Guardar</button></div>'
  );
  var draft = { side: ev.side, playerId: ev.playerId, rating: ev.rating, tags: ev.tags.slice() };

  function fillPlayers() {
    var sel = $("eePl");
    sel.innerHTML = '<option value="">Sin jugador</option>' +
      (draft.side ? match[draft.side].players.map(function (p) {
        return '<option value="' + p.id + '"' + (draft.playerId === p.id ? " selected" : "") + ">" + esc(p.num + " " + p.name) + "</option>";
      }).join("") : "");
    sel.disabled = !draft.side;
    sel.onchange = function () { draft.playerId = sel.value || null; };
  }
  function chips(box, opts, isOn, onPick) {
    box.innerHTML = "";
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "chip" + (isOn(o.v) ? " on" : "");
      b.textContent = o.l;
      b.onclick = function () { onPick(o.v); };
      box.appendChild(b);
    });
  }
  function paintSide() {
    chips($("eeSide"),
      [{ v: "home", l: match.home.name || "Local" }, { v: null, l: "Ninguno" }, { v: "away", l: match.away.name || "Visitante" }],
      function (v) { return draft.side === v; },
      function (v) { draft.side = v; draft.playerId = null; paintSide(); fillPlayers(); });
  }
  function paintRate() {
    chips($("eeRate"),
      [{ v: 1, l: "👍 Bien" }, { v: 0, l: "Neutro" }, { v: -1, l: "👎 Mejorable" }],
      function (v) { return draft.rating === v; },
      function (v) { draft.rating = v; paintRate(); });
  }
  function paintTags() {
    chips($("eeTags"), match.tags.map(function (t) { return { v: t.id, l: t.label }; }),
      function (v) { return draft.tags.indexOf(v) > -1; },
      function (v) {
        var i = draft.tags.indexOf(v);
        if (i > -1) draft.tags.splice(i, 1); else draft.tags.push(v);
        paintTags();
      });
  }
  paintSide(); fillPlayers(); paintRate(); paintTags();

  $("eeP").onchange = function () {
    var np = +$("eeP").value, p = match.periods[np];
    $("eeV").disabled = p.videoStartSec == null;
    $("eeV").value = p.videoStartSec == null ? "" : fmtHMS(p.videoStartSec + (parseTime($("eeE").value) || 0));
  };
  $("eeE").oninput = function () {
    var p = match.periods[+$("eeP").value], v = parseTime($("eeE").value);
    if (v != null && p.videoStartSec != null) $("eeV").value = fmtHMS(p.videoStartSec + v);
  };
  $("eeV").oninput = function () {
    var p = match.periods[+$("eeP").value], v = parseTime($("eeV").value);
    if (v != null && p.videoStartSec != null) $("eeE").value = fmtMS(Math.max(0, v - p.videoStartSec));
  };
  $("eeC").onclick = closeModal;
  $("eeOk").onclick = function () {
    ev.p = +$("eeP").value;
    var v = parseTime($("eeE").value);
    if (v != null) ev.e = Math.max(0, Math.round(v));
    ev.note = $("eeT").value.trim() || "Marca";
    ev.side = draft.side; ev.playerId = draft.playerId;
    ev.rating = draft.rating; ev.tags = draft.tags;
    save(); renderAll(); closeModal();
  };
}
function openMatches() {
  var html = "<h2>Partidos</h2>";
  matches.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).forEach(function (m) {
    html += '<div class="match-item' + (m.id === match.id ? " cur" : "") + '" data-id="' + m.id + '">' +
      '<div class="grow"><div style="font-weight:700">' + esc((m.home.name || "Local") + " — " + (m.away.name || "Visitante")) + "</div>" +
      '<div class="hint" style="margin:0">' + esc([m.competition, m.date, m.events.length + " jugadas"].filter(Boolean).join(" · ")) + "</div></div>" +
      '<span class="mi-x" data-del="' + m.id + '">✕</span></div>';
  });
  html += '<div class="modal-actions"><button class="btn ghost" id="mmC">Cerrar</button><button class="btn" id="mmNew">Nuevo partido</button></div>';
  openModal(html);
  [].forEach.call($("modalCard").querySelectorAll(".match-item"), function (el) {
    el.onclick = function (e) {
      if (e.target.dataset.del) {
        if (matches.length <= 1) { toast("Debe quedar al menos un partido"); return; }
        if (!confirm("¿Borrar ese partido y todas sus jugadas?")) return;
        matches = matches.filter(function (m) { return m.id !== e.target.dataset.del; });
        if (match.id === e.target.dataset.del) { match = matches[0]; migrate(match); }
        save(true); renderAll(); fillFilters(); closeModal();
        return;
      }
      pauseActivePeriod();
      match = matches.filter(function (m) { return m.id === el.dataset.id; })[0];
      migrate(match); save(true); renderAll(); fillFilters(); closeModal();
    };
  });
  $("mmC").onclick = closeModal;
  $("mmNew").onclick = function () {
    pauseActivePeriod();
    match = newMatch(); matches.push(match);
    save(true); renderAll(); fillFilters(); closeModal();
    toast("Partido nuevo creado");
  };
}

/* ============================================================
   EXPORTACIONES
   ============================================================ */
function download(name, mime, content) {
  var blob = new Blob([content], { type: mime });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function copyText(txt) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  var ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  ta.remove();
}
function baseName() {
  var n = (match.home.name || "local") + "-" + (match.away.name || "visitante");
  return n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
}
function rows() {
  return sortedEvents().map(function (ev, i) {
    var pl = playerOf(ev), vs = videoSecOf(ev);
    return {
      n: i + 1,
      parte: match.periods[ev.p] ? match.periods[ev.p].label : "?",
      min: minLabel(ev.p, ev.e),
      tPartido: fmtMS(matchSecOf(ev)),
      tVideo: vs == null ? "" : fmtHMS(vs),
      vsec: vs,
      equipo: ev.side ? (match[ev.side].name || (ev.side === "home" ? "Local" : "Visitante")) : "",
      jugador: pl ? pl.num + " " + pl.name : "",
      etiquetas: ev.tags.map(tagLabel).join(" | "),
      valoracion: ev.rating > 0 ? "Bien" : ev.rating < 0 ? "Mejorable" : "Neutro",
      nota: ev.note
    };
  });
}
var COLS = ["n", "parte", "min", "tPartido", "tVideo", "equipo", "jugador", "etiquetas", "valoracion", "nota"];
var HEAD = ["#", "Parte", "Minuto", "Tiempo partido", "Tiempo vídeo", "Equipo", "Jugador", "Etiquetas", "Valoración", "Nota"];

function csvText() {
  var sep = prefs.csvSemicolon ? ";" : ",";
  var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
  var out = [HEAD.map(q).join(sep)];
  rows().forEach(function (r) { out.push(COLS.map(function (c) { return q(r[c]); }).join(sep)); });
  return "﻿" + out.join("\r\n");
}
function xlsText() {
  var head = "<tr>" + HEAD.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>";
  var body = rows().map(function (r) {
    return "<tr>" + COLS.map(function (c) { return "<td>" + esc(r[c]) + "</td>"; }).join("") + "</tr>";
  }).join("");
  return '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' +
    "<table border=1>" + head + body + "</table></body></html>";
}
function markerRows() {
  return rows().filter(function (r) { return r.vsec != null; });
}
/* true si ya hay marcadores para exportar; si no, explica por qué y, si el
   problema se arregla en Ajustes (falta sincronizar alguna parte), lleva allí */
function requireMarkers() {
  if (markerRows().length) return true;
  if (!isSynced()) syncMissingModal();
  else toast("No hay jugadas registradas en una parte sincronizada");
  return false;
}
function markerTitle(r) {
  var t = r.min + " " + (r.etiquetas ? "[" + r.etiquetas.replace(/ \| /g, ",") + "] " : "") + r.nota;
  return t.replace(/\s+/g, " ").slice(0, 110);
}
function vttText() {
  var mk = markerRows();
  var out = ["WEBVTT", ""];
  mk.forEach(function (r, i) {
    var end = (i + 1 < mk.length) ? mk[i + 1].vsec : r.vsec + 15;
    out.push(String(i + 1));
    out.push(fmtHMS(r.vsec) + ".000 --> " + fmtHMS(Math.max(r.vsec + 1, end)) + ".000");
    out.push(markerTitle(r));
    out.push("");
  });
  return out.join("\n");
}
function ytText() {
  var mk = markerRows();
  var out = [];
  if (!mk.length || mk[0].vsec > 0) out.push("0:00 Inicio");
  mk.forEach(function (r) {
    var s = Math.round(r.vsec);
    var tc = (s >= 3600 ? Math.floor(s / 3600) + ":" + pad(Math.floor(s / 60) % 60) : String(Math.floor(s / 60))) + ":" + pad(s % 60);
    out.push(tc + " " + markerTitle(r));
  });
  return out.join("\n");
}
function markerCsvText() {
  var fps = parseFloat(prefs.fps) || 25;
  var out = ["Name,Description,In,Out,Duration,Color"];
  markerRows().forEach(function (r) {
    var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    out.push([q(r.min + " " + (r.etiquetas || "Marca")), q(r.nota),
      fmtTC(r.vsec, fps), fmtTC(r.vsec + 1, fps), "00:00:01:00",
      r.valoracion === "Bien" ? "Green" : r.valoracion === "Mejorable" ? "Red" : "Blue"].join(","));
  });
  return "﻿" + out.join("\r\n");
}
function edlText() {
  var fps = parseFloat(prefs.fps) || 25;
  var out = ["TITLE: " + (match.home.name + " vs " + match.away.name), "FCM: NON-DROP FRAME", ""];
  markerRows().forEach(function (r, i) {
    var inTC = fmtTC(r.vsec, fps), outTC = fmtTC(r.vsec + 1 / fps, fps);
    out.push(pad(i + 1) + "  001      V     C        " + inTC + " " + outTC + " " + inTC + " " + outTC);
    out.push(" |C:Resolve" + (r.valoracion === "Bien" ? "ColorGreen" : r.valoracion === "Mejorable" ? "ColorRed" : "ColorBlue") +
      " |M:" + markerTitle(r).replace(/\|/g, "/") + " |D:1");
    out.push("");
  });
  return out.join("\n");
}
function reportText() {
  var out = ["# " + match.home.name + " — " + match.away.name];
  if (match.competition || match.date) out.push(match.competition + " " + match.date);
  out.push("");
  out.push("| Parte | Min | Vídeo | Equipo | Jugador | Etiquetas | Val. | Nota |");
  out.push("|---|---|---|---|---|---|---|---|");
  rows().forEach(function (r) {
    out.push("| " + [r.parte, r.min, r.tVideo || "-", r.equipo || "-", r.jugador || "-",
      r.etiquetas || "-", r.valoracion, r.nota.replace(/\|/g, "/")].join(" | ") + " |");
  });
  return out.join("\n");
}

/* ============================================================
   EVENTOS DE INTERFAZ
   ============================================================ */
function showView(name) {
  [].forEach.call(document.querySelectorAll(".tab"), function (t) { t.classList.toggle("active", t.dataset.view === name); });
  [].forEach.call(document.querySelectorAll(".view"), function (v) { v.classList.toggle("active", v.id === "view-" + name); });
  window.scrollTo(0, 0);
  if (name === "events") { fillFilters(); renderEvents(); }
  if (name === "export") renderSummary();
}
[].forEach.call(document.querySelectorAll(".tab"), function (t) {
  t.onclick = function () { showView(t.dataset.view); };
});
$("btnClock").onclick = toggleClock;
$("btnMatches").onclick = openMatches;
$("btnManual").onclick = openManualNote;
$("btnAtVideo").onclick = openAtVideo;
$("btnGoSync").onclick = focusSyncSetting;

/* micrófono: el gesto activo depende de prefs.micMode, no de cuánto se
   mantenga pulsado (ver preferencia "Modo de grabación" en Ajustes) */
var MIC = $("btnMic");
MIC.addEventListener("pointerdown", function (e) {
  if (!SR || prefs.micMode !== "hold") return;
  try { MIC.setPointerCapture(e.pointerId); } catch (err) {}
  if (!listening) startRec();
});
MIC.addEventListener("pointerup", function () {
  if (!SR) { startRec(); return; }
  if (prefs.micMode === "hold") { if (listening) setTimeout(stopRec, 900); }
  else { listening ? stopRec() : startRec(); }
});
MIC.addEventListener("pointercancel", function () {
  if (SR && prefs.micMode === "hold" && listening) stopRec();
});

$("btnAddPeriod").onclick = function () {
  var n = match.periods.length + 1;
  match.periods.push({ label: "Prórroga " + (n - 2), durationMin: 15, videoStartSec: null, elapsedSec: 0, running: false, startedAt: null });
  save(); renderAll(); fillFilters();
};
$("btnTestSync").onclick = function () {
  if (!isSynced()) { $("syncTest").textContent = "Todavía no has indicado ningún inicio de parte."; return; }
  var lines = match.periods.map(function (p, i) {
    if (p.videoStartSec == null) return "· " + p.label + ": sin sincronizar";
    return "· " + p.label + ": el minuto " + (Math.round(periodBaseSec(i) / 60) + 1) + "' del partido cae en " +
      fmtHMS(p.videoStartSec) + " del vídeo; el final de esa parte, en " + fmtHMS(p.videoStartSec + p.durationMin * 60) + ".";
  });
  $("syncTest").innerHTML = lines.join("<br>");
};
["cfgHomeName", "cfgAwayName", "cfgCompetition", "cfgDate"].forEach(function (id) {
  $(id).oninput = function () {
    if (id === "cfgHomeName") match.home.name = $(id).value;
    if (id === "cfgAwayName") match.away.name = $(id).value;
    if (id === "cfgCompetition") match.competition = $(id).value;
    if (id === "cfgDate") match.date = $(id).value;
    save(); renderTopbar(); renderCtxBar(); fillFilters();
  };
});
[].forEach.call(document.querySelectorAll(".rt"), function (b) {
  b.onclick = function () { rosterSide = b.dataset.side; renderRoster(); };
});
$("btnAddPlayer").onclick = function () {
  var num = $("newPlayerNum").value.trim(), name = $("newPlayerName").value.trim();
  if (!name) { toast("Falta el nombre"); return; }
  match[rosterSide].players.push({ id: uid(), num: num || "-", name: name });
  $("newPlayerNum").value = ""; $("newPlayerName").value = "";
  save(); renderRoster(); renderCtxBar();
};
$("newPlayerName").onkeydown = function (e) { if (e.key === "Enter") $("btnAddPlayer").click(); };
$("btnBulkRoster").onclick = function () {
  var lines = $("bulkRoster").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  var n = 0;
  lines.forEach(function (l) {
    var m = l.match(/^(\d{1,2})\s*[.\-)]?\s*(.+)$/);
    if (m) { match[rosterSide].players.push({ id: uid(), num: m[1], name: m[2].trim() }); n++; }
    else { match[rosterSide].players.push({ id: uid(), num: "-", name: l }); n++; }
  });
  $("bulkRoster").value = "";
  save(); renderRoster(); renderCtxBar(); toast(n + " jugadores añadidos");
};
$("btnAddTag").onclick = function () {
  var v = $("newTag").value.trim(); if (!v) return;
  var id = norm(v).replace(/\s+/g, "_");
  if (match.tags.some(function (t) { return t.id === id; })) { toast("Ya existe"); return; }
  match.tags.push({ id: id, label: v });
  $("newTag").value = "";
  save(); renderTagsCfg(); renderCapture(); fillFilters();
};
$("newTag").onkeydown = function (e) { if (e.key === "Enter") $("btnAddTag").click(); };

$("prefAutoSave").onchange = function () { prefs.autoSave = this.checked; save(); };
$("prefWakeLock").onchange = function () { prefs.wakeLock = this.checked; save(); if (this.checked) requestWakeLock(); };
$("prefBeep").onchange = function () { prefs.beep = this.checked; save(); };
$("prefMicMode").onchange = function () {
  prefs.micMode = this.value; save();
  if (listening) stopRec();
  paintMicLabel();
};
$("prefLang").onchange = function () { prefs.lang = this.value; save(); if (listening) { stopRec(); setTimeout(startRec, 300); } };
$("csvSemicolon").onchange = function () { prefs.csvSemicolon = this.checked; save(); };
$("expFps").onchange = function () { prefs.fps = parseFloat(this.value); save(); };

$("btnNewMatch").onclick = function () {
  pauseActivePeriod();
  match = newMatch(); matches.push(match); save(true); renderAll(); fillFilters(); toast("Partido nuevo");
};
$("btnDeleteMatch").onclick = function () {
  if (!confirm("Se borra este partido y sus " + match.events.length + " jugadas. ¿Seguro?")) return;
  matches = matches.filter(function (m) { return m.id !== match.id; });
  if (!matches.length) matches.push(newMatch());
  match = matches[0]; migrate(match); save(true); renderAll(); fillFilters();
};
$("btnImportJson").onclick = function () { $("filePicker").click(); };
$("filePicker").onchange = function () {
  var f = this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var data = JSON.parse(r.result);
      var list = Array.isArray(data) ? data : [data];
      var imported = list.map(function (m) { m.id = uid(); migrate(m); return m; });
      if (!imported.length) { toast("Archivo no válido"); return; }
      pauseActivePeriod();
      matches = matches.concat(imported);
      match = matches[matches.length - 1];
      save(true); renderAll(); fillFilters(); toast("Importado");
    } catch (e) { toast("Archivo no válido"); }
  };
  r.readAsText(f);
  this.value = "";
};
["fltText", "fltPeriod", "fltTeam", "fltTag", "fltRating"].forEach(function (id) {
  $(id).oninput = renderEvents; $(id).onchange = renderEvents;
});
$("btnCsv").onclick = function () { download(baseName() + ".csv", "text/csv;charset=utf-8", csvText()); };
$("btnXls").onclick = function () { download(baseName() + ".xls", "application/vnd.ms-excel", xlsText()); };
$("btnCopyTable").onclick = function () { copyText(reportText()); toast("Tabla copiada"); };
$("btnVtt").onclick = function () {
  if (!requireMarkers()) return;
  download(baseName() + "-capitulos.vtt", "text/vtt;charset=utf-8", vttText());
};
$("btnYt").onclick = function () {
  if (!requireMarkers()) return;
  download(baseName() + "-capitulos.txt", "text/plain;charset=utf-8", ytText());
};
$("btnMarkerCsv").onclick = function () {
  if (!requireMarkers()) return;
  download(baseName() + "-marcadores.csv", "text/csv;charset=utf-8", markerCsvText());
};
$("btnEdl").onclick = function () {
  if (!requireMarkers()) return;
  download(baseName() + "-marcadores.edl", "text/plain;charset=utf-8", edlText());
};
$("btnJson").onclick = function () {
  download(baseName() + ".json", "application/json;charset=utf-8", JSON.stringify(match, null, 2));
};
$("btnCopyText").onclick = function () { copyText(reportText()); toast("Informe copiado"); };

/* atajos de teclado */
document.addEventListener("keydown", function (e) {
  var tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
  if (e.key === "m" || e.key === "M") { e.preventDefault(); addEvent("Marca"); }
  if (e.code === "Space") { e.preventDefault(); toggleClock(); }
  if (e.key === "v" || e.key === "V") { e.preventDefault(); listening ? stopRec() : startRec(); }
  if (e.key === "Escape") closeModal();
});
window.addEventListener("beforeunload", function () { save(true); });

/* ---------------- arranque ---------------- */
try {
  loadAll();
  renderAll();
  fillFilters();
} catch (e) {
  /* si algo en los datos guardados sigue rompiendo el pintado pese a la
     normalización de migrate(), no dejamos la app en blanco para siempre:
     arrancamos con un partido nuevo y avisamos. */
  matches = [newMatch()];
  match = matches[0];
  try { save(true); } catch (e2) {}
  renderAll();
  fillFilters();
  toast("No se pudieron leer los partidos guardados: se ha creado uno nuevo");
}

/* En iPhone/Safari no hay Web Speech API: el botón pasa a abrir la nota
   para que se dicte con el micrófono del teclado del sistema. paintMicLabel()
   ya sabe elegir el texto correcto según disponibilidad y modo elegido. */
paintMicLabel();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
})();
