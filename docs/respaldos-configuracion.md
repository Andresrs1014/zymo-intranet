# Respaldos de la intranet ZYMO — cómo quedaron configurados

**Fecha de configuración:** 2 de octubre de 2026
**Servidor:** servidor de producción de la intranet (Ubuntu, Docker)
**Responsable técnico:** Andrés Quintero (desarrollo e innovación)

---

## 1. Resumen para la gerencia

- Las bases de datos de la intranet **se copian ahora dos veces al día: a la 1:00 p. m. y a las 7:00 p. m. (hora Colombia)** a una carpeta del servidor que está **fuera de Docker**. Es un solo archivo por base de datos, que se sobrescribe en cada copia.
- Se mantienen además los **respaldos semanales** (domingos 2:00 a. m.), con 8 semanas de historia.
- Por primera vez se copian también los **archivos adjuntos** (PDFs de órdenes de compra, cotizaciones y facturas, adjuntos de tareas, tickets y Helix).
- Un **vigilante** revisa cada día que los respaldos hayan salido bien y deja una alerta visible si algo falla o se atrasa.
- El proceso **no pisa una copia buena con una dañada**: si la copia nueva es sospechosamente más pequeña, no reemplaza a la anterior y deja aviso.

## 2. Por qué se hizo

El 2 de octubre de 2026 un comando de administración tumbó todos los servicios de la intranet y **borró sus volúmenes de Docker**, que es donde viven las bases de datos y los archivos adjuntos. El último respaldo útil era del 20 de septiembre: el respaldo del 27 de septiembre había fallado en silencio y nadie lo notó.

Lo recuperado y lo perdido de ese incidente está documentado aparte. Esta configuración existe para que **la pérdida de datos no pueda repetirse en esa magnitud**: ahora el máximo de datos que se perdería ante un evento similar es el trabajo de **unas horas** (desde la última copia de la 1 p. m. o de las 7 p. m.), no 12 días.

## 3. Las tres capas de protección

| Capa | Cuándo | Qué hace | Dónde queda | Historia |
|---|---|---|---|---|
| **Copia de bases y adjuntos** (nueva) | Todos los días, **1:00 p. m. y 7:00 p. m.** Colombia | Copia todas las bases y los adjuntos. Un archivo por base, **sobrescrito** en cada copia | `~/zymo-backups/daily/` | El actual + 1 anterior (`.prev`) |
| **Respaldo semanal** (existente, revisado) | Domingos, 2:00 a. m. Colombia | Respaldo completo con verificación de integridad (checksums) | `~/zymo-backups/weekly/` | 8 semanas |
| **Vigilante** (nuevo) | Todos los días, 1:30 p. m. y 7:30 p. m. Colombia | Comprueba que el diario y el semanal estén al día; si no, crea una alerta | `~/zymo-backups/ALERTA_RESPALDOS.txt` | — |

Además hay un **reintento automático del semanal** (domingo 3:00 a. m. Colombia) que solo se ejecuta si no hubo un respaldo semanal exitoso en los últimos 6 días.

## 4. Qué se copia exactamente

**Bases de datos Postgres** (todas las que estén corriendo, descubiertas automáticamente, no escritas a mano):
- Intranet: principal (usuarios, roles), SIG, Helix, tareas, ZymoAlly (tickets) y Libertadora.
- Otros proyectos del mismo servidor: CRM, gestión comercial, WOW Olimpiadas, Brakepak, ZYMO Academy.

**Bases SQLite** del backend (órdenes de compra, personal/T&C, financiero, gerencial, SGC, agentes, intranet) y de los proyectos `matrix` y `crm_html_app`: copiadas con la función de respaldo propia de SQLite, que garantiza una copia consistente aunque la base esté en uso, y verificadas con `quick_check`.

**Archivos adjuntos** (volúmenes de Docker): adjuntos de SIG, Helix, tareas y ZymoAlly, y los archivos de `backend_data` (PDFs de órdenes, cotizaciones y facturas). **Antes de esta configuración estos archivos no estaban respaldados en ninguna parte.**

## 5. Protecciones incorporadas

1. **Validación antes de sobrescribir.** Cada archivo nuevo se comprueba (archivo íntegro, volcado completo, integridad de SQLite). Si falla la comprobación, **no se reemplaza** la copia anterior.
2. **Regla de tamaño.** Si la copia nueva pesa menos de la mitad que la actual (señal típica de una base vacía o dañada), tampoco se reemplaza. Esto se probó en el servidor: la copia buena se conservó y el sistema registró el fallo.
3. **Copia anterior.** Antes de reemplazar un archivo, el anterior se conserva como `.prev`.
4. **Fuera de Docker.** Las copias viven en el sistema de archivos del servidor, no en volúmenes de Docker; borrar o reconstruir contenedores y volúmenes no las afecta.
5. **Descubrimiento automático.** El script encuentra los contenedores por su tipo y etiquetas, en lugar de depender de nombres fijos. Esa dependencia fue la causa de que el respaldo semanal del 27 de septiembre fallara.
6. **Vigilante de alertas.** La falla silenciosa del 27 de septiembre ya no puede pasar desapercibida: se genera una alerta visible al entrar por SSH al servidor.
7. **Un solo proceso a la vez** (bloqueo), registro de lo ocurrido (`daily.log`) y estado de la última corrida (`LAST_SUCCESS` / `LAST_FAILURE`).

## 6. Verificación realizada (2 de octubre de 2026)

| Prueba | Resultado |
|---|---|
| Copia completa: 13 bases Postgres, 9 SQLite y 5 volúmenes | Correcta, unos 10 segundos |
| Segunda corrida: sobrescribe y deja el `.prev` | Correcta |
| Prueba de la regla de tamaño (copia nueva sospechosa) | No pisó la copia buena, terminó con error y dejó el aviso |
| Respaldo semanal ejecutado a mano | Correcto (verificado con checksums) |
| Vigilante con un fallo simulado | Creó la alerta y la quitó al resolverse |
| Programación (cron) | Instalada; copia del cron anterior guardada en `~/zymo-backups/crontab.antes-2026-10-02.txt` |

## 7. Cómo se restaura (resumen)

1. Levantar solo los contenedores de las bases: `docker compose up -d zymo-db sig-db helix-db task-db zymoally-db libertadora-db`.
2. Cargar cada base desde su archivo: `zcat pg_<contenedor>.sql.gz | docker exec -i <contenedor> psql -U <usuario> -d postgres`.
3. Copiar los SQLite al volumen `backend_data` y los adjuntos desde los `.tgz`.
4. Levantar las aplicaciones servicio por servicio.

**Importante:** nunca usar `docker compose down -v` en este proyecto; borra todos los volúmenes. Para quitar un servicio puntual se usa `docker compose rm -sfv <servicio>`.

## 8. Limitaciones y recomendaciones (para decidir)

| # | Limitación | Recomendación |
|---|---|---|
| 1 | **Todas las copias están en el mismo servidor y el mismo disco.** Protegen contra errores de administración y de Docker, pero **no** contra la falla del disco, el robo o pérdida del servidor, o un ataque. | Enviar una copia a **otro lugar** (otro equipo, un NAS o almacenamiento en la nube) una vez al día. Es la mejora más importante que falta. |
| 2 | La copia diaria solo guarda el estado de la **última copia** (1 p. m. o 7 p. m.) más la anterior. No permite volver a un punto de hace una semana (para eso está el semanal). | Aceptable por el volumen actual de datos; si se requiere más historia, ampliar la retención (las bases pesan pocos MB). |
| 3 | Las alertas hoy se ven **al entrar por SSH** al servidor. Nadie las recibe en el correo. | Conectar el vigilante al correo o a WhatsApp de la intranet para que avise sin que nadie tenga que revisarlo. |
| 4 | Lo que se genera entre dos copias (hasta 18 h, de 7 p. m. a 1 p. m.) se pierde si ocurre un incidente justo antes de la siguiente. | Es el costo de la frecuencia actual; se puede subir a más copias por día si el negocio lo necesita (cada copia tarda unos 10 segundos). |
| 5 | Los archivos adjuntos que ya se perdieron el 2 de octubre **no se recuperan** con esta configuración (solo protege hacia adelante). | — |

## 9. Dónde está el código

- Repositorio de la intranet, carpeta `ops/backup/`:
  - `daily-copy.sh` — copia diaria.
  - `check-backups.sh` — vigilante de alertas.
- Respaldo semanal: `~/backup/backup-databases.sh` en el servidor (anterior a esta configuración).
- Programación: `crontab -l` del usuario `analista_desarrollo`, bloques `ZYMO WEEKLY DATABASE BACKUP` y `ZYMO DAILY DB COPY`.
