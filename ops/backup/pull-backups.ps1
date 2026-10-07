# Trae a ESTE computador la copia diaria de las bases de datos del servidor (pull por SSH).
# Cada descarga queda en su propia carpeta con fecha, así este equipo conserva historia aunque el servidor
# sobrescriba su copia. Pensado para ejecutarse desde el Programador de tareas (ver register-pull-task.ps1).
#
#   .\pull-backups.ps1                       # a C:\Respaldos-Zymo, conserva las últimas 7 descargas
#   .\pull-backups.ps1 -Dest D:\Respaldos -Keep 14
param(
  [string]$Dest = "C:\Respaldos-Zymo",
  [int]$Keep = 7,
  [string]$Server = "zymo",   # alias de SSH (~/.ssh/config). Una tarea programada no puede teclear contraseña: ver -Key
  [string]$Key = "",          # llave privada SIN contraseña para correr desatendido, p. ej. $HOME\.ssh\zymo_respaldos
  [string]$OneDrive = "",     # carpeta de OneDrive donde dejar la copia CIFRADA (.7z); OneDrive la sincroniza sola
  [string]$PasswordFile = "", # archivo con la contraseña del .7z, protegido con DPAPI (ver register-pull-task.ps1)
  [int]$KeepOneDrive = 2      # cuántos .7z se conservan en OneDrive
)
$ErrorActionPreference = "Stop"
$sshOpts = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=20")
if ($Key) { $sshOpts += @("-i", $Key, "-o", "IdentitiesOnly=yes") }
New-Item -ItemType Directory -Force $Dest | Out-Null
$log = Join-Path $Dest "pull.log"
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Tee-Object -FilePath $log -Append | Write-Host }

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$tmp = Join-Path $Dest ".recibiendo-$stamp"
try {
  Log "inicio: $Server -> $Dest"
  # 1) ¿el servidor reporta problemas con sus propios respaldos?
  $alerta = ssh @sshOpts $Server 'cat ~/zymo-backups/ALERTA_RESPALDOS.txt 2>/dev/null; cat ~/zymo-backups/daily/LAST_FAILURE 2>/dev/null'
  if ($alerta) { Log "ATENCION, el servidor reporta: $($alerta -join ' | ')" }

  # 2) descarga (carpeta daily completa: Postgres, SQLite y adjuntos)
  New-Item -ItemType Directory -Force $tmp | Out-Null
  scp -r -q @sshOpts "${Server}:zymo-backups/daily" $tmp
  if ($LASTEXITCODE -ne 0) { throw "scp falló (código $LASTEXITCODE)" }

  # 3) comprobaciones mínimas: que traiga las bases y que los .gz no estén truncados
  $daily = Join-Path $tmp "daily"
  Get-ChildItem $daily -Filter *.prev -Recurse | Remove-Item -Force      # el .prev no hace falta aquí: la historia la da este equipo
  $pg = @(Get-ChildItem $daily -Filter "pg_*.sql.gz")
  $sq = @(Get-ChildItem (Join-Path $daily "sqlite") -Filter *.db)
  if ($pg.Count -lt 5 -or $sq.Count -lt 5) { throw "descarga incompleta: $($pg.Count) Postgres, $($sq.Count) SQLite" }
  foreach ($f in $pg) {
    $fs = [IO.File]::OpenRead($f.FullName)
    try { $gz = New-Object IO.Compression.GZipStream($fs, [IO.Compression.CompressionMode]::Decompress); $buf = New-Object byte[] 1MB
          while ($gz.Read($buf, 0, $buf.Length) -gt 0) {} } finally { $fs.Dispose() }   # lanza error si el .gz está dañado
  }
  Rename-Item $tmp (Join-Path $Dest $stamp)
  $mb = [math]::Round(((Get-ChildItem (Join-Path $Dest $stamp) -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
  Log "OK: $stamp ($($pg.Count) Postgres, $($sq.Count) SQLite, $mb MB). Copia del servidor: $(ssh @sshOpts $Server 'cat ~/zymo-backups/daily/LAST_SUCCESS')"

  # 3b) copia cifrada a OneDrive (si se pidió). Un fallo aquí no invalida la descarga local.
  if ($OneDrive) {
    try {
      $sevenZip = @("C:\Program Files\7-Zip\7z.exe", "$env:LOCALAPPDATA\Programs\7-Zip\7z.exe", (Get-Command 7z -ErrorAction SilentlyContinue).Source) |
        Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
      if (-not $sevenZip) { throw "7-Zip no está instalado (hace falta para cifrar la copia de OneDrive)" }
      if (-not $PasswordFile -or -not (Test-Path $PasswordFile)) { throw "falta el archivo de contraseña: $PasswordFile" }
      $sec = Get-Content $PasswordFile | ConvertTo-SecureString
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
      New-Item -ItemType Directory -Force $OneDrive | Out-Null
      $tmp7z = Join-Path $Dest ".onedrive-$stamp.7z"      # se arma fuera de OneDrive y se mueve al terminar (no sube a medias)
      & $sevenZip a -t7z -mx=3 -mhe=on "-p$plain" $tmp7z (Join-Path (Join-Path $Dest $stamp) "daily") | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "7-Zip falló (código $LASTEXITCODE)" }
      Move-Item $tmp7z (Join-Path $OneDrive "respaldos-zymo-$stamp.7z") -Force
      Get-ChildItem $OneDrive -Filter "respaldos-zymo-*.7z" | Sort-Object Name -Descending | Select-Object -Skip $KeepOneDrive |
        ForEach-Object { Remove-Item $_.FullName -Force; Log "OneDrive: borrada la más antigua: $($_.Name)" }
      Log "OneDrive: respaldos-zymo-$stamp.7z ($([math]::Round((Get-Item (Join-Path $OneDrive "respaldos-zymo-$stamp.7z")).Length/1MB,1)) MB, cifrado)"
    } catch {
      Log "ERROR OneDrive (la descarga local sí quedó): $($_.Exception.Message)"
      Remove-Item (Join-Path $Dest ".onedrive-$stamp.7z") -Force -ErrorAction SilentlyContinue
    }
  }

  # 4) conservar solo las últimas $Keep descargas
  Get-ChildItem $Dest -Directory | Where-Object { $_.Name -match '^\d{8}-\d{4}$' } |
    Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object { Remove-Item $_.FullName -Recurse -Force; Log "borrada la más antigua: $($_.Name)" }
}
catch {
  Log "ERROR: $($_.Exception.Message)"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
  exit 1
}
