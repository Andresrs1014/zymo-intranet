# Registra en el Programador de tareas de Windows la descarga automática de los respaldos del servidor.
# Corre a las 14:00 y a las 20:00 (30-60 min después de las copias del servidor de 13:00 y 19:00).
# Si el equipo estaba apagado a esa hora, la tarea corre apenas se encienda (StartWhenAvailable).
# Ejecutar una sola vez:  powershell -ExecutionPolicy Bypass -File .\register-pull-task.ps1
# Quitar:                 Unregister-ScheduledTask -TaskName "Zymo - descargar respaldos" -Confirm:$false
$script = Join-Path $PSScriptRoot "pull-backups.ps1"
$accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$triggers = @((New-ScheduledTaskTrigger -Daily -At "14:00"), (New-ScheduledTaskTrigger -Daily -At "20:00"))
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "Zymo - descargar respaldos" -Action $accion -Trigger $triggers -Settings $config `
  -Description "Descarga la copia de las bases de datos del servidor a C:\Respaldos-Zymo" -Force
Write-Host "Tarea registrada. Prueba ahora con: Start-ScheduledTask -TaskName 'Zymo - descargar respaldos'"
