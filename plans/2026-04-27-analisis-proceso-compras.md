# Análisis del Proceso Completo de Compras — ZYMO Intranet
**Fecha:** 2026-04-27  
**Tipo:** Análisis profesional de brecha entre proceso de negocio e implementación actual

---

## Antes de empezar — Contexto importante

Este documento responde directamente a `Proceso_completo_de_compras.md`. No es una lista de archivos ni de código. Es una lectura honesta de lo que tienes construido, lo que falta, dónde hay oportunidades reales de mejora, y cómo deberías trabajar con los agentes de Cursor para sacar esto adelante correctamente.

La base que tienes es sólida. No estás en cero. Hay estructura, hay flujo, hay lógica de negocio. Lo que sigue es afinar, completar y conectar puntos que aún están sueltos.

---

## Lo que tienes bien construido (y no debes tocar sin razón)

**El flujo principal de estados funciona.** Nueva → Cotización → Aprobación → OC generada → Enviada → En plataforma → Entregada → Cerrada. Eso es el esqueleto del negocio y está en pie.

**El motor de extracción de cotizaciones existe.** Ya extraes datos del PDF del proveedor, calculas IVA, identificas el total. Es uno de los componentes más difíciles del sistema y ya lo tienes.

**Los roles están definidos y operando.** Auxiliar, Directora, Solicitante, Financiero, Admin. Cada uno ve lo que le corresponde (con algunos ajustes menores que ya estamos haciendo).

**Los archivos persisten.** Las fotos del solicitante, los documentos de cotización, la OC en PDF — todo se guarda y se puede ver desde ambos lados del proceso (compras y solicitante).

**Los paquetes predefinidos existen.** El líder puede reutilizar solicitudes habituales sin llenar el formulario desde cero.

---

## Lo que falta — Análisis honesto por momento del proceso

### En la Solicitud

**El formulario de mantenimiento no existe como tal.** Hoy tienes un campo libre para "Tipo" y un campo de placa/ficha como texto libre. El proceso describe una bifurcación clara: si es una solicitud de compra, el formulario es uno; si es mantenimiento, el formulario cambia y trae campos específicos. Eso todavía no está diferenciado en la UI. La pregunta que te hago es: **¿el líder de proceso sabe desde el principio si está haciendo una compra o un mantenimiento?** Si la respuesta es sí, el formulario debería comenzar con esa selección y adaptarse. Si a veces no lo sabe, hay que pensar cómo manejarlo.

**Las SLAs de prioridad existen como etiquetas pero no como alertas.** Tienes Alta/Media/Baja y ya sabes que son 4h, 12-24h y 72h. Pero hoy nadie le recuerda al auxiliar que tiene 4 horas. Nadie alerta si el tiempo se venció. Ese dato está dormido en el sistema. No es urgente pero sí importante para los KPIs que describes.

**El correo de nuevas solicitudes va a compras, pero el documento dice que también debe ir a auxiliar y solicitante.** Esto hay que revisar. El solicitante debería recibir confirmación de que su solicitud fue recibida, inmediatamente.

**Las compras mayores a $2.500.000 deben notificar a gerente y directora desde la solicitud.** Hoy ese chequeo existe en la aprobación de cotización (hay un aviso en pantalla), pero el correo no está implementado en ese umbral.

---

### En el Primer Momento

**¡Ey! Hay algo que puedes mejorar en la cotización.** El documento dice que el auxiliar puede subir 1 o 3 cotizaciones, elegir cuál es la principal, y que eso debe quedar como indicador. Hoy el sistema permite múltiples cotizaciones pero no tienes un marcador explícito de "cotizaciones presentadas: 1 de 3" ni el sistema le pide al auxiliar que declare cuántas intentó. Esto es un KPI valioso — un auxiliar que siempre sube 1 cotización vs uno que sube 3 te dice mucho sobre cómo está trabajando. **Mi sugerencia:** cuando el auxiliar envía a aprobación, preguntarle en ese momento: ¿esta es tu única cotización o hubo más opciones? Simple, no invasivo, y enriquece los datos. 

Respuesta: Si es lo mejor, pero lo que quiere el gerente con esto es que se puedan visualizar las 3 cotizaciones dado el caso entonces por eso lo coloque como opcional porque se que exigir 3 cotizaciones siempre no va a ser lo mejor.

**El anticipo/proforma es el gap más grande del proceso.** El documento describe un flujo específico: si el proveedor pide anticipo, hay que subir una proforma, notificar a financiera, activar un estado especial. Hoy el campo `anticipo` existe en la cotización pero es texto libre y nadie hace nada con él. No hay estado "PROFORMA", no hay correo a financiera en ese momento, no hay lugar para subir el documento de proforma. Esto es una funcionalidad incompleta que tiene impacto directo en el flujo de dinero. 

Respuesta: Si esto es importante, pero entonces si bien activa un estado especial, no tenemos que modificar los estados, me refiero activa un estado especial que al final del proceso diga tuvo proforma/anticipo o no, y durante el proceso que notifique, realmente no tenemos que agregar a los estados algo como Proforma directamente.

**Estoy de acuerdo con la integración SGC, pero...** la lógica de detectar si un proveedor es nuevo y avisar a calidad sin frenar el proceso es exactamente correcta. Sin embargo, para implementarla bien necesitas definir: ¿qué hace que un proveedor sea "nuevo"? ¿Es nuevo si no está en la BD de SGC con ese NIT exacto? ¿O si el nombre es parecido pero no exacto? El matching de proveedores es un problema de datos, no solo de código. Antes de implementar el correo automático a SGC, necesitas aclarar esa regla.

Respuesta: Lo que hace que un proveedor sea nuevo, es que lo coloquen en la cotización pero... Nit es != de nits guardados en base de datos de proveedores eso es lo que lo haga no identificado. Por que así? Porque actualmente el proceso te deja seleccionar los proveedores activos entonces si se coloca a mano un proveedor nuevo. Entonces esto significa que se esta enviando a aprobar una cotización de un proveedor nuevo.

**Tu enfoque en las observaciones del auxiliar es correcto, pero...** el documento dice que cuando se envía a aprobación, la directora debe poder ver las observaciones del auxiliar. Hay un campo de observaciones en la cotización y en la solicitud, pero no está claro si en la vista de aprobación de la directora esas observaciones están visibles y destacadas. Esto hay que verificar antes de dar ese paso por implementado.

Respuesta: La directora ve todo, ve la solicitud completa, la buena noticia, eso ya esta ella ya ve eso hoy en día, donde concidero yo que esta el cambio es en destacar las observaciones del auxiliar, las del solicitante no tanto, por eso lo coloque así en el archivo.

---

### En el Segundo Momento

**El correo a financiera al marcar "En plataforma" no existe.** El documento lo describe claramente: al marcar en plataforma, financiera debe recibir un correo diciéndole que ya puede iniciar su proceso. Hoy ese correo no está. Es relativamente simple de implementar — lo que sí necesitas es definir qué información debe incluir ese correo (número de OC, proveedor, forma de pago, si hay anticipo pendiente).

Respuesta: La respuesta a esto es, todo, debe poder ver, el valor aprobado sin IVA, aparte el IVA pero en el correo solo debe decir, tal pedido esta disponible para la gestión contable y en el correo una fecha de cuando se marco en plataforma esto esta sujeto a cambios, podemos hacer un MVP del correo que se envie pero luego cambiarlo.

**"Devolver a compras para corregir" desde financiera tampoco existe.** Esto ya lo identificamos en el análisis de seguridad. Es el cambio más complejo de este momento y requiere un nuevo estado en el flujo.

Respuesta: Okey en esto tienes razón me falto en el procedimiento entonces te lo detallo acá ¿Que pasa si lo devuelven a compras o al solicitante? El flujo debe ser el siguiente, el solicitante envio que necesita en cantidad de esferos 4, pero en la descipción coloco que necesita 6, la información no es valida, pero en el proceso me dice que eso me va a generar un reproceso porque el auxiliar tiene que contactar al lider y hablar con el directamente y si esta ocupado le toca dejarlo para despues, pero eso es tiempo que no entra dentro del primer momento porque se tiene que poder "Devolver" al solicitante como diciendole; Oye si no lo corrijes, mi gestión de compras no va a comenzar en plenitud, esto también es un tiempo que tenemos que medir que ya esta contemplado como "Reproceso" dentro de la intranet. O dado el caso de que no cumpla directamente la solicitud con un proceso normal de compras debe poder cancelarlo. 

Ahora si la directora es la que devuelve: Si ella devuelve es por un error del auxiliar, entonces algo minimo que no amerite que se cancele todo el proceso, pero que si es necesario que el auxiliar lo corrija, ahora, vamos a implementar lo siguiente, que ella lo pueda devolver si, pero que si es algo que el director puede cambiar, que el lo pueda editar. Entonces eso seria como por esta parte pero para el director esto es o cancelarla porque definitivamente en su disernimiento sabe que es un proceso sin futuro o que lo devuelva a arreglar O algo **"Nuevo"** es que ella misma pueda editar la cotización. Claramente no hay un aviso al auxiliar de que esto paso porque son procesos mas grandes y de mayor rango. 

**La factura al marcar "En plataforma" es opcional según el documento.** Hay que asegurarse de que el sistema no la haga obligatoria. Si ya lo maneja bien, perfecto. Si no, ajustar.

Respuesta: Si tu debes revisar esto en el codigo cuando empieces a implementar

---

## Mejoras que el proceso no menciona pero que harían diferencia

**Dashboard gerencial del proceso de compras.** El documento menciona que quieren KPIs y gráficas. Hoy la página de KPIs existe pero es básica. Un dashboard que muestre: solicitudes activas por estado, tiempo promedio en cada etapa, auxiliar con mejor tiempo de respuesta, proveedores más frecuentes — eso tiene valor gerencial real y la mayoría de los datos ya están en la base de datos. Solo falta visualizarlos.

Pero por ejemplo en esto, solo tenemos 1 auxiliar de compras, entonces el tema de auxiliar con mejor tiempo no. Pero si el resto de las cosas me parecen bien

**Notificación de vencimiento de SLA.** Si una solicitud de prioridad Alta lleva más de 4 horas sin cotización, el sistema podría enviar un recordatorio al auxiliar. No es bloqueante pero sí automatiza seguimiento que hoy se hace manualmente.

Respuesta: Si es una mejora que no habia complementado entonces puedes implementarla

**El "mismo correo" a solicitante y proveedor.** El documento especifica que deben recibir el mismo correo, no correos separados. Esto tiene una razón de negocio clara: que el proveedor y el solicitante queden en copia juntos. Hoy se envían correos separados. El cambio es poner al proveedor y al solicitante como destinatarios del mismo envío con CC.

Respuesta: Esto es super importante por favor tenlo muy en cuenta.

---

## Preguntas que necesito que respondas antes de implementar

1. **¿Mantenimiento y compra son tipos de solicitud separados desde el inicio del formulario, o puede ser ambos?** Por ejemplo, ¿puede haber una solicitud que sea a la vez compra de repuesto y mantenimiento? 

Respuesta: Al día de hoy lo vamos a dejar como si la solicitud de mantenimiento, pudiera solicitar una compra también pero que lo mencione, osea que mencione la compra, que si la menciona, directamente oblique a quien solicita el mantenimiento a hacer una solicitud aparte de compras, pero son 2 cosas diferentes no pueden ir juntas, esta solicitud de mantenimiento es también para que se lleve el registro de: Si hizo el mantenimiento cuando dijo que **Era el proximo mantenimiento correctivo?** Si si lo hizo bien, si no estamos mal y hay que tomar accion.

2. **Las 3 cotizaciones — ¿es una regla de negocio obligatoria o una recomendación?** Si es obligatoria, el sistema debería pedir las 3 antes de enviar a aprobación. Si es recomendación, puede ser optativo con el indicador que sugerí.

Arriba te respondi eso entonces puedes arriba revisar.

3. **La lista de placas y montacargas que enviará Sonia — ¿cambia con frecuencia?** Si cambia cada mes, necesita ser administrable desde la configuración de OC. Si es estática, puede ser una lista fija por ahora.

Esto es importante que entiendas algo: OC Automátizaciones ya tiene un apartado de CONFIGURACION la lista de las placas debe ir ahí junto con la configuración de los demas campos del formulario.

4. **¿Financiera ya tiene acceso al módulo financiero de la intranet?** Antes de construir más funcionalidad para ellos, hay que asegurarse de que el equipo de contabilidad esté usando lo que ya existe.

No, porque como estoy en despliegue hasta el momento, no le hemos usado, de hecho tiene un problema que yo menciono en el proceso de compras, y es que me toma los valores en dolares y la cotizacion viene en COPS entonces no halla el valor igual. 

5. **El anticipo/proforma — ¿en qué momento del proceso lo decide el auxiliar?** ¿Cuando sube la cotización, o cuando ya se eligió la cotización ganadora y antes de aprobar?

Respuesta: Si efectivamente, cuando sube la cotización porque para ese entonces el ya debe haber averiguado si necesita proforma, pero también puede que el proveedor lo solicite despues, por eso si tiene proforma debe poder activarse el estado, en cualquier momento, como un boton de Tiene proforma? Si o No y un botón de guardar cambios y notifique si tiene proforma o no, así este botón puede estar presente durante todo el proceso y es sencillo de manejar (Pienso yo)

---

## El orden que recomiendo para lo que sigue

1. Responder las 5 preguntas de arriba — sin eso, algunas implementaciones quedarán incompletas.
2. Tipo de mantenimiento + fecha próximo + adaptación del formulario (Paso 2 del roadmap, que ya está planificado).
3. Correo de confirmación al solicitante cuando su solicitud es recibida.
4. Proforma/anticipo — subida de documento + estado + correo a financiera.
5. Correo a financiera cuando se marca "En plataforma".
6. Dashboard de KPIs del proceso (cuando los datos estén bien capturados).
7. Dropdown de placas (cuando llegue la lista de Sonia).
8. Alertas de SLA por vencimiento (última porque requiere un proceso background).

---

## Conclusión

El proceso está bien pensado. La separación en "momentos" es una forma clara de entender dónde está el control y dónde no. Las bases del sistema están puestas. Lo que queda es conectar los puntos que todavía están sueltos: el anticipo, los correos que faltan, el formulario de mantenimiento y la visibilidad de datos para los roles que aún no la tienen completa.

No es un proyecto para rehacerlo desde cero. Es un proyecto para completarlo con criterio.


---

Para Cursor, nota importante:

Crea un archivo MD, donde vayas guardando tu memoria de tdos los cambios que vas implementando, de los bugs que vas encontrando pero que no son prioridad arreglar o implementar la mejora y que te quede esa  "deuda tecnica" y luego la revisas y dices bueno encontre estos bugs, ya esta todo implementado, ahora arreglo (Usa logica, si el bug es algo que se pueda esperar, se espera, si no entonces lo arreglas y sigues implementando.)

Ya conoces el proceso, la idea es que -> El proceso, se haga igual a como esta escrito. Que yo leyendolo diga Si efectivamente así se hace **Mas las mejoras** 

Con esto ya podemos proceder, recalco, siempre codigo limpio, reutilizable, legible para el ser humano, mas todas las reglas que encontraras en .cursorrules.md
