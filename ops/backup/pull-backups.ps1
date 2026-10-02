# Trae a ESTE computador la copia diaria de las bases de datos del servidor (pull por SSH).
# Cada descarga queda en su propia carpeta con fecha, así este equipo conserva historia aunque el servidor
# sobrescriba su copia. Pensado para ejecutarse desde el Programador de tareas (ver register-pull-task.ps1).
#
#   .\pull-backups.ps1                       # a C:\Respaldos-Zymo, conserva las últimas 7 descargas
#   .\pull-backups.ps1 -Dest D:\Respaldos -Keep 14
param(
  [string]$Dest = "C:\Respaldos-Zymo",
  [int]$Keep = 7,
  [string]$Server = "zymo-claude"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Dest | Out-Null
$log = Join-Path $Dest "pull.log"
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Tee-Object -FilePath $log -Append | Write-Host }

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$tmp = Join-Path $Dest ".recibiendo-$stamp"
try {
  Log "inicio: $Server -> $Dest"
  # 1) ¿el servidor reporta problemas con sus propios respaldos?
  $alerta = ssh -o BatchMode=yes -o ConnectTimeout=20 $Server 'cat ~/zymo-backups/ALERTA_RESPALDOS.txt 2>/dev/null; cat ~/zymo-backups/daily/LAST_FAILURE 2>/dev/null'
  if ($alerta) { Log "ATENCION, el servidor reporta: $($alerta -join ' | ')" }

  # 2) descarga (carpeta daily completa: Postgres, SQLite y adjuntos)
  New-Item -ItemType Directory -Force $tmp | Out-Null
  scp -r -q -o BatchMode=yes -o ConnectTimeout=20 "${Server}:zymo-backups/daily" $tmp
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
  Log "OK: $stamp ($($pg.Count) Postgres, $($sq.Count) SQLite, $mb MB). Copia del servidor: $(ssh -o BatchMode=yes $Server 'cat ~/zymo-backups/daily/LAST_SUCCESS')"

  # 4) conservar solo las últimas $Keep descargas
  Get-ChildItem $Dest -Directory | Where-Object { $_.Name -match '^\d{8}-\d{4}$' } |
    Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object { Remove-Item $_.FullName -Recurse -Force; Log "borrada la más antigua: $($_.Name)" }
}
catch {
  Log "ERROR: $($_.Exception.Message)"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
  exit 1
}
