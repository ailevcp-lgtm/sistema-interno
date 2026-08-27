# Estatuto AILE - matriz operativa para el sistema

Fuente: `ESTATUTO VIGENTE - AILE v3 (abril 2026).pdf`.

Este documento traduce el estatuto vigente a reglas operativas para el sistema interno. Sirve como referencia para permisos, pantallas, automatizaciones y futuros flujos formales.

## 1. Identidad institucional

- Denominacion: Asociacion Civil AILE.
- Domicilio: Provincia de Cordoba, Republica Argentina.
- Duracion: 99 anos desde el otorgamiento de personeria juridica.
- Cierre del ejercicio economico anual: 30/11.

## 2. Categorias de socios

| Categoria | Cuota | Voz | Voto | Puede integrar organos |
| --- | --- | --- | --- | --- |
| Socio Pleno | Si | Si | Si, si cumple requisitos | Si, si cumple requisitos |
| Socio Honorario | No | Si | No | No |
| Socio Adherente | Si | Si | No | No |

Requisitos para voto de Socio Pleno:

- mayor de 18 anos;
- antiguedad minima de 6 meses;
- estar al dia con cuotas sociales.

Requisitos para integrar organos sociales:

- pertenecer a la categoria Socio Pleno;
- mayor de edad;
- antiguedad minima de 6 meses;
- estar al dia con cuotas sociales.

Durante los dos primeros anos de vigencia del estatuto no se exige la antiguedad del articulo 13.

## 3. Cuotas y morosidad

- La Comision Directiva fija cuotas de ingreso, cuotas sociales y contribuciones extraordinarias, ad referendum de la Asamblea.
- Si la Asamblea Ordinaria inmediata siguiente no modifica ni rechaza expresamente las cuotas, quedan ratificadas.
- El socio que adeude 3 cuotas o cualquier otra contribucion debe ser notificado de forma fehaciente.
- Puede usarse correo electronico o numero de contacto declarado.
- Pasado 1 mes desde la notificacion sin regularizar, la Comision Directiva puede declarar la cesantia.

Implicancia de sistema:

- detectar socios con 3 o mas cuotas impagas;
- registrar fecha y medio de notificacion;
- mostrar vencimiento del plazo de regularizacion;
- permitir resolucion de Comision Directiva antes de cambiar el estado del socio.

## 4. Comision Directiva

Composicion:

- Presidente;
- Secretario;
- Tesorero;
- 2 Vocales Titulares;
- 1 Vocal Suplente.

Mandato:

- 2 ejercicios;
- reeleccion por 1 periodo consecutivo;
- luego debe pasar 1 ejercicio para volver al mismo cargo.

Reuniones:

- una vez por mes;
- extraordinarias por citacion del Presidente o solicitud de 3 miembros;
- deben celebrarse dentro de los 5 dias del pedido;
- quorum: mitad mas uno de miembros titulares;
- resoluciones: simple mayoria de presentes;
- reconsideraciones: 2/3 en sesion de igual o mayor numero de asistentes.

## 5. Cargos y permisos operativos

### Presidente

- Representa a la entidad.
- Convoca y preside sesiones de Comision Directiva y Asambleas.
- Vota y desempata.
- Firma actas, correspondencia y documentos con Secretario.
- Autoriza cuentas de gastos con Tesorero.
- Vela por la administracion y cumplimiento del estatuto.
- Puede adoptar resoluciones imprevistas ad referendum de Comision Directiva.

Sistema:

- debe tener control total institucional;
- se implementa como `admin` o cargo `Presidente` con permisos globales.

### Secretario

- Redacta actas de Asambleas y Comision Directiva.
- Firma documentacion con Presidente.
- Cita sesiones de Comision Directiva.
- Lleva Libro de Actas.
- Lleva Registro de Asociados de acuerdo con Tesorero.

Sistema:

- acceso fuerte a documentos, actas, reuniones, asambleas y socios/registro;
- no necesariamente administra finanzas operativas.

### Tesorero

- Lleva Registro de Asociados de acuerdo con Secretario.
- Gestiona cobro de cuotas.
- Lleva libros de contabilidad.
- Presenta balances mensuales a Comision Directiva.
- Prepara balance general, cuenta de gastos y recursos e inventario anual.
- Firma recibos y documentos de tesoreria con Presidente.
- Efectua pagos autorizados por Comision Directiva.
- Deposita dinero en cuenta bancaria a nombre de la Asociacion y a la orden conjunta de Presidente y Tesorero.
- Informa estado economico a Comision Directiva y Comision Revisora de Cuentas.

Sistema:

- acceso amplio a cuotas, deudas, tesoreria, movimientos, finanzas, balances, reintegros y configuracion relacionada.

### Vocal Titular

- Asiste a asambleas y Comision Directiva con voz y voto.
- Cumple tareas o comisiones encomendadas.
- Puede reemplazar Presidente, Secretario o Tesorero con mismas atribuciones.

Sistema:

- integra Comision Directiva;
- puede tener permisos globales si el sistema lo usa como miembro titular de CD;
- conviene registrar reemplazos cuando ejerce funciones de otro cargo.

### Vocal Suplente

- Reemplaza Vocal Titular en ausencia o vacancia.
- Puede concurrir a Comision Directiva con voz pero sin voto salvo reemplazo.
- No computa para quorum salvo reemplazo efectivo.

Sistema:

- debe poder ver reuniones de Comision Directiva;
- no deberia contar para quorum/voto salvo que este marcado como reemplazante.

## 6. Comision Revisora de Cuentas

Composicion:

- 1 Revisor de Cuentas Titular;
- 1 Revisor de Cuentas Suplente.

Incompatibilidades:

- no puede integrar simultaneamente Comision Directiva;
- no puede ser certificante de estados contables;
- aplica a conyuges, convivientes y parientes indicados por el estatuto.

Atribuciones:

- examinar libros y documentos al menos cada 3 meses;
- asistir a sesiones de Comision Directiva cuando lo estime necesario;
- fiscalizar administracion, fondos, caja, titulos y valores;
- verificar cumplimiento legal, estatutario y reglamentario;
- dictaminar memoria, inventario, balance y cuenta de gastos y recursos;
- convocar Asamblea Ordinaria si omite hacerlo la Comision Directiva;
- solicitar Asamblea Extraordinaria cuando lo juzgue necesario;
- vigilar liquidacion.

Sistema:

- lectura amplia de socios, deudas, movimientos, finanzas, tesoreria, balances, documentos y logs;
- capacidad futura de emitir informes/dictamenes y solicitudes;
- sin permisos operativos ordinarios de cobro/pago salvo decision expresa.

## 7. Asambleas

Ordinaria:

- una vez por ano;
- dentro de los 120 dias posteriores al cierre del ejercicio;
- considera memoria, balance, inventario, cuenta de gastos y recursos e informe de Revisora;
- elige autoridades cuando corresponda;
- puede tratar asuntos incluidos en el orden del dia;
- socios con derecho a voto pueden proponer asuntos con minimo 10%, hasta 30 dias antes del cierre del ejercicio.

Extraordinaria:

- por decision de Comision Directiva;
- a pedido de Comision Revisora de Cuentas;
- a pedido del 10% de asociados con derecho a voto;
- debe resolverse dentro de 30 dias del pedido.

Convocatoria:

- 30 dias corridos antes de la asamblea;
- dentro de 5 dias habiles de decidir convocar, publicar en Boletin Oficial por 1 dia;
- notificar socios al menos 15 dias corridos antes por sede, circular, email, mensajeria u otro medio declarado;
- incluir fecha, hora, lugar y orden del dia;
- poner memoria, balance, inventario, cuenta de gastos y recursos e informe de Revisora a disposicion con 15 dias de anticipacion cuando corresponda.

Mayorías:

- regla general: mayoria de presentes con derecho a voto;
- reforma de estatuto, fusion y escision: 2/3;
- miembros de CD/Revisora no votan asuntos relacionados con su gestion.

## 8. Elecciones

- Padron de socios en condiciones de votar: exhibicion 15 dias antes.
- Eleccion directa en asamblea.
- Voto secreto.
- Sistema de lista completa.
- Gana la lista con mayor cantidad de votos.
- No se acepta voto por poder ni por correo.
- Listas: presentacion 10 dias antes.
- Si hay lista unica: proclamacion sin acto eleccionario.
- Si no hay listas previas: socios presentes con derecho a voto pueden constituir lista en la Asamblea.

## 9. Sanciones y remociones

Sanciones a socios:

- amonestacion;
- suspension;
- expulsion.

Proceso minimo:

- notificacion de hechos y posible sancion;
- 10 dias habiles para descargo y prueba;
- resolucion fundada de Comision Directiva;
- notificacion;
- recurso de apelacion dentro de 10 dias habiles.

Suspension o expulsion:

- apelacion suspende efectos;
- Comision Directiva debe convocar Asamblea Extraordinaria en 30 dias.

Miembros de CD o Revisora:

- no participan ni votan en su propio procedimiento;
- sancion requiere 2/3 de restantes miembros titulares de CD;
- expulsion requiere ratificacion por Asamblea Extraordinaria con 2/3 de presentes con derecho a voto;
- puede haber suspension cautelar del cargo por mayoria simple.

Remocion de autoridades:

- Asamblea Extraordinaria;
- acusacion por 2/3;
- cuarto intermedio de 10 dias habiles;
- descargo;
- remocion por 2/3 mediante voto secreto;
- notificacion fehaciente en 5 dias habiles.

## 10. Proteccion de ninez y adolescencia

- Certificado de Antecedentes Penales para personal y voluntarios en contacto directo con menores.
- Certificado de No Inscripcion en Registro Provincial de Personas Condenadas por Delitos contra la Integridad Sexual.
- Autorizacion previa y por escrito de padre, madre o tutor para menores de 18.
- Protocolos y canales de actuacion ante vulneracion de derechos.
- Articulacion con SeNAF y organismos competentes.

Sistema futuro:

- registrar certificados por persona/voluntario;
- registrar autorizaciones de menores;
- bloquear asignacion a actividades con menores si faltan certificados requeridos;
- mantener trazabilidad documental.
