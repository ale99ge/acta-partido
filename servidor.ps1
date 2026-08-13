# Servidor local mínimo para Acta de Partido.
# Sirve la carpeta www en http://localhost:8777 sin instalar nada.
# Hace falta porque el navegador solo concede el micrófono a páginas servidas
# por http/https, no a archivos abiertos con doble clic (file://).

param([int]$Port = 8777)

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'www'
if (-not (Test-Path $root)) { Write-Host "No encuentro la carpeta www"; exit 1 }

# Si el puerto está ocupado, prueba los siguientes
for ($p = $Port; $p -lt ($Port + 20); $p++) {
  try {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $Port = $p
    break
  } catch { $listener = $null }
}
if (-not $listener) { Write-Host "No hay puertos libres"; exit 1 }

$url = "http://localhost:$Port/index.html"
Write-Host "  Servidor activo en $url"
Write-Host ""

# Preferimos Edge o Chrome en modo aplicacion (ventana limpia, sin barra)
$edge   = "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
$edge2  = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$chrome2= "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$browser = @($edge, $edge2, $chrome, $chrome2) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) { Start-Process $browser -ArgumentList "--app=$url" } else { Start-Process $url }

$mime = @{
  '.html'        = 'text/html; charset=utf-8'
  '.js'          = 'application/javascript; charset=utf-8'
  '.css'         = 'text/css; charset=utf-8'
  '.json'        = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'         = 'image/png'
  '.svg'         = 'image/svg+xml'
  '.ico'         = 'image/x-icon'
}

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $request = $reader.ReadLine()
    if (-not $request) { $client.Close(); continue }

    $parts = $request -split ' '
    $path = [System.Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
    if ($path -eq '/' ) { $path = '/index.html' }
    $path = $path -replace '\.\.', ''
    $file = Join-Path $root ($path.TrimStart('/') -replace '/', '\')

    if (Test-Path $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $type = $mime[$ext]; if (-not $type) { $type = 'application/octet-stream' }
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404')
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    }

    $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $client.Close()
  } catch { }
}
