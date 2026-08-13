# Conecta este repositorio con GitHub y sube el código.
# El repositorio de Git ya está creado y con el primer commit hecho.
# Solo falta decirle dónde vive en GitHub y subirlo.
#
# Antes de ejecutarlo:
#   1. Instala Git desde https://git-scm.com/download/win
#   2. Crea el repositorio vacío en https://github.com/new
#      Nombre: acta-partido   ·   Public   ·   sin README, sin .gitignore, sin licencia

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  SUBIR ACTA DE PARTIDO A GITHUB" -ForegroundColor Cyan
Write-Host "  ------------------------------"
Write-Host ""

# ---- comprobaciones -------------------------------------------------------
try { git --version | Out-Null }
catch {
  Write-Host "  Git no está instalado." -ForegroundColor Red
  Write-Host "  Descárgalo de https://git-scm.com/download/win, reinicia esta ventana y vuelve."
  Read-Host "  Enter para salir"; exit 1
}

if (-not (Test-Path ".git")) {
  Write-Host "  Aquí no hay repositorio. ¿Estás en la carpeta acta-partido?" -ForegroundColor Red
  Read-Host "  Enter para salir"; exit 1
}

# ---- usuario --------------------------------------------------------------
$user = Read-Host "  Tu usuario de GitHub"
if ([string]::IsNullOrWhiteSpace($user)) { Write-Host "  Sin usuario no puedo seguir."; exit 1 }

$repo = Read-Host "  Nombre del repositorio [acta-partido]"
if ([string]::IsNullOrWhiteSpace($repo)) { $repo = "acta-partido" }

$url = "https://github.com/$user/$repo.git"
Write-Host ""
Write-Host "  Destino: $url" -ForegroundColor Yellow
Write-Host ""

# ---- identidad del commit -------------------------------------------------
# El primer commit se firmó con el correo de la cuenta. Si prefieres otro:
$mail = git config user.email
Write-Host "  Los commits se firman como: $(git config user.name) <$mail>"
$cambiar = Read-Host "  ¿Cambiarlo? (s/N)"
if ($cambiar -eq 's') {
  $n = Read-Host "  Nombre"; $m = Read-Host "  Correo"
  git config user.name $n; git config user.email $m
  git commit --amend --reset-author --no-edit | Out-Null
  Write-Host "  Actualizado."
}

# ---- conectar y subir -----------------------------------------------------
$existe = git remote 2>$null
if ($existe -contains "origin") { git remote set-url origin $url }
else { git remote add origin $url }

Write-Host ""
Write-Host "  Subiendo... se abrirá el navegador para que autorices." -ForegroundColor Cyan
Write-Host ""

git push -u origin main --follow-tags

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "  LISTO" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Código:  https://github.com/$user/$repo"
  Write-Host ""
  Write-Host "  Ahora, dos cosas en la web:"
  Write-Host "   1. Settings -> Pages -> Source: GitHub Actions"
  Write-Host "      La app quedará en https://$user.github.io/$repo/"
  Write-Host "   2. Actions -> Compilar APK de Android -> Run workflow"
  Write-Host "      Al terminar, descarga el artefacto acta-partido-apk"
  Write-Host ""
  Start-Process "https://github.com/$user/$repo/settings/pages"
} else {
  Write-Host ""
  Write-Host "  El push ha fallado." -ForegroundColor Red
  Write-Host "  Lo más habitual: el repositorio no existe todavía en GitHub,"
  Write-Host "  o el nombre no coincide. Créalo en https://github.com/new"
  Write-Host "  y vuelve a ejecutar este archivo."
}
Write-Host ""
Read-Host "  Enter para cerrar"
