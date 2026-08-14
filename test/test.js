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

// SpeechRecognition falso. stop()/abort() disparan onend de forma SÍNCRONA,
// así que toda la secuencia stopRec -> onend -> commit ocurre dentro de la
// llamada y los tests del modo "mantener pulsado" no necesitan temporizadores.
w.__recs = [];
function FakeSpeechRecognition() {
  this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
  this.started = false; this.aborted = false;
  this.onstart = null; this.onspeechstart = null; this.onresult = null; this.onerror = null; this.onend = null;
  w.__lastRec = this; w.__recs.push(this);
}
FakeSpeechRecognition.prototype.start = function () {
  if (this.started) throw new Error("InvalidStateError");
  this.started = true;
  if (this.onstart) this.onstart();
};
FakeSpeechRecognition.prototype.stop = function () {
  if (!this.started) return;
  this.started = false;
  if (this.onend) this.onend();
};
FakeSpeechRecognition.prototype.abort = function () {
  this.aborted = true; this.started = false;
  if (this.onend) this.onend();
};
// el motor corta la sesión por su cuenta (Chrome lo hace tras un silencio):
// la sesión queda cerrada y la app decide si rearranca
FakeSpeechRecognition.prototype.endSession = function () {
  this.started = false;
  if (this.onend) this.onend();
};
w.SpeechRecognition = FakeSpeechRecognition;
w.confirm = () => true;
w.alert = () => {};
w.URL.createObjectURL = () => "blob:x";
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () { w.__lastDownload = this.download; };
delete w.navigator.serviceWorker;

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
    startRec:startRec, stopRec:stopRec, stopRecNow:stopRecNow,
    pendingText:pendingText, commitPending:commitPending,
    isListening:function(){return listening;},
    setNotePause:function(n){ NOTE_PAUSE_MS = n; } };
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

// ---- utilidades para simular el motor de reconocimiento ----
function mkResult(text, isFinal) {
  const r = { isFinal: isFinal, length: 1 };
  r[0] = { transcript: text };
  return r;
}
// entrega acumulativa, como hace Chrome: la lista lleva todo lo de la sesión
function feed(rec, ...results) {
  rec.onresult({ resultIndex: 0, results: results });
}
const notes = () => M.events.map(e => e.note);
const lastNote = () => M.events[M.events.length - 1];
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async function () {

console.log("\n== dictado, modo mantener pulsado: TODO va a una sola jugada ==");
T.prefs().micMode = "hold";
T.prefs().autoSave = true;

let n = M.events.length;
T.startRec();
let r1 = w.__lastRec;
r1.onspeechstart();
// Chrome reenvía el mismo índice marcado "final" con el texto cada vez más largo
feed(r1, mkResult("buen", true));
feed(r1, mkResult("buen cambio", true));
feed(r1, mkResult("buen cambio de orientacion", true));
T.stopRec();
ok("frase de un tirón = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...con la frase completa", lastNote().note === "Buen cambio de orientacion", lastNote().note);

// S1: Chrome cierra un "final" en cada micropausa dentro de la MISMA frase
n = M.events.length;
T.startRec();
let r2 = w.__lastRec;
r2.onspeechstart();
feed(r2, mkResult("buen", true));
feed(r2, mkResult("buen", true), mkResult("cambio de orientacion", true));
T.stopRec();
ok("frase troceada por el motor = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...juntando los dos trozos", lastNote().note === "Buen cambio de orientacion", lastNote().note);

// "dure lo que dure": el motor corta la sesión varias veces y se rearranca sola
n = M.events.length;
T.startRec();
let r3 = w.__lastRec;
r3.onspeechstart();
feed(r3, mkResult("primera parte de la jugada", true));
r3.endSession();                               // corte del motor -> rearranque
feed(r3, mkResult("con una pausa larga", true));
r3.endSession();                               // otro corte del motor
feed(r3, mkResult("y el remate final", true));
T.stopRec();
ok("varios cortes del motor = 1 sola jugada", M.events.length === n + 1, M.events.length - n);
ok("...con las tres partes seguidas",
   lastNote().note === "Primera parte de la jugada con una pausa larga y el remate final", lastNote().note);

// el mismo corte, pero con un motor que tras rearrancar SIGUE entregando la
// lista acumulada: el texto anterior no puede contarse dos veces
n = M.events.length;
T.startRec();
let r3b = w.__lastRec;
r3b.onspeechstart();
feed(r3b, mkResult("primera parte", true));
r3b.endSession();                              // corte y rearranque
feed(r3b, mkResult("primera parte", true), mkResult("segunda parte", true));
T.stopRec();
ok("tras rearrancar con lista acumulada = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...sin repetir el primer trozo", lastNote().note === "Primera parte segunda parte", lastNote().note);

// pausa larga pensando: el motor corta y rearranca VARIAS veces seguidas y en
// cada una reenvía lo mismo. El texto no puede acumularse una vez por corte.
n = M.events.length;
T.startRec();
let r3c = w.__lastRec;
r3c.onspeechstart();
feed(r3c, mkResult("primera frase larga", true));
for (let i = 0; i < 4; i++) {                  // cuatro cortes durante la pausa
  r3c.endSession();
  feed(r3c, mkResult("primera frase larga", true));
}
feed(r3c, mkResult("primera frase larga", true), mkResult("segunda frase", true));
T.stopRec();
ok("pausa larga con varios cortes = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...sin repetir el texto por cada corte",
   lastNote().note === "Primera frase larga segunda frase", lastNote().note);

// EL FALLO REAL: hay motores que en cada resultado nuevo reenvían TODO lo dicho
// hasta ese momento, no solo el trozo nuevo. Sumarlos repetía el texto una vez
// por pausa, dejando el mensaje completo al final precedido de repeticiones.
n = M.events.length;
T.startRec();
let r3d = w.__lastRec;
r3d.onspeechstart();
r3d.onresult({ resultIndex: 0, results: [mkResult("buen cambio de orientacion", true)] });
r3d.onresult({ resultIndex: 1, results: [
  mkResult("buen cambio de orientacion", true),
  mkResult("buen cambio de orientacion y remate", true)] });
r3d.onresult({ resultIndex: 2, results: [
  mkResult("buen cambio de orientacion", true),
  mkResult("buen cambio de orientacion y remate", true),
  mkResult("buen cambio de orientacion y remate de cabeza", true)] });
T.stopRec();
ok("motor que reenvía todo lo dicho = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...sin repetir el texto en cada pausa",
   lastNote().note === "Buen cambio de orientacion y remate de cabeza", lastNote().note);

// el motor añade mayúsculas y puntuación al dar la frase por definitiva:
// la comparación no puede ser literal o lo tomaría por texto distinto
n = M.events.length;
T.startRec();
let r3e = w.__lastRec;
r3e.onspeechstart();
feed(r3e, mkResult("centro al area", true));
feed(r3e, mkResult("Centro al área, y remate.", true));
T.stopRec();
ok("acentos y puntuación no duplican el texto", M.events.length === n + 1, M.events.length - n);
ok("...se queda con la versión definitiva",
   lastNote().note === "Centro al área, y remate.", lastNote().note);

// un error recuperable no puede cerrar la nota mientras se mantiene pulsado
n = M.events.length;
T.startRec();
let r4 = w.__lastRec;
r4.onspeechstart();
feed(r4, mkResult("antes del fallo", true));
r4.onerror({ error: "aborted" });
r4.endSession();
feed(r4, mkResult("despues del fallo", true));
T.stopRec();
ok("un 'aborted' no parte la jugada", M.events.length === n + 1, M.events.length - n);
ok("...y conserva todo el texto",
   lastNote().note === "Antes del fallo despues del fallo", lastNote().note);

n = M.events.length;
T.startRec();
let r5 = w.__lastRec;
r5.onspeechstart();
feed(r5, mkResult("hablo", true));
r5.onerror({ error: "no-speech" });            // silencio: no debe cerrar nada
feed(r5, mkResult("hablo", true), mkResult("y sigo", true));
T.stopRec();
ok("un 'no-speech' no parte la jugada", M.events.length === n + 1, M.events.length - n);
ok("...y sigue acumulando", lastNote().note === "Hablo y sigo", lastNote().note);

console.log("\n== dictado: robustez frente a entregas raras del motor ==");
// S2: el motor reenvía resultados ya vistos, con el índice hacia atrás
n = M.events.length;
T.startRec();
let r6 = w.__lastRec;
r6.onspeechstart();
r6.onresult({ resultIndex: 1, results: [mkResult("primera", true), mkResult("segunda", true)] });
r6.onresult({ resultIndex: 0, results: [mkResult("primera", true), mkResult("segunda", true)] });
T.stopRec();
ok("reenvío con índice hacia atrás no duplica", M.events.length === n + 1, M.events.length - n);
ok("...sin repetir texto", lastNote().note === "Primera segunda", lastNote().note);

n = M.events.length;
T.startRec();
let r7 = w.__lastRec;
r7.onspeechstart();
for (let i = 0; i < 5; i++) feed(r7, mkResult("centro al area", true));
T.stopRec();
ok("el mismo resultado 5 veces = 1 jugada", M.events.length === n + 1, M.events.length - n);
ok("...sin texto repetido", lastNote().note === "Centro al area", lastNote().note);

n = M.events.length;
T.startRec();
let r8 = w.__lastRec;
r8.onspeechstart();
feed(r8, mkResult("remate de", false));         // parcial: no debe guardarse
feed(r8, mkResult("remate de cabeza", true));
T.stopRec();
ok("los parciales no se guardan aparte", M.events.length === n + 1, M.events.length - n);
ok("...solo cuenta el final", lastNote().note === "Remate de cabeza", lastNote().note);

// motor no acumulativo (algunos WebView de Android): reusa el índice 0
n = M.events.length;
T.startRec();
let r9 = w.__lastRec;
r9.onspeechstart();
feed(r9, mkResult("uno", true));
feed(r9, mkResult("dos", true));                // mismo índice, texto distinto
T.stopRec();
ok("motor no acumulativo no pierde texto", lastNote().note === "Uno dos", lastNote().note);

// dos startRec seguidos no pueden dejar una instancia huérfana emitiendo
n = M.events.length;
T.startRec();
const huerfana = w.__lastRec;
T.stopRecNow();
T.startRec();
const viva = w.__lastRec;
ok("la instancia previa queda desarmada", huerfana.onresult === null && huerfana !== viva);
viva.onspeechstart();
feed(viva, mkResult("solo esta cuenta", true));
T.stopRec();
ok("una sola jugada pese al doble arranque", M.events.length === n + 1, M.events.length - n);

n = M.events.length;
T.startRec();
let r10 = w.__lastRec;
r10.onspeechstart();
T.stopRec();                                    // sin haber dicho nada
ok("sesión vacía no crea jugada", M.events.length === n, M.events.length - n);

console.log("\n== dictado: el minuto se sella al EMPEZAR a hablar ==");
T.setPeriod(0);
M.periods[0].elapsedSec = 600; M.periods[0].running = false;   // minuto 10
n = M.events.length;
T.startRec();
let r11 = w.__lastRec;
r11.onspeechstart();                            // sello aquí: 600 s
M.periods[0].elapsedSec = 630;                  // pasan 30 s dictando
r11.onspeechstart();                            // micropausa: NO debe pisar el sello
feed(r11, mkResult("jugada larga", true));
T.stopRec();
ok("conserva el minuto del primer habla", lastNote().e === 600, lastNote().e);

M.periods[0].elapsedSec = 900;                  // minuto 15
n = M.events.length;
T.startRec();
let r12 = w.__lastRec;
r12.onspeechstart();
M.periods[0].elapsedSec = 950;
feed(r12, mkResult("marca", true));             // comando de voz
T.stopRec();
ok("el comando 'marca' no crea nota de texto", lastNote().note === "Marca", lastNote().note);
ok("...y conserva el minuto del habla", lastNote().e === 900, lastNote().e);

console.log("\n== dictado, modo pulsar: frases separadas = jugadas separadas ==");
T.prefs().micMode = "toggle";
T.setNotePause(40);

// troceo del motor por debajo del umbral: sigue siendo una sola jugada
n = M.events.length;
T.startRec();
let r13 = w.__lastRec;
r13.onspeechstart();
feed(r13, mkResult("centro al area", true));
await sleep(15);
feed(r13, mkResult("centro al area", true), mkResult("y remate de cabeza", true));
await sleep(90);
ok("micropausa corta no parte la jugada", M.events.length === n + 1, M.events.length - n);
ok("...con la frase entera", lastNote().note === "Centro al area y remate de cabeza", lastNote().note);

// pausa larga de verdad: dos jugadas
M.periods[0].elapsedSec = 1200;
feed(r13, mkResult("centro al area", true), mkResult("y remate de cabeza", true),
          mkResult("segunda jugada distinta", true));
await sleep(90);
ok("tras una pausa larga se abre otra jugada", M.events.length === n + 2, M.events.length - n);
ok("...con su propio texto", lastNote().note === "Segunda jugada distinta", lastNote().note);
ok("...y su propio minuto", lastNote().e === 1200, lastNote().e);

// tercera frase, para confirmar que la cadena sigue funcionando
feed(r13, mkResult("centro al area", true), mkResult("y remate de cabeza", true),
          mkResult("segunda jugada distinta", true), mkResult("tercera jugada", true));
await sleep(90);
ok("tres frases con pausas = tres jugadas", M.events.length === n + 3, M.events.length - n);
ok("...la última es la tercera", lastNote().note === "Tercera jugada", lastNote().note);
T.stopRec();

// un onresult repetido sin texto nuevo no debe retrasar el cierre
n = M.events.length;
T.startRec();
let r14 = w.__lastRec;
r14.onspeechstart();
feed(r14, mkResult("nota que se repite", true));
for (let i = 0; i < 4; i++) { await sleep(12); feed(r14, mkResult("nota que se repite", true)); }
await sleep(50);
ok("reenvíos sin texto nuevo no retrasan el cierre", M.events.length === n + 1, M.events.length - n);
T.stopRec();

// tras guardar una nota el motor corta y rearranca, pero sigue entregando la
// lista acumulada: la nota siguiente NO puede repetir lo ya guardado
n = M.events.length;
T.startRec();
let r14b = w.__lastRec;
r14b.onspeechstart();
feed(r14b, mkResult("nota uno", true));
await sleep(90);
ok("se guarda la primera nota", M.events.length === n + 1, M.events.length - n);
r14b.endSession();                             // corte y rearranque del motor
feed(r14b, mkResult("nota uno", true), mkResult("nota dos", true));
await sleep(90);
ok("la nota siguiente no repite lo ya guardado", M.events.length === n + 2, M.events.length - n);
ok("...y lleva solo su texto", lastNote().note === "Nota dos", lastNote().note);
T.stopRec();

// mismo motor acumulativo, pero en modo varias notas: tras guardar una nota,
// la siguiente no puede arrastrar el texto que ya se guardó
n = M.events.length;
T.startRec();
let r14c = w.__lastRec;
r14c.onspeechstart();
r14c.onresult({ resultIndex: 0, results: [mkResult("primera jugada", true)] });
await sleep(90);
ok("motor acumulativo: se guarda la primera", M.events.length === n + 1, M.events.length - n);
r14c.onresult({ resultIndex: 1, results: [
  mkResult("primera jugada", true),
  mkResult("primera jugada segunda jugada", true)] });
await sleep(90);
ok("motor acumulativo: la segunda es una nota aparte", M.events.length === n + 2, M.events.length - n);
ok("...y no arrastra la primera", lastNote().note === "Segunda jugada", lastNote().note);
T.stopRec();

// un temporizador de la sesión anterior no puede contaminar la siguiente
n = M.events.length;
T.startRec();
let r15 = w.__lastRec;
r15.onspeechstart();
feed(r15, mkResult("sesion uno", true));
T.stopRec();
T.startRec();
let r16 = w.__lastRec;
r16.onspeechstart();
feed(r16, mkResult("sesion dos", true));
await sleep(90);
T.stopRec();
ok("parar y arrancar de nuevo da 2 jugadas", M.events.length === n + 2, M.events.length - n);
ok("...sin mezclar los textos",
   notes().slice(-2).join("|") === "Sesion uno|Sesion dos", notes().slice(-2).join("|"));

console.log("\n---------------------------------------");
console.log(passes + " correctas, " + fails + " fallos");
process.exit(fails ? 1 : 0);

})();
