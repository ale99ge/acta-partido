# Acta de Partido

Registro de jugadas por voz mientras ves la grabación de un partido, con **doble reloj**:
el minuto de partido y el **minuto real del vídeo original**, que empieza antes del pitido
inicial y tiene descanso entre partes.

Funciona en PC y en Android, sin conexión, y no manda tus datos a ningún sitio.

- **Web:** `https://ale99ge.github.io/acta-partido/`
- **APK:** pestaña *Actions* → *Compilar APK de Android* → artefacto `acta-partido-apk`
- **PC:** doble clic en `Acta-PC.cmd`

---

## Por qué el doble reloj

Anotar «minuto 63» sirve para hablar del partido, pero no para encontrar la jugada en el
vídeo: la grabación arrancó antes del pitido inicial y el descanso mete otro desfase.

En **Ajustes → Sincronía con el vídeo** indicas, para cada parte, el instante del vídeo en
el que suena el pitido:

```
1ª parte   duración 45   empieza en el vídeo   3:20
2ª parte   duración 45   empieza en el vídeo   1:02:10
```

A partir de ahí:

- El minuto **11'** de la 1ª parte aparece también como **00:13:20** de vídeo.
- El minuto **51'** (min 6 de la 2ª) aparece como **01:07:10**.
- El descuento se muestra como `45+2'` o `90+3'`.
- Si te equivocaste al sincronizar, cambias el número y **todas las jugadas ya registradas se
  recalculan solas**: el minuto de partido no se toca, el de vídeo se ajusta.
- *Añadir por minuto de vídeo* hace la conversión al revés: escribes `1:12:40` y te dice a qué
  parte y minuto corresponde.

Formatos admitidos: `3:20`, `1:02:10`, `90` (= minuto 90) y `1h5m20s`.

---

## Uso durante el partido

1. Pulsa ▶ al empezar cada parte (o `Espacio`). Si el reloj se desvía: `−10s` / `+10s` o `⏱ fijar`.
2. Pulsa el micrófono y describe lo que ves. **El minuto se sella en cuanto empiezas a hablar**,
   no cuando terminas, así que puedes explicarte con calma.
3. La nota se etiqueta y se valora sola según lo que dices; se corrige después en dos toques.

**Comandos de voz** (no se guardan como nota): `pausa`, `sigue`, `segunda parte`, `primera parte`,
`borra`, `marca`, `minuto veintitrés`, `local`, `visitante`, `sin equipo`, `más diez`, `menos diez`.

**Teclado:** `Espacio` reloj · `V` micrófono · `M` marcar sin texto · `Esc` cerrar.

**Contexto:** si eliges equipo y jugador antes de dictar, se aplican a todo lo que registres hasta
que lo cambies. Si no, la app intenta deducirlos del nombre o del dorsal que menciones.

---

## Exportar

| Formato | Para qué |
|---|---|
| CSV / Excel | Tabla con minuto de partido, tiempo de vídeo, equipo, jugador, etiquetas y nota |
| Capítulos WebVTT | Reproductores de vídeo compatibles |
| Capítulos YouTube | Pegar en la descripción si subes el partido |
| Marcadores CSV | Importar en editores |
| EDL | Marcadores en DaVinci Resolve, con color según la valoración |
| JSON | Copia de seguridad y traspaso entre dispositivos |

---

## Instalación

### Windows

Doble clic en **`Acta-PC.cmd`**: levanta un servidor local y abre la app en Edge o Chrome.
Deja la consola abierta mientras la uses.

Para tenerla como aplicación de escritorio: con la app abierta, menú `⋯` → **Instalar Acta de
Partido**. Queda en el menú Inicio, con icono y sin consola.

> El servidor local hace falta porque el navegador solo concede el micrófono a páginas servidas
> por `http`, no a archivos abiertos con doble clic (`file://`).

### Android

**Como PWA:** abre la URL de GitHub Pages en Chrome → menú → *Añadir a pantalla de inicio*.

**Como APK:** pestaña *Actions* del repositorio → *Compilar APK de Android* → *Run workflow*.
Al terminar, descarga el artefacto e instálalo permitiendo «orígenes desconocidos».

### iPhone

Safari abre la app y todo funciona **salvo el dictado automático**: Apple no implementa la
Web Speech API. La app lo detecta y cambia el botón grande por una nota con el minuto ya sellado,
para que dictes con el **micrófono del teclado de iOS**. El resultado es casi el mismo, con un
toque de más.

Para instalarla: Safari → *Compartir* → *Añadir a pantalla de inicio*.

---

## Desarrollo

```bash
npm install
npm run serve          # servidor local en http://localhost:8777
npm test               # 51 comprobaciones

npx cap add android    # crear el proyecto nativo
npx cap sync android
npx cap open android   # abrir en Android Studio
```

Las pruebas cubren formatos y parseo de tiempos, la conversión partido↔vídeo en ambos sentidos,
descuentos, el recálculo al cambiar la sincronía, autoetiquetado, comandos de voz, las cinco
exportaciones, la persistencia y el renderizado de la interfaz.

### Estructura

```
www/                    la app (es lo único que se publica en Pages)
  index.html            estructura
  styles.css            estilos
  app.js                toda la lógica
  sw.js                 service worker (funcionamiento sin conexión)
  manifest.webmanifest  metadatos de instalación
test/test.js            pruebas con jsdom
.github/workflows/      publicación de la PWA y compilación del APK
capacitor.config.json   empaquetado Android
Acta-PC.cmd             lanzador de Windows
servidor.ps1            servidor local mínimo en PowerShell
```

### Por qué Capacitor y no Flutter o React Native

El 95 % de esta app es formulario, cronómetro y almacenamiento, y la única pieza nativa —el
dictado— la resuelve el propio WebView. Con Capacitor hay un solo código para PC, Android e iOS,
y la puerta abierta a plugins nativos si hicieran falta.

Flutter o React Native tendrían sentido con reproducción de vídeo con *scrubbing* fino, procesado
en segundo plano o gráficos exigentes. Hoy solo añadirían un *toolchain* que mantener.

---

## Privacidad

Todo se guarda en el dispositivo (`localStorage`); nada viaja a ningún servidor.
**Excepción:** Chrome procesa el reconocimiento de voz en servidores de Google, así que el audio
del dictado sí sale del equipo. Para comentar un partido es irrelevante, pero conviene saberlo.

Exporta el `.json` de vez en cuando: si borras los datos del navegador, se pierden las jugadas.

## Licencia

MIT — ver [LICENSE](LICENSE).
