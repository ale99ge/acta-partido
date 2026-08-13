# Guía: de tu carpeta a la app publicada

Todo lo que hay que hacer, en orden, sin pasos que no aporten nada. Cuarenta minutos la primera
vez; a partir de ahí, publicar un cambio son tres comandos.

Los comandos van en **PowerShell**. Ábrelo en la carpeta del proyecto: entra en `acta-partido`
desde el Explorador, haz clic en la barra de direcciones, escribe `powershell` y pulsa Enter.

---

## Antes de empezar: qué es cada cosa

**Git** es el programa que vive en tu PC y guarda la historia de tus archivos: cada vez que haces
un *commit*, congela una foto del proyecto a la que siempre puedes volver.

**GitHub** es la web donde subes esa historia. Además te da dos cosas gratis que aquí nos
interesan mucho: **Pages** (aloja la carpeta `www` con HTTPS, que es lo que exige el micrófono)
y **Actions** (ordenadores de Google/Microsoft que compilan el APK por ti, para que no tengas que
instalar Android Studio ni sus 8 GB).

Un **repositorio** es el proyecto: los archivos, su historia y la configuración.

---

## Paso 1 — Instalar Git

Descarga [git-scm.com/download/win](https://git-scm.com/download/win) y ejecuta el instalador.
Acepta todo lo que propone por defecto.

Cierra y vuelve a abrir PowerShell, y comprueba:

```powershell
git --version
```

Si responde con un número de versión, listo.

## Paso 2 — Presentarte

Git firma cada commit con tu nombre. Se hace una vez en la vida:

```powershell
git config --global user.name "Alejandro Giménez"
git config --global user.email "alex.gimenez.exposito@gmail.com"
git config --global init.defaultBranch main
```

## Paso 3 — Crear la cuenta y el repositorio en GitHub

1. Cuenta gratuita en [github.com/signup](https://github.com/signup) si no la tienes.
2. Con la sesión iniciada, entra en [github.com/new](https://github.com/new).
3. Rellena:
   - **Repository name:** `acta-partido`
   - **Description:** `Registro de jugadas de fútbol por voz con minuto de partido y de vídeo`
   - **Public** ← importante: GitHub Pages solo es gratis en repositorios públicos
   - **No marques** «Add a README», «Add .gitignore» ni «Choose a license»: ya los tienes en la carpeta
4. **Create repository**.

En la pantalla que sale, copia la URL que termina en `.git`. Será algo como
`https://github.com/tu-usuario/acta-partido.git`.

> **¿Público significa que cualquiera puede tocar mi app?** No. Cualquiera puede *leer* el código
> y proponer cambios, pero solo tú decides qué entra. Y tus datos de partidos nunca están en el
> repositorio: viven en tu dispositivo.

## Paso 4 — Primer commit y primera subida

En PowerShell, dentro de la carpeta `acta-partido`:

```powershell
git init
git add .
git commit -m "Acta de partido v2: registro por voz con sincronía de vídeo"
git remote add origin https://github.com/TU-USUARIO/acta-partido.git
git push -u origin main
```

Cambia `TU-USUARIO` por el tuyo. Se abrirá una ventana del navegador para autorizar: acepta.

Qué acaba de pasar, línea a línea:

| Comando | Qué hace |
|---|---|
| `git init` | Convierte la carpeta en un repositorio |
| `git add .` | Prepara todos los archivos (el `.gitignore` deja fuera lo que no debe subir) |
| `git commit -m "…"` | Congela esa foto con un mensaje que la describe |
| `git remote add origin …` | Le dice a Git dónde está tu repositorio en GitHub |
| `git push -u origin main` | Sube la historia. El `-u` hace que en adelante baste `git push` |

Recarga la página de GitHub: ahí está tu código, con el README como portada.

## Paso 5 — Activar GitHub Pages

1. En tu repositorio: **Settings** (arriba) → **Pages** (menú izquierdo).
2. En *Build and deployment* → *Source*, elige **GitHub Actions**.

Ya está. No hay que elegir carpeta: el workflow `pages.yml` publica `www` automáticamente.

Ve a la pestaña **Actions**: verás *Publicar la PWA en GitHub Pages* ejecutándose. Cuando el
punto se ponga verde (uno o dos minutos), tu app está en:

```
https://ale99ge.github.io/acta-partido/
```

Ese es el enlace que pasas al equipo. En Android: Chrome → menú → *Añadir a pantalla de inicio*.
En iPhone: Safari → *Compartir* → *Añadir a pantalla de inicio*.

## Paso 6 — Compilar el APK

1. Pestaña **Actions** → en la lista de la izquierda, **Compilar APK de Android**.
2. Botón **Run workflow** → **Run workflow**.
3. Tarda unos cinco minutos la primera vez (descarga el SDK de Android).
4. Cuando termine, entra en la ejecución y baja hasta **Artifacts**: descarga
   `acta-partido-apk`. Es un `.zip`; dentro está el `.apk`.

Para instalarlo en un móvil: pásalo por WhatsApp, Drive o cable, ábrelo desde el teléfono y
acepta el aviso de «orígenes desconocidos». La primera vez Android pregunta si permites instalar
apps desde esa aplicación (WhatsApp, Archivos…); es un permiso normal.

> Es un APK *de depuración*, firmado con la clave genérica de Android. Vale perfectamente para el
> equipo. Solo hace falta firma propia si algún día lo subes a Play.

## Paso 7 — Publicar un cambio

Esto es lo que harás a partir de ahora. Cada vez que toques algo:

```powershell
git add .
git commit -m "Corrige el desfase del reloj en la prórroga"
git push
```

La PWA se actualiza sola en un par de minutos —tus compañeros solo tienen que abrirla— y el APK
se recompila si tocaste `www`.

**Sobre los mensajes de commit:** describe *qué cambia y por qué*, no *qué archivos tocaste*.
«Corrige el desfase del reloj en la prórroga» sirve dentro de seis meses; «cambios en app.js», no.
La convención habitual en proyectos serios es empezar por el tipo:

```
feat: exporta marcadores para DaVinci
fix: el minuto de la 2ª parte no contaba el descuento
docs: añade la guía de instalación en iPhone
```

---

## Costumbres que te van a ahorrar disgustos

**Mira antes de subir.** `git status` te dice qué has tocado y `git diff` exactamente qué línea.
Diez segundos que evitan subir una prueba a medias.

**Un commit, una idea.** Es tentador acumular una semana de cambios en un commit gigante. El
problema llega cuando algo se rompe: con commits pequeños, `git log` te dice cuál fue.

**Ramas cuando experimentes.** Si vas a probar algo que puede salir mal, `git checkout -b prueba`
te da una copia paralela. Si funciona, la fusionas; si no, la borras y `main` sigue intacta.
Para cambios pequeños, trabajar directo en `main` es perfectamente razonable en un proyecto tuyo.

**No subas secretos.** Contraseñas o claves de firma no van al repositorio, ni siquiera privado:
para eso están *Settings → Secrets and variables → Actions*.

**Etiqueta las versiones que repartas.** Cuando pases un APK al equipo:

```powershell
git tag -a v2.0 -m "Primera versión con sincronía de vídeo"
git push --tags
```

Así sabes exactamente qué código tiene cada uno cuando alguien reporte un fallo.

---

## Si algo sale mal

| Síntoma | Causa y solución |
|---|---|
| `git: command not found` | PowerShell abierto antes de instalar Git. Ciérralo y ábrelo otra vez |
| `remote origin already exists` | Ya ejecutaste ese comando. Usa `git remote set-url origin URL` |
| `failed to push some refs` | Hay algo en GitHub que no tienes en local. `git pull --rebase` y vuelve a subir |
| Pages da 404 | El workflow no ha acabado, o *Source* no está en **GitHub Actions**. Revisa Actions |
| El APK falla al compilar | Abre la ejecución en Actions y busca la línea roja; pásamela y lo miramos |
| El micrófono no arranca en el móvil | Ajustes del sitio en Chrome → permitir micrófono. Debe ser HTTPS, no `http://` |

---

## Y la tercera opción que preguntabas

En la pregunta anterior, *«prepárame el paquete»* era la vía sin Git: te dejaba un `.zip` y lo
subías arrastrándolo a la web de GitHub (*Add file → Upload files*). Funciona, y para una sola vez
es más rápido.

No te la recomiendo ahora que has decidido aprender a hacerlo bien: subir por la web no guarda
historia real —cada subida es un commit ciego, sin poder comparar ni volver atrás con criterio—
y te obliga a repetir el arrastre entero cada vez que cambies una línea. Los veinte minutos de
instalar Git se amortizan en la segunda modificación.
