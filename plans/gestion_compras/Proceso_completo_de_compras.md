
---

## Solicitud de compra 
Este proceso se categoriza como **El activador de los momentos**

Cuando en la empresa de conexión logística que abarca LOGIMAT, IMCCARGO y IMC DEPOSITO se requiere una compra se lleva a cabo el siguiente procedimiento.

Primero es importante aclarar quien en la empresa puede realizar una compra y esto se responde al entender que hay lideres de procesos, estos lideres son los que tienen en su potestad el solicitar una compra, por eso, todo líder de proceso esta en potestad de solicitar una compra.

De esta manera el proceso inicia con la **Solicitud** esta solicitud se realiza a través de la intranet empresarial desde el apartado **Operativo** y **Solicitudes** a través de estos 2 pasos, el líder de proceso, puede si bien va a recurrir a una compra que ya es habitual, seleccionar un paquete de los que ya tienen predefinidos para la operación o para los procesos administrativos.
Ahora bien, acá tenemos que mencionar el proceso completo que debe poder gestionar la intranet:

1. Debe poder gestionar varios items en un pedido
2. Debe poder mostrar el proceso a las personas a quienes les compete 

Por el momento mencionamos estos 2 items y voy a describir como funciona el paso a paso para hacer una solicitud:

**Primer paso:**
El líder de proceso accede a `zymointranet.com`
**Segundo paso:** 
Ubica la sección operativo
**Tercer paso:**
Selecciona *Mis solicitudes* o *paquete de compras*  (En esta sección podrán ver sus solicitudes y sus paquetes predefinidos)
**Cuarto paso:**
El solicitante (Líder de servicio) realiza la solicitud y acá se mencionan los siguientes pasos que debe poder gestionar la Intranet:

1. Debe poder gestionar la criticidad o la importancia de la solicitud si es  **Alta Media Baja** y para la intranet esto debe ser  **4 horas** para la prioridad **Alta**, de **12 a 24 horas hábiles**  y para la prioridad **Baja** debe ser de **72 horas hábiles** 
2. Debe permitirle subir información como evidencia **como fotos o documentos completos pdf**  y estos documentos deben poder ser visibles durante todo el proceso tanto como para el solicitante como para los que atenderán en un futuro la solicitud.
3.  Debe enviar una alerta de solicitud, a los siguientes involucrados: Auxiliar, Solicitante. Compras mayores a 2.500.00 deben de enviar correo a gerente y a Directora.
4. Debe poder ver el registro de lo que esta pasando con su compra

Ahora ¿Que sucede si es un mantenimiento? y no es una solicitud de compra?
La intranet debe poder mostrar el apartado de Mantenimiento con este apartado de mantenimiento el formulario debe cambiar, trayendo datos básicos como la cantidad, la descripción para entender que se solicita pero debe agregar al formulario:

1. Tipo de mantenimiento esto es: Correctivo - Preventivo
2. Fecha de proximo mantenimiento posterior a la solicitud que se esta diligenciando 
3. Una lista desplegable de placas y fichas de montacargas (De esto se habla mas adelante en *Configuraciones de OC automatizaciones*)

Esto es para mantenimientos generales de infraestructura, vehículos y montacargas.

Con esto abarcamos en su gran mayoría lo que es una solicitud. De todo este proceso debemos tener:

- Kpi's 
- Tiempos completos como el tiempo que inicia el **primer momento** (<- Información importante para el futuro)
- Registro de si es solicitud de compra o si es mantenimiento en nuestros kpi's
- Dashboard con graficas de todo el proceso de solicitudes (Mas adelante se aclara donde se debe ver este modulo)

---

Con esto ya terminamos de evaluar el proceso de como se solicita una compra dentro de ZYMO  ahora continuamos con:

## El primer momento

El primer momento, denominado así porque compras es un proceso que se divide en muchos factores (o como lo llamamos en la empresa *"depende de"* ) en este primer momento se analiza todos los pasos **medibles** (en tiempo, eficiencia y calidad de proceso por parte del área de compras y sus integrantes) con esta explicación ya abarcamos el `por que` de las horas de respuesta de una solicitud **Alta** **Media** **Baja**.
Es importante aclarar que hay 2 cosas previas al primer momento que la intranet debe medir el tiempo, pero que no entran dentro del **primer momento**, por motivos como: *Hora a la que se hizo la solicitud o demoras en otros procesos que puede realizar el auxiliar* si bien estos tiempos son medibles no entran en nuestro primer momento. 
Esas 2 cosas son, el tiempo que se demoro haciendo la solicitud el líder de proceso y el tiempo que se demoro en iniciar el primer momento o para poner ese check point podríamos decir que ese "Iniciar el primer momento" se conocerá el tiempo en el que auxiliar le dio al botón de **Asignarme esta solicitud**.

Una solicitud maneja los siguientes estados:

- Solicitud recibida 
- Asignada a compras
- Cotización Lista
- Aprobación
- OC enviada 
- En plataforma
- Recibido por líder

Con esto ya podemos iniciar nuestra primera medición importante.
#### Inicio del primer momento: 
Al auxiliar recibir el correo se cierra ese tiempo medible de cuanto se demoro en darle al botón **Asignarme esta solicitud** empieza nuestro primer momento. Donde la intranet debe poder:

1. Enviar un correo al solicitante de que ya esta siendo gestionada su solicitud

Donde la persona encargada (auxiliar) debe revisar, la criticidad de la solicitud y empezar a cotizar, según las horas de respuesta que tiene. En este paso entra ese "depende de" del que hablábamos anteriormente, yo no se cuanto se va a demorar en cotizar, porque puede que un proveedor cotice mas rápido que otro, en esto no nos fijemos ya que la intranet no entra en esta parte del proceso, un primer indicador se da en, si es *Tal prioridad* (cualquiera de las 3 ya mencionadas) ¿Cuanto se demoro en responder? primer indicador a medir. El primer momento continua y dice nuestro procedimiento que el auxiliar debe enviar 3 cotizaciones, estas 3 cotizaciones se van a subir a la solicitud ¿Que debe poder hacer la intranet? 

1. Recibir esas 3 cotizaciones y a través de un túnel, guardarlas en el servidor.

Pero solo 1 de las cotizaciones se queda realmente dentro de el proceso, esa la elige el líder de servicio o si la directora y el gerente, en esta parte realmente no tenemos que añadir la funcionalidad de que este paso sea visible dentro de la intranet, solamente se sube y al elegir la realmente ganadora, se envía a aprobación. (Hasta acá se terminan los indicadores de nuestro auxiliar momentáneamente)

Paso a paso para realizar esto:

**Primer paso:**
El auxiliar entra a `zymointranet.com`
**Segundo paso:**
Entrar al modulo administrativo y a solicitudes
**Tercer paso:**
Revisa la importancia de la solicitud y da al botón **Asignarme esta solicitud**
**Cuarto paso:**
Al cotizar y saber cual es la cotización final **Enviar cotizaciones**

*Importante:*
Acá la intranet debe de poder dejar enviar 1 cotización o las 3 cotizaciones y dejar el registro de si subieron 1 o 3 y que esto sea un indicador también. Y debe de pedirle al auxiliar que diga, cual de estas debe ser la principal y la que el motor de extracción debe utilizar para enviar a aprobar.

Importante aclarar que el auxiliar también adicional a las cotizaciones debe poder subir fotos evidencia de lo que cotizo para gusto del líder o lo necesario pedido por el líder.

Es muy importante que al enviar las cotizaciones y elegir la que realmente se queda se pueda expresar el auxiliar con lo siguiente:

1. Tiempo de entrega (MUY IMPORTANTE fecha estimada de entrega)
2. Observaciones, acá podrá decir *Me demore por X* Estas observaciones son importantes que al momento de **Aprobar** (que se ve mas adelante) el director/a puedan ver estas observaciones.

Motor de extracción de datos:

Este es especialmente nuestro mayor conflicto a la hora de recibir una cotización extraer todos sus datos relevantes que muchos ya están mapeados dentro de la intranet. Validar que todo este en COPS (Pesos colombianos) Haga cálculos como el del IVA si no lo encuentra o el total de los items.
También este o en el formato de la OC este debe saber cual es el NIT y en general todos los datos de la empresa por la que se vaya a hacer la compra, esto ya esta en el código.

**Donde entra SGC:**
Importante tener en cuenta lo siguiente este es otro de esos "Depende de" pero esta vez no en tiempo, si no que en compras entran diferentes áreas de la empresa entonces en este caso vamos hablar de proveedores. Los proveedores se pueden seleccionar desde que el auxiliar usa el botón de **Enviar cotizaciones** ahora es importante que la intranet pueda identificar si se usa un nuevo proveedor que no este creado y enviar un correo al área ya creada dentro de la intranet denominada Sistemas de gestión SGC avisando que hay un nuevo proveedor y que lo tienen que crear, si no esta creado no debe frenar el proceso simplemente avisar. Adicionalmente se deben poder llamar desde la base de datos de SGC los proveedores que estén activos.

Agregar o quitar items a la cotización debe calcular automáticamente lo que haga falta, nuevamente como IVA o el valor total y el subtotal sin IVA.

**Donde entra financiera:**
Antes de aprobar Y DURANTE el proceso de aprobación el sistema debe prepararse para recibir una *Proforma* si el pedido, el proveedor pide un anticipo de dinero por sus productos. La intranet debe poder:

1. Enviar un correo a financiera con la proforma y los pasos que debe tener en cuenta para realizar el anticipo de dinero.
2. Al "Prepararse para generar este paso" debe permitir subir la proforma
3. La proforma se debe guardar por el mismo tunel o uno nuevo por donde se guardan las cotizaciones 
4. Tiene que activar el estado de PROFORMA en la solicitud que su importancia radica en que se hizo un anticipo antes de comprar.

Es importante saber que en el apartado de Financiera - debe poder ver las proformas y antes de que se pague el producto completo. Entonces el auxiliar de compras debe poder subir la proforma y esta debe cargarse en financiera cuando la directora apruebe la solicitud, ya aprobada entonces la proforma subida por el auxiliar pasa a contabilidad quien gestionara ese anticipo al proveedor.

Al ser enviada a **Aprobación** se debe enviar un correo. La intranet debe poder:

1. Enviar un correo a solicitante
2. Enviar un correo a Directora (Si es de mas de 2.500.00 a directora y a gerente general)
3. Cerrar indicador de **Cuanto se demoro en enviar a aprobar cotización**
4. Mostrar si necesita o no un anticipo

La directora debe poder ver *MUY IMPORTANTE*, IVA, total con IVA, sub-total sin IVA y debe poder aprobar diferentes valores según su designio o enviarla aprobada tal como llego, TAMBIÉN IMPORTANTE debe poder ver la cotización, descargarla y analizarla respecto a lo que se va mandar a la OC.

La intranet debe poder:

1. Enviar correo a solicitante
2. Enviar correo a auxiliar de compras
3. Cerrar indicador de, desde cuando se envió a aprobación y cuando lo aprobó
4. Tener disponible todo los archivos persistentes ya mencionados, fotos evidencia tanto las que subió el solicitante, como los que podrá subir el auxiliar de compras y las respectivas cotizaciones claramente destacando la que ya es definitiva.

Al hacer esto, tanto como la directora como el auxiliar pueden hacer el proceso de generar la OC (Orden de compra) automáticamente según por la empresa por la que se tenga que hacer. Desde acá que debe ser posible:

1. La intranet debe enviar UN MISMO CORREO tanto al solicitante como al proveedor pero un mismo correo es importante que sea uno mismo, por si el proveedor decide comunicarse no solo con el auxiliar si no con el solicitante.
2. Finalización del primer momento al **Enviar OC a proveedor**

---
Finalizamos el primer momento y acá tenemos que esperar a que llegue el producto y ¿Por que esta por fuera del primer momento? Porque dependemos completamente del proveedor si cumple o no. Pero de igual manera mediremos todos los tiempos:

1. Cuanto tiempo se demoran en entregar

---

## El segundo momento

Nuestro segundo momento, si bien no toma tantos pasos como el primero es igual de importante. Tenemos que saber si se entrego satisfactoriamente o que sucedió por eso la intranet:

- Al marcarlo como **En plataforma** se debe adjuntar la factura (si aplica no es obligatorio) debe llegar un correo a Financiera diciéndole que ya esta en plataforma que ya puede realizar su proceso.
- Correo a solicitante diciéndole **Confirma la entrega del pedido**

Se debe medir:

1. Cuanto tiempo se demoraron en marcar como entregado completo por parte del líder.
2. Enviar correo de que ya el líder confirmo el buen estado y dejo sus observaciones
3. Cuanto tiempo se demoraron en cerrar la solicitud


---

# Trabajo para la IA -> Cursor y Claude code

Analizar correctamente la implementación de esto en la intranet ASEGURANDO QUE TODO FUNCIONE
Si evidencian mejoras en el proceso, sugerirlas.
Hacer un plan de implementación para las cosas que hacen falta.
Haz preguntas, no simplemente implementes, si no asegura que esto salga correctamente.
Revisa y dime lo siguiente:
1. Por ejemplo **¡Ey! Mira acá puedes mejorar tu automatización** y decir el porque y como impactaría en todo el proceso.
2. Estoy de acuerdo pero....
3. Tu enfoque es el correcto pero... Tuviste en cuenta X 

Es muy importante que me retroalimentes y que te sumerjas en el procedimiento. Ese es nuestro proceso y es lo que tenemos que implementar. Mucho ya esta realizado y considero yo que deje las bases, pero necesito tu ayuda con esto. 

---

Como puedes ver esto es un proceso empresarial, pero no pienso que tengamos que complicarnos mucho. Busca y analiza en el internet que encuentras que pueda ayudar al máximo por favor. 