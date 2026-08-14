/* Prueba de humo: carga la app en un DOM simulado y verifica
   la lógica de tiempos partido <-> vídeo y las exportaciones. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const WWW = path.join(__dirname, "..", "www");
const html = fs.readFileSync(path.join(WWW, "index.html"), "utf8");

let fails = 0, passes = 0;
function ok(name, cond, extra) {
  if (cond) { passes++; console.log("  ok  " + name); }
  else { fails++; console.log("FALLA  " + name + (extra ? "  -> " + extra : "")); }
}

const dom = new JSDOM(html, {
  runScripts: "outside-only",
  url: "http://localhost:8777/index.html",
  pretendToBeVisual: true
});
const w = dom.window;

// stubs mínimos que jsdom no trae
w.localStorage.clear();
w.navigator.wakeLock = undefined;
w.AudioContext = undefined;

// SpeechRecognition falso: permite simular en el bucle onresult el bug real
// de Chrome (reenvía el mismo resultado marcado "final" varias veces con la
// transcripción cada vez más larga) sin necesidad de un navegador de verdad.
function FakeSpeechRecognition() {
  this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
  this.onstart = null; this.onspeechstart = null; this.onresult = null; this.onerror = null; this.onend = null;
  w.__lastRec = this;
}
FakeSpeechRecognition.prototype.start = function () { if (this.onstart) this.onstart(); };
FakeSpeechRecognition.prototype.stop = function () {};
w.SpeechRecognition = FakeSpeechRecognition;
w.confirm = () => true;
w.alert = () => {};
w.URL.createObjectURL = () => "blob:x";
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () { w.__lastDownload = this.download; };
w.navigator.serviceWorker = undefined;

// exponemos las funciones internas para poder probarlas
let code = fs.readFileSync(path.join(WWW, "app.js"), "utf8");
code = code.replace(/\}\)\(\);\s*$/, `
  window.__test = { match:function(){return match;}, matches:function(){return matches;},
    fmtMS:fmtMS, fmtHMS:fmtHMS, fmtTC:fmtTC, parseTime:parseTime, minLabel:minLabel,
    periodBaseSec:periodBaseSec, videoSecOf:videoSecOf, matchSecOf:matchSecOf,
    videoToPeriod:videoToPeriod, addEvent:addEvent, detectTags:detectTags,
    detectRating:detectRating, voiceCommand:voiceCommand, csvText:csvText,
    ytText:ytText, vttText:vttText, edlText:edlText, markerCsvText:markerCsvText,
    rows:rows, setPeriod:setPeriod, renderAll:renderAll, save:save, prefs:function(){return prefs;},
    startRec:startRec, stopRec:stopRec };
})();`);

w.eval(code);
const T = w.__test;
const M = T.match();

console.log("\n== formato y parseo de tiempos ==");
ok("fmtMS(75)", T.fmtMS(75) === "01:15", T.fmtMS(75));
ok("fmtHMS(4523)", T.fmtHMS(4523) === "01:15:23", T.fmtHMS(4523));
ok("fmtTC 25fps", T.fmtTC(4523.4, 25) === "01:15:23:10", T.fmtTC(4523.4, 25));
ok("parseTime('12') = minuto 12", T.parseTime("12") === 720);
ok("parseTime('3:20')", T.parseTime("3:20") === 200);
ok("parseTime('1:05:20')", T.parseTime("1:05:20") === 3920);
ok("parseTime('1h5m20s')", T.parseTime("1h5m20s") === 3920);
ok("parseTime basura -> null", T.parseTime("abc") === null);

console.log("\n== sincronía partido <-> vídeo ==");
// El vídeo arranca 3:20 antes del pitido inicial; la 2ª parte empieza en 1:02:10
M.periods[0].videoStartSec = 200;     // 00:03:20
M.periods[1].videoStartSec = 3730;    // 01:02:10
ok("base de la 2ª parte = 2700s", T.periodBaseSec(1) === 2700);

const ev1 = T.addEvent("Buena transición por banda", 600, 0);   // min 10 de la 1ª
const ev2 = T.addEvent("Pérdida en salida de balón", 300, 1);   // min 5 de la 2ª
ok("minuto de partido ev1 = 11'", T.minLabel(0, 600) === "11'", T.minLabel(0, 600));
ok("minuto de partido ev2 = 51'", T.minLabel(1, 300) === "51'", T.minLabel(1, 300));
ok("vídeo ev1 = 00:13:20", T.fmtHMS(T.videoSecOf(ev1)) === "00:13:20", T.fmtHMS(T.videoSecOf(ev1)));
ok("vídeo ev2 = 01:07:10", T.fmtHMS(T.videoSecOf(ev2)) === "01:07:10", T.fmtHMS(T.videoSecOf(ev2)));
ok("descuento: 47' de la 1ª parte -> 45+2'", T.minLabel(0, 46 * 60 + 10) === "45+2'", T.minLabel(0, 46 * 60 + 10));
ok("descuento 2ª parte -> 90+3'", T.minLabel(1, 47 * 60 + 30) === "90+3'", T.minLabel(1, 47 * 60 + 30));

console.log("\n== conversión inversa (añadir por minuto de vídeo) ==");
let r = T.videoToPeriod(T.parseTime("1:07:10"));
ok("1:07:10 cae en la 2ª parte", r && r.p === 1, JSON.stringify(r));
ok("...en el minuto 51'", r && T.minLabel(r.p, r.e) === "51'", r && T.minLabel(r.p, r.e));
r = T.videoToPeriod(T.parseTime("13:20"));
ok("13:20 cae en la 1ª parte, min 11'", r && r.p === 0 && T.minLabel(r.p, r.e) === "11'");
r = T.videoToPeriod(60); // antes del pitido inicial
ok("antes del pitido inicial -> primera parte, min 1'", r && r.p === 0 && r.e === 0);

console.log("\n== cambiar la sincronía recalcula todo ==");
M.periods[1].videoStartSec = 3800;    // corriges 70s
ok("ev2 pasa a 01:08:20", T.fmtHMS(T.videoSecOf(ev2)) === "01:08:20", T.fmtHMS(T.videoSecOf(ev2)));
ok("su minuto de partido no cambia", T.minLabel(ev2.p, ev2.e) === "51'");
M.periods[1].videoStartSec = 3730;

console.log("\n== autoetiquetado y valoración ==");
ok("detecta 'transición'", T.detectTags("buena transicion tras robo").includes("transicion"));
ok("detecta 'balón parado'", T.detectTags("saque de esquina al primer palo").includes("abp"));
ok("valoración positiva", T.detectRating("muy bien resuelto") === 1);
ok("valoración negativa", T.detectRating("llego tarde y pierdo el balon") === -1);
ok("valoración neutra", T.detectRating("saque de banda") === 0);
ok("etiqueta aplicada al evento", ev1.tags.includes("transicion"), JSON.stringify(ev1.tags));

console.log("\n== comandos de voz ==");
const nBefore = M.events.length;
ok("'segunda parte' es comando", T.voiceCommand("segunda parte") === true);
ok("...y cambia de parte", M.activePeriod === 1);
ok("'minuto veintitrés' corrige la última", T.voiceCommand("minuto veintitres") === true);
ok("...la última queda en 23' y se mueve a la 1ª parte",
   M.events[M.events.length - 1].p === 0 &&
   T.minLabel(M.events[M.events.length - 1].p, M.events[M.events.length - 1].e) === "23'",
   T.minLabel(M.events[M.events.length - 1].p, M.events[M.events.length - 1].e));
ok("una frase normal no es comando", T.voiceCommand("centro al area y remate de cabeza") === false);
ok("no se han creado eventos con los comandos", M.events.length === nBefore);
T.voiceCommand("borra");
ok("'borra' elimina la última", M.events.length === nBefore - 1);

console.log("\n== exportaciones ==");
T.setPeriod(0);
M.home.name = "Mi equipo"; M.away.name = "Rival";
const e3 = T.addEvent("Remate a puerta desde la frontal", 1500, 0);
const csv = T.csvText();
ok("CSV con BOM", csv.charCodeAt(0) === 0xFEFF);
ok("CSV con cabecera de vídeo", csv.includes("Tiempo vídeo"));
ok("CSV con el tiempo real 00:28:20", csv.includes("00:28:20"), csv.split("\r\n")[1]);
const yt = T.ytText();
ok("capítulos YouTube empiezan en 0:00", yt.split("\n")[0].startsWith("0:00"), yt.split("\n")[0]);
ok("capítulo con marca de tiempo mm:ss", /^\d+:\d\d /.test(yt.split("\n")[1] || ""), yt.split("\n")[1]);
const vtt = T.vttText();
ok("VTT bien formado", vtt.startsWith("WEBVTT") && vtt.includes(" --> "));
const edl = T.edlText();
ok("EDL con cabecera", edl.startsWith("TITLE: Mi equipo vs Rival"));
ok("EDL con marcador", edl.includes("|M:"));
const mcsv = T.markerCsvText();
ok("CSV de marcadores con timecode", /\d\d:\d\d:\d\d:\d\d/.test(mcsv));
ok("filas ordenadas por minuto", T.rows().map(x => x.n).join(",") === T.rows().map((_, i) => i + 1).join(","));

console.log("\n== persistencia ==");
T.save(true);
const stored = JSON.parse(w.localStorage.getItem("acta.v2.matches"));
ok("se guarda en localStorage", Array.isArray(stored) && stored[0].events.length === M.events.length);

console.log("\n== interfaz ==");
const doc = w.document;
ok("se pintan las pestañas de parte", doc.querySelectorAll("#periodBar .pbtn").length >= 2);
ok("se pintan los atajos de etiqueta", doc.querySelectorAll("#quickTags .chip").length === M.tags.length);
ok("hay barra de contexto de equipo", doc.querySelectorAll("#ctxBar .chip").length === 3);
ok("la lista de eventos tiene tarjetas", (doc.querySelectorAll("#recentList .ev").length > 0));
ok("cada tarjeta muestra el tiempo de vídeo", doc.querySelector("#recentList .ev-vid").textContent.includes("▶"));
ok("aviso de sincronía oculto al estar sincronizado", doc.getElementById("syncWarn").classList.contains("hidden"));

console.log("\n== dictado: no duplicar notas por fragmentos crecientes ==");
function mkResult(text, isFinal) {
  var r = { isFinal: isFinal, length: 1 };
  r[0] = { transcript: text };
  return r;
}
var before = M.events.length;
T.startRec();
var rec1 = w.__lastRec;
rec1.onspeechstart();
// Chrome a veces reenvía el mismo índice de resultado marcado "final"
// varias veces con la transcripción cada vez más larga antes de cerrar
// la frase de verdad: esto no debe crear una jugada por cada envío.
rec1.onresult({ resultIndex: 0, results: [mkResult("buen", true)] });
rec1.onresult({ resultIndex: 0, results: [mkResult("buen cambio", true)] });
rec1.onresult({ resultIndex: 0, results: [mkResult("buen cambio de", true)] });
rec1.onresult({ resultIndex: 0, results: [mkResult("buen cambio de orientacion", true)] });
T.stopRec();
ok("una frase de un tirón crea una sola jugada", M.events.length === before + 1, M.events.length - before);
ok("...con la frase completa, no un fragmento", M.events[M.events.length - 1].note === "Buen cambio de orientacion",
   M.events[M.events.length - 1].note);

console.log("\n== dictado: varias frases seguidas sin soltar siguen creando jugadas separadas ==");
var before2 = M.events.length;
T.startRec();
var rec2 = w.__lastRec;
rec2.onspeechstart();
rec2.onresult({ resultIndex: 0, results: [mkResult("primera nota", true)] });
// un índice de resultado nuevo confirma de inmediato la frase anterior
rec2.onresult({ resultIndex: 1, results: [mkResult("primera nota", true), mkResult("segunda nota", true)] });
T.stopRec();
ok("dos frases sin soltar crean dos jugadas", M.events.length === before2 + 2, M.events.length - before2);
ok("...en orden, con ambos textos completos",
   M.events[M.events.length - 2].note === "Primera nota" && M.events[M.events.length - 1].note === "Segunda nota",
   JSON.stringify(M.events.slice(-2).map(function (e) { return e.note; })));

console.log("\n---------------------------------------");
console.log(passes + " correctas, " + fails + " fallos");
process.exit(fails ? 1 : 0);
