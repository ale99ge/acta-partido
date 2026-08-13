# Contexto del proyecto

Carpeta principal del proyecto **Acta de Partido**, tanto para Claude como para Git.
Cualquier trabajo sobre la aplicación se hace aquí, no en la carpeta de salidas de la conversación.

## Qué es

Aplicación para registrar jugadas por voz mientras se revisa la grabación de un partido de
fútbol. Su rasgo distintivo es el **doble reloj**: cada jugada guarda el minuto de partido y el
minuto real del vídeo original, que empieza antes del pitido inicial y tiene descanso entre partes.

El usuario, Alejandro, es jugador y analiza sus propios partidos. Método de trabajo: una primera
pasada a velocidad normal dictando lo que ve, y una segunda a 0,5x solo sobre los minutos marcados.

## Estado

- Aplicación funcional y probada (51 comprobaciones automáticas, todas en verde).
- Repositorio Git iniciado, con tres commits y la etiqueta `v2.0`.
- **Pendiente:** el `git push` inicial a GitHub. Requiere que Alejandro cree el repositorio
  y autorice con su cuenta. Se hace con `Subir-a-GitHub.cmd`.
- Distribución elegida: PWA en GitHub Pages + APK por GitHub Actions. Play Store descartada
  de momento, a revisar si el equipo adopta la herramienta.

## Estructura

```
www/                    la aplicación (es lo único que se publica en Pages)
  index.html            estructura
  styles.css            estilos
  app.js                toda la lógica, en un único IIFE sin dependencias
  sw.js                 service worker
  manifest.webmanifest  metadatos de instalación
test/test.js            pruebas con jsdom
.github/workflows/      pages.yml publica la PWA, android.yml compila el APK
capacitor.config.json   empaquetado Android
Acta-PC.cmd             lanzador de Windows (llama a servidor.ps1)
Subir-a-GitHub.cmd      lanzador del script de subida
GUIA-GITHUB.md          guía de Git y GitHub escrita para Alejandro
```

## Decisiones tomadas

- **Capacitor + web, no Flutter ni React Native.** La app es formulario, cronómetro y
  almacenamiento; el dictado lo resuelve el WebView. Se replantea solo si hace falta reproducir
  el vídeo dentro de la app con *scrubbing* fino.
- **Sin framework ni compilación.** `app.js` es JavaScript plano en un IIFE. Se puede abrir en
  cualquier navegador sin `npm run build`. Mantenerlo así salvo motivo de peso.
- **Los eventos guardan `{parte, segundos dentro de la parte}`**, nunca tiempos absolutos.
  El minuto de partido y el de vídeo se derivan al vuelo. Por eso, al corregir la sincronía,
  todas las jugadas ya registradas se recalculan solas. No romper esta propiedad.
- **El minuto se sella al empezar a hablar** (`onspeechstart`), no al terminar la frase.
  Es la característica que más valor da en uso real.
- **iOS no tiene Web Speech API.** La app lo detecta y ofrece la nota manual con el minuto ya
  sellado, para dictar con el micrófono del teclado del sistema.

## Convenciones

- Todo en español: interfaz, comentarios del código, mensajes de commit y documentación.
- Mensajes de commit con prefijo: `feat:`, `fix:`, `docs:`, `chore:`. Describen qué cambia y
  por qué, no qué archivos se tocaron.
- Los `.ps1` van en **UTF-8 con BOM y CRLF**, los `.cmd` en CRLF sin BOM. Si no, Windows
  PowerShell falla al analizarlos y la ventana se cierra sin mensaje. Lo fija `.gitattributes`.
- Antes de dar por buena cualquier modificación de `app.js`: `npm test`.

## Comandos

```bash
npm test               # 51 comprobaciones (necesita jsdom)
npm run serve          # servidor local en http://localhost:8777
npx cap sync android   # sincronizar el proyecto nativo
```

## Ideas descartadas o aparcadas

- **Play Store.** 25 $ y trámites (política de privacidad, seguridad de datos, clasificación).
  La vía sensata sería *pruebas internas*: hasta 100 personas, sin el requisito de 12 testers
  durante 14 días que solo aplica a producción. Se retomará si el equipo usa la app.
- **Electron para el escritorio.** Descartado: Chromium sin la clave de Google no tiene
  reconocimiento de voz, así que rompería justo la función principal. El servidor local en
  PowerShell más la instalación como PWA cumplen mejor.
- **Verificación de desarrollador de Android.** Desde el 30 de septiembre de 2026 los
  dispositivos certificados solo instalarán apps de desarrolladores verificados; empieza por
  Brasil, Indonesia, Singapur y Tailandia, y se extiende globalmente en 2027. Repartir el APK a
  mano funciona hoy en España, pero tiene fecha de caducidad.
