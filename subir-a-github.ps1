# Conecta este repositorio con GitHub y sube el codigo.
# El repositorio de Git ya esta creado y con los commits hechos:
# solo falta decirle donde vive en GitHub y subirlo.
#
# Ejecutalo con doble clic en Subir-a-GitHub.cmd (no en este archivo).
#
# Antes:
#   1. Instala Git desde https://git-scm.com/download/win
#   2. Crea el repositorio vacio en https://github.com/new
#      Nombre: acta-partido - Public - sin README, sin .gitignore, sin licencia

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Pausa($codigo) {
  Write-Host ""
  Read-Host "  Pulsa Enter para cerrar" | Out-Null
  exit $codigo
}

try {

  Set-Location $PSScriptRoot

  Write-Host ""
  Write-Host "  SUBIR ACTA DE PARTIDO A GITHUB" -ForegroundColor Cyan
  Write-Host "  ------------------------------"
  Write-Host ""

  # ---- comprobaciones -----------------------------------------------------
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    Write-Host "  Git no esta instalado, o esta ventana se abrio antes de instalarlo." -ForegroundColor Red
    Write-Host "  Descargalo de https://git-scm.com/download/win, cierra esta ventana"
    Write-Host "  y vuelve a ejecutar el archivo."
    Pausa 1
  }
  Write-Host "  Git detectado: $(git --version)" -ForegroundColor DarkGray

  if (-not (Test-Path ".git")) {
    Write-Host "  Aqui no hay repositorio. Comprueba que este archivo esta" -ForegroundColor Red
    Write-Host "  dentro de la carpeta acta-partido."
    Pausa 1
  }

  $pendientes = git status --porcelain
  if ($pendientes) {
    Write-Host ""
    Write-Host "  Hay cambios sin guardar en el historial:" -ForegroundColor Yellow
    $pendientes | ForEach-Object { Write-Host "    $_" }
    $r = Read-Host "  Los incluyo en un commit ahora? (S/n)"
    if ($r -ne 'n') {
      git add .
      git commit -m "chore: cambios locales antes de la primera subida" | Out-Null
      Write-Host "  Guardados." -ForegroundColor Green
    }
  }

  # ---- datos --------------------------------------------------------------
  Write-Host ""
  $user = Read-Host "  Tu usuario de GitHub"
  if ([string]::IsNullOrWhiteSpace($user)) {
    Write-Host "  Sin usuario no puedo continuar." -ForegroundColor Red
    Pausa 1
  }
  $user = $user.Trim()

  $repo = Read-Host "  Nombre del repositorio [acta-partido]"
  if ([string]::IsNullOrWhiteSpace($repo)) { $repo = "acta-partido" }
  $repo = $repo.Trim()

  $url   = "https://github.com/$user/$repo.git"
  $web   = "https://github.com/$user/$repo"
  $pages = "https://$user.github.io/$repo/"

  Write-Host ""
  Write-Host "  Destino: $url" -ForegroundColor Yellow

  # ---- identidad de los commits -------------------------------------------
  Write-Host ""
  Write-Host "  Los commits van firmados como: $(git config user.name) <$(git config user.email)>"
  $cambiar = Read-Host "  Cambiarlo? (s/N)"
  if ($cambiar -eq 's') {
    $n = Read-Host "  Nombre"
    $m = Read-Host "  Correo"
    git config user.name $n
    git config user.email $m
    Write-Host "  Actualizado para los proximos commits." -ForegroundColor Green
  }

  # ---- conectar y subir ---------------------------------------------------
  $remotos = @(git remote)
  if ($remotos -contains "origin") { git remote set-url origin $url }
  else { git remote add origin $url }

  Write-Host ""
  Write-Host "  Subiendo. Puede abrirse el navegador para que autorices el acceso." -ForegroundColor Cyan
  Write-Host ""

  git push -u origin main --follow-tags

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  El push ha fallado." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Causas mas habituales:"
    Write-Host "   - El repositorio todavia no existe en GitHub. Crealo vacio en"
    Write-Host "     https://github.com/new  con el nombre exacto: $repo"
    Write-Host "   - El usuario o el nombre del repositorio no coinciden."
    Write-Host "   - Marcaste 'Add a README' al crearlo: en ese caso ejecuta"
    Write-Host "     git pull --rebase origin main   y vuelve a intentarlo."
    Pausa 1
  }

  Write-Host ""
  Write-Host "  LISTO" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Codigo:  $web"
  Write-Host ""
  Write-Host "  Quedan dos cosas, en la web:"
  Write-Host "   1. Settings > Pages > Source: GitHub Actions"
  Write-Host "      La app quedara publicada en:"
  Write-Host "      $pages" -ForegroundColor Cyan
  Write-Host "   2. Actions > Compilar APK de Android > Run workflow"
  Write-Host "      Al terminar, descarga el artefacto acta-partido-apk"
  Write-Host ""
  Write-Host "  Te abro la pagina de Pages..."
  Start-Sleep -Seconds 2
  Start-Process "$web/settings/pages"

  Pausa 0

} catch {
  Write-Host ""
  Write-Host "  ERROR INESPERADO" -ForegroundColor Red
  Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  En la linea $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor DarkGray
  Pausa 1
}
