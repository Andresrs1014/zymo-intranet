# Registra en el Programador de tareas de Windows la descarga automática de los respaldos del servidor.
# Corre a las 14:00 y a las 20:00 (30-60 min después de las copias del servidor de 13:00 y 19:00).
# Si el equipo estaba apagado a esa hora, la tarea corre apenas se encienda (StartWhenAvailable).
# Ejecutar una sola vez:  powershell -ExecutionPolicy Bypass -File .\register-pull-task.ps1 [-Server zymo] [-Dest C:\Respaldos-Zymo] [-Key $HOME\.ssh\zymo_respaldos]
#   -Server = el nombre con el que ESE equipo se conecta por SSH (comprueba que `ssh <nombre>` entra sin pedir clave).
# Quitar:                 Unregister-ScheduledTask -TaskName "Zymo - descargar respaldos" -Confirm:$false
param(
  [string]$Server = "zymo",             # alias de SSH del equipo
  [string]$Dest = "C:\Respaldos-Zymo",
  [string]$Key = "",                    # llave privada SIN contraseña (obligatoria si el equipo entra por contraseña)
  [string]$OneDrive = "",               # carpeta de OneDrive para la copia cifrada (opcional)
  [string]$PasswordFile = ""            # archivo DPAPI con la contraseña del .7z (obligatorio si se usa -OneDrive)
)
$script = Join-Path $PSScriptRoot "pull-backups.ps1"
$argumento = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Server `"$Server`" -Dest `"$Dest`""
if ($Key) { $argumento += " -Key `"$Key`"" }
if ($OneDrive) { $argumento += " -OneDrive `"$OneDrive`" -PasswordFile `"$PasswordFile`"" }
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argumento
$triggers = @((New-ScheduledTaskTrigger -Daily -At "14:00"), (New-ScheduledTaskTrigger -Daily -At "20:00"))
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "Zymo - descargar respaldos" -Action $accion -Trigger $triggers -Settings $config `
  -Description "Descarga la copia de las bases de datos del servidor a C:\Respaldos-Zymo" -Force
Write-Host "Tarea registrada. Prueba ahora con: Start-ScheduledTask -TaskName 'Zymo - descargar respaldos'"
