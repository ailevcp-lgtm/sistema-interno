export interface GuideSection {
  title: string
  body?: string[]
  bullets?: string[]
  steps?: string[]
  note?: string
  caution?: string
}

export interface GuideChapter {
  id: string
  title: string
  shortTitle: string
  description: string
  audience: string[]
  route?: string
  routeLabel?: string
  sections: GuideSection[]
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'proposito-y-roles',
    title: 'Capitulo 1. Proposito, alcance y roles',
    shortTitle: 'Proposito y roles',
    description: 'Explica por que existe el sistema, para que sirve y como se organiza el acceso.',
    audience: ['Toda persona que necesite entender la logica general del sistema'],
    sections: [
      {
        title: 'Para que existe el sistema',
        body: [
          'El sistema interno de AILE concentra en un solo lugar las tareas administrativas y de seguimiento que antes podian quedar repartidas entre mensajes, planillas, notas o archivos sueltos.',
          'Su funcion principal es ayudar a que la institucion trabaje con mas orden, con menos perdida de informacion y con un registro claro de lo que se hizo, quien lo hizo y cuando se hizo.',
        ],
        bullets: [
          'Centraliza personas, cuotas, movimientos, documentos y tareas.',
          'Ordena los circuitos que necesitan seguimiento, como cobros, reintegros y fechas importantes.',
          'Hace visible el estado general de la institucion desde la pantalla de inicio.',
          'Evita que todas las personas tengan acceso a todo. Cada una ve solo lo que necesita.',
        ],
      },
      {
        title: 'Como se organiza el acceso',
        body: [
          'El sistema distingue entre el nivel general de acceso y el cargo institucional de cada persona.',
          'Eso permite que el acceso sea mas fino y que un mismo modulo se vea distinto segun quien ingresa.',
        ],
        bullets: [
          'Rol general del sistema: define hasta donde puede entrar una persona.',
          'Cargo institucional: identifica la funcion que cumple dentro de AILE.',
          'Permisos concretos: terminan de decidir si la persona solo puede mirar o tambien puede cargar, editar o aprobar.',
        ],
      },
      {
        title: 'Roles generales del sistema',
        bullets: [
          'Socio: acceso general a las funciones basicas y a sus propios datos.',
          'Comision Directiva: acceso ampliado a gestion, seguimiento y configuracion.',
          'Revisor de Cuentas: acceso de consulta a informacion sensible y financiera.',
          'Administrador: acceso total y capacidad de mantenimiento general.',
        ],
        note: 'Lo importante no es memorizar nombres tecnicos, sino entender que el rol define hasta donde puede entrar y que puede hacer cada persona.',
      },
      {
        title: 'Cargos institucionales que puede tener una persona',
        bullets: [
          'Presidente',
          'Vicepresidente',
          'Secretario General',
          'Director de Finanzas',
          'Tesorero',
          'Revisor de Cuentas',
          'Vocal Titular',
          'Vocal Suplente',
          'Revisor de Cuentas Titular',
          'Revisor de Cuentas Suplente',
          'Socio',
        ],
        body: [
          'Estos cargos ayudan a ordenar responsabilidades dentro de la institucion. En algunas pantallas tambien influyen en lo que se puede ver o hacer.',
        ],
      },
      {
        title: 'Idea clave para recordar',
        bullets: [
          'El sistema es una oficina digital de AILE.',
          'Cada persona entra con su cuenta.',
          'El sistema reconoce quien es y le muestra solo las herramientas que necesita.',
          'Cada accion importante deja registro para que haya trazabilidad.',
        ],
      },
    ],
  },
  {
    id: 'acceso-y-navegacion',
    title: 'Capitulo 2. Acceso, ingreso y navegacion',
    shortTitle: 'Acceso y navegacion',
    description: 'Describe como entrar al sistema, como moverse y donde encontrar ayuda.',
    audience: ['Toda persona autorizada a ingresar al panel'],
    sections: [
      {
        title: 'Como ingresar',
        body: [
          'El sistema tiene una pantalla de ingreso privada para personas autorizadas.',
          'Hoy permite dos formas de acceso: con correo y contraseña, o con cuenta de Google.',
        ],
        steps: [
          'Abrir la pantalla de inicio de sesion.',
          'Elegir si se va a entrar con correo y contraseña o con Google.',
          'Completar los datos y confirmar el ingreso.',
          'Esperar a que el sistema recupere el perfil y redirija al panel principal.',
        ],
      },
      {
        title: 'Que hacer si no puedes entrar',
        bullets: [
          'Revisar que el correo sea el correcto.',
          'Si usas Google, verificar que sea la cuenta autorizada.',
          'Si el sistema no encuentra tu perfil, contactar a quien administre usuarios y roles.',
          'Si ingresas pero no ves un modulo esperado, probablemente se trate de permisos y no de un error de acceso.',
        ],
      },
      {
        title: 'Como se navega por dentro',
        body: [
          'La navegacion principal se hace desde el menu lateral. En celular, parte de esa navegacion aparece abajo y el resto dentro de la opcion "Mas".',
        ],
        bullets: [
          'Inicio',
          'Calendario',
          'Tareas',
          'Socios',
          'Deudas',
          'Movimientos',
          'Finanzas',
          'Tesoreria',
          'Reintegros',
          'Documentos',
          'Ajustes',
        ],
      },
      {
        title: 'Menu personal',
        bullets: [
          'Mi perfil: muestra los datos de la persona que ingreso.',
          'Mi estado de cuenta: muestra la situacion personal de cuotas y pagos.',
          'Cerrar sesion: sale del sistema de forma segura.',
        ],
      },
      {
        title: 'Accesos faciles a la guia',
        body: [
          'Dentro del sistema hay accesos contextuales para abrir la ayuda de la pantalla actual o la guia completa.',
          'La recomendacion para usuarios nuevos es abrir primero la guia de la pantalla en la que estan trabajando, y despues volver a la guia completa si necesitan entender el sistema entero.',
        ],
      },
    ],
  },
  {
    id: 'inicio',
    title: 'Capitulo 3. Pantalla de Inicio',
    shortTitle: 'Inicio',
    description: 'Es el tablero general del sistema y resume lo mas importante del momento.',
    route: '/dashboard',
    routeLabel: 'Abrir Inicio',
    audience: ['Todos los perfiles que ingresan al panel'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Inicio es la pantalla de referencia. Su objetivo es que la persona entienda rapidamente la situacion general sin tener que abrir varios modulos.',
          'No reemplaza a los modulos de trabajo, pero sirve para ubicar prioridades y entrar mas rapido a donde hace falta actuar.',
        ],
      },
      {
        title: 'Que puedes encontrar',
        bullets: [
          'Cantidad de socios activos.',
          'Cantidad de socios con deuda, si el perfil puede ver deudas.',
          'Saldo actual, si el perfil tiene acceso a informacion financiera.',
          'Cantidad de resoluciones vigentes.',
          'Ultimas resoluciones o novedades institucionales.',
          'Fechas importantes que vienen desde el calendario institucional.',
          'Accesos rapidos a tareas, socios, calendario, documentos y otras areas.',
        ],
      },
      {
        title: 'Como usar esta pantalla',
        steps: [
          'Leer primero los indicadores principales para entender la situacion general.',
          'Mirar la seccion de fechas importantes para saber si hay reuniones, planificacion o vencimientos cerca.',
          'Usar los accesos rapidos para entrar directo al modulo de trabajo que corresponda.',
          'Volver a Inicio cuando necesites recuperar una vista general del sistema.',
        ],
      },
      {
        title: 'Como interpretar los datos',
        bullets: [
          'Socios activos: muestra cuantas personas estan registradas como activas.',
          'Socios con deuda: indica cuantas personas tienen cuotas pendientes o vencidas.',
          'Saldo actual: resume la diferencia entre ingresos y egresos no anulados.',
          'Resoluciones vigentes: indica cuantas normas estan actualmente activas.',
          'Fechas importantes: muestra reuniones y planificaciones proximas, y tambien vencimientos de tareas si existen.',
        ],
      },
      {
        title: 'Buenas practicas',
        bullets: [
          'Usar Inicio como tablero de lectura, no como lugar para resolver todo.',
          'Si ves un indicador llamativo, entra al modulo correspondiente antes de tomar una decision.',
          'Si faltan datos que esperabas ver, puede deberse al tipo de permiso del perfil actual.',
        ],
      },
    ],
  },
  {
    id: 'calendario',
    title: 'Capitulo 4. Calendario',
    shortTitle: 'Calendario',
    description: 'Reune reuniones, planificacion institucional y vencimientos de tareas en una sola agenda.',
    route: '/calendario',
    routeLabel: 'Abrir Calendario',
    audience: ['Perfiles con acceso al modulo Calendario'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Calendario funciona como agenda institucional unificada. La idea es que las personas no tengan que revisar varias listas separadas para saber que viene.',
        ],
        bullets: [
          'Muestra reuniones.',
          'Muestra actividades de planificacion institucional.',
          'Muestra vencimientos de tareas con fecha limite.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Resumen de eventos de los proximos 7 dias.',
          'Resumen de eventos del mes seleccionado.',
          'Cantidad de vencimientos de tareas activos.',
          'Calendario mensual con marcas por tipo de evento.',
          'Detalle del dia seleccionado.',
          'Listados de proximas reuniones y proximos vencimientos.',
          'Boton para agregar una nueva fecha, si el perfil puede hacerlo.',
        ],
      },
      {
        title: 'Tipos de fecha que maneja el sistema',
        bullets: [
          'Reunion: una cita con horario, lugar y participantes.',
          'Planificacion: una fecha institucional que puede estar en estado tentativo o definitivo.',
          'Vencimiento: una fecha limite tomada desde una tarea.',
        ],
      },
      {
        title: 'Como cargar una reunion',
        steps: [
          'Abrir "Agregar fecha" y elegir la opcion Reunion.',
          'Completar titulo, lugar, fecha y horario de inicio y fin.',
          'Agregar una descripcion si hace falta contexto, temario o notas.',
          'Elegir el alcance de la reunion.',
          'Si el alcance es personalizado, seleccionar involucrados e invitados.',
          'Guardar para que el sistema la agende y la notifique.',
        ],
        bullets: [
          'Comision Directiva: la invitacion queda limitada a ese grupo.',
          'General: la reunion aplica a todos los socios activos.',
          'Personalizada: permite elegir personas concretas.',
        ],
      },
      {
        title: 'Como cargar una planificacion',
        steps: [
          'Abrir "Agregar fecha" y elegir la opcion Planificacion.',
          'Completar nombre de la actividad y una descripcion orientativa.',
          'Definir fecha de inicio y fecha de fin.',
          'Elegir si esta en estado tentativo o definitivo.',
          'Guardar los cambios.',
        ],
        bullets: [
          'Tentativa: sirve para fechas en analisis o por confirmar.',
          'Definitiva: indica que la fecha ya esta definida.',
        ],
      },
      {
        title: 'Como leer el calendario',
        bullets: [
          'Cada marca visual indica un tipo de evento.',
          'Al elegir un dia, el panel lateral muestra todo lo que ocurre en esa fecha.',
          'Si una tarea tiene fecha limite, aparece como vencimiento dentro del calendario.',
          'Si no ves el boton para crear o editar, es porque tu perfil esta en modo de consulta.',
        ],
      },
    ],
  },
  {
    id: 'tareas',
    title: 'Capitulo 5. Tareas',
    shortTitle: 'Tareas',
    description: 'Es el tablero de trabajo institucional y por direccion, con proyectos, tareas y subtareas.',
    route: '/tareas',
    routeLabel: 'Abrir Tareas',
    audience: ['Perfiles con acceso al modulo Tareas'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Tareas ordena el trabajo en proyectos y tableros. Su objetivo es que cada accion tenga responsable, estado y, cuando corresponda, fecha limite.',
        ],
        bullets: [
          'Permite crear proyectos institucionales.',
          'Permite organizar espacios por direccion.',
          'Permite asignar tareas y crear subtareas.',
          'Permite seguir el avance en formato tablero.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Cantidad de proyectos activos.',
          'Cantidad de tareas activas.',
          'Cantidad de tareas asignadas a la persona que ingreso.',
          'Pestaña de proyectos institucionales.',
          'Pestaña de espacios por direccion.',
          'Botones para crear proyecto o tarea, si el perfil puede hacerlo.',
        ],
      },
      {
        title: 'Como se organiza',
        bullets: [
          'Proyecto institucional: sirve como proyecto madre o transversal.',
          'Proyecto interno de direccion: pertenece a una direccion concreta.',
          'Cada proyecto contiene tareas.',
          'Cada tarea puede tener subtareas.',
          'El tablero muestra las columnas Pendiente, En progreso, En revision y Completada.',
        ],
      },
      {
        title: 'Como crear trabajo nuevo',
        steps: [
          'Crear primero un proyecto si todavia no existe el contenedor adecuado.',
          'Elegir si ese proyecto es institucional o de una direccion.',
          'Dentro del proyecto, crear la tarea con titulo, descripcion, estado y fecha limite si hace falta.',
          'Asignar la tarea a una persona cuando corresponda.',
          'Si la tarea es compleja, dividirla en subtareas.',
        ],
      },
      {
        title: 'Acciones que pueden aparecer segun permiso',
        bullets: [
          'Editar tarea.',
          'Asignar o reasignar responsable.',
          'Hacer handoff a otra persona.',
          'Crear subtarea.',
          'Mover la tarea de columna.',
          'Marcar la tarea como completada.',
          'Enviar la tarea a Comision Directiva.',
          'Aprobar u observar en CD.',
          'Eliminar tarea o proyecto.',
        ],
        caution: 'No todas las personas veran todas las acciones. Algunas solo tendran vista de lectura y otras solo podran actuar sobre tareas asignadas.',
      },
      {
        title: 'Como leer una tarjeta de tarea',
        bullets: [
          'Titulo: identifica rapidamente la accion a realizar.',
          'Descripcion: da contexto, enlaces y detalle.',
          'Estado visible: muestra la etapa simple del trabajo.',
          'Estado interno de flujo: puede aparecer cuando la tarea pasa por revision o aprobacion.',
          'Fecha limite: indica vencimiento o proximidad.',
          'Direccion responsable: aparece cuando la tarea pertenece o impacta en una direccion.',
          'Subtareas: permiten dividir el trabajo sin perder la tarea principal.',
        ],
      },
      {
        title: 'Buenas practicas',
        bullets: [
          'Usar titulos claros y breves.',
          'Agregar descripcion cuando otra persona pueda necesitar contexto.',
          'No dejar tareas terminadas en estados intermedios.',
          'Usar subtareas cuando el trabajo tiene varios pasos.',
          'Si una tarea requiere decision institucional, usar el circuito previsto y no resolverlo por fuera.',
        ],
      },
    ],
  },
  {
    id: 'socios',
    title: 'Capitulo 6. Socios',
    shortTitle: 'Socios',
    description: 'Administra la base de personas vinculadas a AILE y su informacion principal.',
    route: '/socios',
    routeLabel: 'Abrir Socios',
    audience: ['Perfiles autorizados para ver o gestionar socios'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'El modulo Socios es la base de personas del sistema. Desde aqui se registra quien pertenece a AILE y se consulta su informacion principal.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Cantidad total de socios.',
          'Cantidad de socios activos.',
          'Cantidad de socios inactivos.',
          'Cantidad de socios con deuda.',
          'Buscador por nombre, DNI o correo.',
          'Filtros por estado y por rol institucional.',
          'Boton para crear nuevo socio, si el perfil puede hacerlo.',
          'Listado principal con acciones por persona.',
        ],
      },
      {
        title: 'Como dar de alta un socio',
        steps: [
          'Abrir "Nuevo socio".',
          'Completar nombre, apellido, DNI, correo y fecha de ingreso.',
          'Agregar telefono si esta disponible.',
          'Elegir el cargo institucional si corresponde.',
          'Guardar la ficha.',
        ],
      },
      {
        title: 'Como usar los filtros',
        bullets: [
          'El buscador ayuda a encontrar una persona por datos basicos.',
          'El filtro de estado separa activos e inactivos.',
          'El filtro de rol institucional ayuda a revisar solo un grupo determinado.',
        ],
      },
      {
        title: 'Que puedes hacer desde la lista',
        bullets: [
          'Abrir el detalle completo de una persona.',
          'Editar sus datos, si el perfil tiene permiso.',
          'Activar o inactivar el estado.',
          'Eliminar, si el perfil tiene permiso total.',
        ],
      },
      {
        title: 'Que muestra el detalle de un socio',
        bullets: [
          'Datos personales y de contacto.',
          'Estado actual.',
          'Rol o cargo institucional.',
          'Fecha de ingreso y antiguedad.',
          'Resumen de cuotas pagadas, pendientes y vencidas.',
          'Estado de cuenta y listado historico.',
        ],
      },
      {
        title: 'Buenas practicas',
        bullets: [
          'Mantener actualizados correo y telefono.',
          'No usar el cambio de estado como forma de borrar informacion historica.',
          'Revisar el detalle del socio antes de modificar datos sensibles.',
        ],
      },
    ],
  },
  {
    id: 'deudas',
    title: 'Capitulo 7. Deudas',
    shortTitle: 'Deudas',
    description: 'Permite seguir la cobranza, registrar pagos y consultar el historial de cuotas.',
    route: '/deudas',
    routeLabel: 'Abrir Deudas',
    audience: ['Perfiles autorizados para gestionar o consultar deuda'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Deudas concentra la gestion de cuotas. Desde aqui se ve cuanto se recaudo, cuanto falta cobrar, que cuotas estan vencidas y como se registra cada pago.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Total recaudado.',
          'Total pendiente.',
          'Total vencido.',
          'Porcentaje de cobranza.',
          'Barra de progreso de cobranza.',
          'Buscador.',
          'Filtros por periodo y por estado.',
          'Tabla de cuotas.',
          'Exportacion.',
          'Acceso a promociones, si el perfil administrador puede verlas.',
        ],
      },
      {
        title: 'Como registrar un pago',
        steps: [
          'Abrir la accion de registrar pago en la cuota o socio correspondiente.',
          'Elegir una o varias cuotas pendientes.',
          'Seleccionar la cuenta donde entra el dinero.',
          'Si corresponde, aplicar una promocion vigente.',
          'Definir la fecha del pago.',
          'Agregar notas si hace falta dejar aclaraciones.',
          'Confirmar el pago.',
        ],
        note: 'El pago registrado no queda solo en Deudas. Tambien genera un movimiento de ingreso y afecta la cuenta elegida.',
      },
      {
        title: 'Estados que puedes encontrar',
        bullets: [
          'Pendiente: la cuota existe pero aun no fue cobrada.',
          'Parcial: ya hubo un pago, pero no cubre el total.',
          'Vencida: el plazo de pago paso y la cuota sigue sin completarse.',
          'Pagada: la cuota ya fue cubierta.',
        ],
      },
      {
        title: 'Historial, anulacion y promociones',
        bullets: [
          'Historial de pagos: muestra movimientos ya registrados para una persona.',
          'Anulacion de pago: deja sin efecto un pago y exige motivo.',
          'Promociones: permiten aplicar descuentos segun reglas definidas.',
          'Exportacion: sirve para sacar la informacion fuera del sistema cuando hace falta revisarla o compartirla.',
        ],
      },
      {
        title: 'Cuando el sistema muestra "Mi deuda" en lugar de "Deudas"',
        body: [
          'Si la persona no tiene permiso para ver la cobranza completa, el sistema la lleva a una vista personal, centrada solo en su propia situacion.',
        ],
      },
    ],
  },
  {
    id: 'movimientos',
    title: 'Capitulo 8. Movimientos',
    shortTitle: 'Movimientos',
    description: 'Muestra los ingresos y egresos recientes en orden cronologico.',
    route: '/movimientos',
    routeLabel: 'Abrir Movimientos',
    audience: ['Perfiles con acceso al modulo Movimientos'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Movimientos es la cronologia financiera. Sirve para ver la secuencia real de ingresos y egresos sin entrar a paneles analiticos.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Total de ingresos dentro del filtro actual.',
          'Total de egresos dentro del filtro actual.',
          'Balance dentro del filtro actual.',
          'Botones para mostrar todos, solo ingresos o solo egresos.',
          'Buscador por descripcion, categoria, evento o cuenta.',
          'Listado agrupado por fecha.',
        ],
      },
      {
        title: 'Como usarlo',
        steps: [
          'Elegir primero si quieres ver todo, solo ingresos o solo egresos.',
          'Si necesitas afinar la busqueda, escribir un termino relacionado con la descripcion, la cuenta, la categoria o el evento.',
          'Leer los movimientos agrupados por fecha para entender el orden real en que ocurrieron.',
        ],
      },
      {
        title: 'Que datos aparecen en cada movimiento',
        bullets: [
          'Tipo: ingreso o egreso.',
          'Monto.',
          'Fecha.',
          'Descripcion.',
          'Categoria.',
          'Evento asociado, si existe.',
          'Cuenta asociada, si existe.',
        ],
      },
      {
        title: 'Cuando conviene usar este modulo',
        bullets: [
          'Cuando necesitas revisar el detalle reciente de entradas y salidas.',
          'Cuando quieres confirmar si una operacion ya impacto en la cronologia.',
          'Cuando necesitas seguir el orden en que se fueron registrando movimientos.',
        ],
      },
    ],
  },
  {
    id: 'finanzas',
    title: 'Capitulo 9. Finanzas',
    shortTitle: 'Finanzas',
    description: 'Presenta paneles y comparaciones para analizar la informacion economica ya registrada.',
    route: '/finanzas',
    routeLabel: 'Abrir Finanzas',
    audience: ['Comision Directiva, Revisor de Cuentas y perfiles autorizados'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Finanzas no esta pensada para cargar datos manualmente, sino para analizarlos. Usa la informacion ya existente para mostrar tendencias, comparaciones y composicion de ingresos y egresos.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Filtros por año.',
          'Filtros por categoria.',
          'Filtros por evento.',
          'Pestaña Balance.',
          'Pestaña Ingresos.',
          'Pestaña Egresos.',
          'Pestaña Eventos.',
          'Boton Exportar.',
        ],
      },
      {
        title: 'Como se usa',
        steps: [
          'Elegir primero el año de trabajo.',
          'Si hace falta, filtrar por una categoria especifica.',
          'Si el analisis esta vinculado a una actividad, filtrar tambien por evento.',
          'Cambiar entre pestañas para leer el mismo universo de datos desde distintos enfoques.',
        ],
      },
      {
        title: 'Que ofrece cada pestaña',
        bullets: [
          'Balance: resume ingresos, egresos, distribucion por categoria y evolucion mensual.',
          'Ingresos: muestra cuanto ingreso, por que concepto y con que comparaciones.',
          'Egresos: muestra cuanto salio, por que categoria y con que detalle.',
          'Eventos: ordena la informacion economica comparando actividades o eventos.',
        ],
      },
      {
        title: 'Como conviene leerlo',
        bullets: [
          'Usar Balance para una lectura general.',
          'Entrar a Ingresos o Egresos cuando hace falta entender de donde viene el resultado.',
          'Usar Eventos cuando la pregunta es cuanto dejo o costo una actividad concreta.',
          'Recordar que el panel refleja lo que ya esta cargado en los movimientos y otras tablas vinculadas.',
        ],
      },
    ],
  },
  {
    id: 'tesoreria',
    title: 'Capitulo 10. Tesoreria',
    shortTitle: 'Tesoreria',
    description: 'Administra cuentas, saldos, movimientos recientes y arqueos.',
    route: '/tesoreria',
    routeLabel: 'Abrir Tesoreria',
    audience: ['Perfiles autorizados para operar en Tesoreria'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Tesoreria es el lugar operativo de caja y cuentas. Muestra saldos por cuenta y permite registrar movimientos diarios cuando el perfil tiene permiso.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Listado de cuentas activas con su saldo actual.',
          'Boton para nuevo ingreso.',
          'Boton para nuevo egreso.',
          'Acceso al arqueo de cuenta.',
          'Tabla de movimientos recientes.',
          'Buscador de movimientos.',
        ],
      },
      {
        title: 'Como registrar un ingreso o un egreso',
        steps: [
          'Abrir "Nuevo Ingreso" o "Nuevo Egreso".',
          'Elegir la cuenta correcta.',
          'Elegir la categoria adecuada.',
          'Completar el monto.',
          'Escribir una descripcion que permita entender la operacion despues.',
          'Relacionar el movimiento con un evento si corresponde.',
          'Guardar.',
        ],
      },
      {
        title: 'Que es un arqueo',
        body: [
          'Un arqueo sirve para comparar el saldo que muestra el sistema con el saldo real observado en una cuenta.',
        ],
        steps: [
          'Abrir la accion de arqueo en la cuenta correspondiente.',
          'Revisar el saldo que informa el sistema.',
          'Cargar el saldo real observado.',
          'Agregar observaciones si hay diferencia o aclaraciones.',
          'Guardar el registro.',
        ],
      },
      {
        title: 'Lectura de la tabla de movimientos',
        bullets: [
          'Muestra fecha, descripcion, categoria, cuenta, evento y monto.',
          'Los ingresos y egresos se distinguen visualmente por color y signo.',
          'El buscador ayuda a encontrar registros por texto libre.',
        ],
      },
      {
        title: 'Importante',
        caution: 'Si tu perfil solo tiene permiso de consulta, podras ver la informacion pero no apareceran las acciones para registrar ni para arqueo.',
      },
    ],
  },
  {
    id: 'reintegros',
    title: 'Capitulo 11. Reintegros',
    shortTitle: 'Reintegros',
    description: 'Ordena el circuito completo de una devolucion de gasto, desde la solicitud hasta el pago.',
    route: '/reintegros',
    routeLabel: 'Abrir Reintegros',
    audience: ['Perfiles autorizados por la institucion para solicitar, aprobar o pagar reintegros'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Reintegros resuelve un circuito que necesita trazabilidad: una persona hace un gasto, lo informa, otra persona lo revisa y luego Tesoreria registra el pago.',
        ],
      },
      {
        title: 'Que ves al entrar',
        bullets: [
          'Cantidad de solicitudes en curso.',
          'Cantidad de solicitudes pagadas.',
          'Cantidad total visible para el perfil actual.',
          'Pestaña Mis reintegros.',
          'Pestaña Bandeja de aprobacion.',
          'Pestaña Pendientes de pago.',
        ],
      },
      {
        title: 'Como cargar una solicitud nueva',
        steps: [
          'Abrir "Nueva solicitud".',
          'Completar fecha del gasto.',
          'Elegir la categoria de egreso.',
          'Cargar el monto solicitado.',
          'Agregar URL de factura si la tienes.',
          'Completar numero de factura y emisor si corresponde.',
          'Describir claramente el gasto.',
          'Guardar el borrador o enviarlo al circuito cuando ya este completo.',
        ],
      },
      {
        title: 'Como funciona el circuito',
        bullets: [
          'Borrador: la solicitud aun no fue enviada.',
          'Pendiente de aprobacion: espera revision.',
          'Observada: fue devuelta con observaciones para corregir o revisar.',
          'Aprobada pendiente pago: ya fue aprobada y espera que Tesoreria pague.',
          'Rechazada: el circuito se cierra sin pago.',
          'Pagada: Tesoreria ya registro el pago.',
          'Cancelada: la solicitud fue anulada dentro del circuito.',
        ],
      },
      {
        title: 'Como se aprueba o rechaza',
        steps: [
          'Entrar a la bandeja de aprobacion.',
          'Buscar la solicitud correspondiente.',
          'Si hace falta pedir ajustes, observar la solicitud y dejar el motivo.',
          'Si corresponde aprobar, indicar el monto aprobado.',
          'Si no corresponde continuar, rechazar y dejar el motivo.',
        ],
      },
      {
        title: 'Como se registra el pago',
        steps: [
          'Entrar a la pestaña de pendientes de pago.',
          'Elegir la solicitud aprobada.',
          'Seleccionar la cuenta desde donde se va a pagar.',
          'Definir la fecha del pago.',
          'Adjuntar o informar la URL del comprobante.',
          'Confirmar el pago.',
        ],
        note: 'Cuando el pago se registra, el sistema deja trazabilidad y lo integra al circuito financiero.',
      },
    ],
  },
  {
    id: 'documentos',
    title: 'Capitulo 12. Documentos',
    shortTitle: 'Documentos',
    description: 'Centraliza el estatuto, las resoluciones, los decretos y los balances institucionales.',
    route: '/documentos',
    routeLabel: 'Abrir Documentos',
    audience: ['Perfiles con acceso a documentacion institucional'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Documentos es la biblioteca institucional del sistema. Su objetivo es que las personas consulten la version correcta de cada documento sin depender de archivos sueltos o mensajes viejos.',
        ],
      },
      {
        title: 'Pestañas disponibles',
        bullets: [
          'Estatuto.',
          'Resoluciones.',
          'Decretos CD.',
          'Balances.',
        ],
      },
      {
        title: 'Como usar la pestaña Estatuto',
        bullets: [
          'Permite leer el estatuto por articulos.',
          'Cada articulo se puede desplegar o plegar.',
          'Tambien puede existir un boton para descargar el PDF oficial del estatuto vigente.',
        ],
      },
      {
        title: 'Como usar Resoluciones y Decretos',
        bullets: [
          'Muestran listados de normas institucionales.',
          'Permiten ver numero, año, estado y archivo asociado.',
          'Si hay archivo disponible, se puede abrir o descargar.',
        ],
      },
      {
        title: 'Como usar Balances',
        bullets: [
          'Reune balances cargados en el sistema.',
          'Permite consultar y descargar archivos asociados cuando existen.',
          'Puede incluir distintos periodos o tipos segun la informacion disponible.',
        ],
      },
      {
        title: 'Buenas practicas',
        bullets: [
          'Usar siempre esta seccion como referencia formal.',
          'Evitar trabajar con versiones descargadas hace mucho tiempo sin verificar si siguen vigentes.',
          'Cuando la informacion del archivo sea clave para una decision, descargar la version vigente desde aqui.',
        ],
      },
    ],
  },
  {
    id: 'ajustes',
    title: 'Capitulo 13. Ajustes',
    shortTitle: 'Ajustes',
    description: 'Administra reglas del sistema, roles, cuotas, categorias y registros de actividad.',
    route: '/configuracion',
    routeLabel: 'Abrir Ajustes',
    audience: ['Comision Directiva y administradores autorizados'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Ajustes es el modulo donde se definen reglas que impactan en varias partes del sistema. No es un modulo operativo cotidiano, sino un espacio de administracion y control.',
        ],
      },
      {
        title: 'Pestañas disponibles',
        bullets: [
          'Roles.',
          'Cuotas.',
          'Categorias.',
          'Logs.',
        ],
      },
      {
        title: 'Que se hace en Roles',
        bullets: [
          'Simular permisos para entender que ve cada perfil.',
          'Crear o editar roles institucionales.',
          'Ajustar permisos por rol.',
          'Asignar rol general y cargo institucional a cada persona.',
        ],
        caution: 'Esta pestaña afecta visibilidad y capacidad de accion en muchos modulos. Conviene hacer cambios con criterio institucional.',
      },
      {
        title: 'Que se hace en Cuotas',
        bullets: [
          'Definir el monto mensual de cuota.',
          'Definir el dia de vencimiento.',
          'Guardar la configuracion general.',
          'Generar las cuotas del mes para los socios.',
        ],
      },
      {
        title: 'Que se hace en Categorias',
        bullets: [
          'Crear categorias financieras nuevas.',
          'Definir si una categoria es de ingreso o de egreso.',
          'Activar o desactivar categorias existentes.',
          'Mantener ordenada la clasificacion que luego usan Tesoreria, Finanzas y Reintegros.',
        ],
      },
      {
        title: 'Que se hace en Logs',
        bullets: [
          'Consultar acciones realizadas dentro del sistema.',
          'Ver fecha y hora.',
          'Ver quien hizo la accion.',
          'Ver que tipo de accion fue y su detalle.',
        ],
      },
    ],
  },
  {
    id: 'mi-perfil',
    title: 'Capitulo 14. Mi perfil',
    shortTitle: 'Mi perfil',
    description: 'Muestra la informacion personal y la ficha institucional del usuario actual.',
    route: '/mi-perfil',
    routeLabel: 'Abrir Mi perfil',
    audience: ['Toda persona que haya iniciado sesion'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Mi perfil ayuda a que cada persona vea con claridad que datos tiene cargados el sistema sobre ella.',
        ],
      },
      {
        title: 'Que puedes encontrar',
        bullets: [
          'Nombre y apellido.',
          'Correo.',
          'Avatar o iniciales.',
          'Rol general del sistema.',
          'Cargo institucional.',
          'DNI.',
          'Telefono.',
          'Fecha de ingreso.',
          'Estado dentro de AILE.',
        ],
      },
      {
        title: 'Como usarlo',
        steps: [
          'Revisar que el nombre y correo sean correctos.',
          'Confirmar que el cargo institucional sea el esperado.',
          'Verificar datos de socio como DNI, telefono y fecha de ingreso.',
          'Si algo no coincide, contactar a quien gestione usuarios o socios.',
        ],
      },
      {
        title: 'Alertas posibles',
        bullets: [
          'Si el sistema detecta deuda pendiente, puede mostrar una alerta y ofrecer acceso al estado de cuenta.',
          'Si no encuentra informacion de socio asociada a tu cuenta, avisara que ese vinculo falta o esta incompleto.',
        ],
      },
    ],
  },
  {
    id: 'mi-estado-cuenta',
    title: 'Capitulo 15. Mi estado de cuenta',
    shortTitle: 'Mi estado de cuenta',
    description: 'Permite a cada socio revisar su propia deuda, cuotas pendientes y pagos realizados.',
    route: '/mi-cuenta',
    routeLabel: 'Abrir Mi estado de cuenta',
    audience: ['Toda persona con cuenta de socio vinculada'],
    sections: [
      {
        title: 'Para que sirve',
        body: [
          'Esta pantalla esta pensada para la consulta personal. No muestra la cobranza completa de toda la institucion, sino solo la situacion propia del usuario.',
        ],
      },
      {
        title: 'Que puedes encontrar',
        bullets: [
          'Deuda total.',
          'Cantidad de cuotas pagadas.',
          'Cantidad de cuotas pendientes.',
          'Cantidad de cuotas vencidas.',
          'Detalle de cuotas pendientes y vencidas.',
          'Historial de pagos.',
          'Mensajes de alerta o de estado al dia.',
        ],
      },
      {
        title: 'Como leer tu situacion',
        bullets: [
          'Si no hay deuda ni cuotas pendientes, el sistema muestra que estas al dia.',
          'Si hay cuotas pendientes, las separa de las ya vencidas.',
          'Si hubo pagos parciales, el sistema los refleja dentro del detalle.',
        ],
      },
      {
        title: 'Como usar la pantalla',
        steps: [
          'Revisar primero la alerta general para saber si estas al dia o si tienes deuda.',
          'Mirar el resumen numerico para entender la situacion completa.',
          'Entrar al listado de pendientes para identificar que cuotas faltan.',
          'Entrar al historial para revisar pagos ya registrados.',
        ],
      },
      {
        title: 'Cuando conviene pedir ayuda',
        bullets: [
          'Si realizaste un pago y no aparece.',
          'Si ves una cuota que no deberia estar pendiente.',
          'Si no tienes vinculada correctamente tu cuenta de socio.',
          'Si necesitas entender por que una cuota figura como parcial o vencida.',
        ],
      },
    ],
  },
]

export function getGuideChapterById(id?: string | null): GuideChapter | null {
  if (!id) return null
  return GUIDE_CHAPTERS.find((chapter) => chapter.id === id) || null
}

export function resolveGuideChapterFromPath(pathname?: string | null): GuideChapter | null {
  if (!pathname) return null

  const normalized = pathname.toLowerCase()

  if (normalized.startsWith('/guia')) return null
  if (normalized.startsWith('/mi-perfil')) return getGuideChapterById('mi-perfil')
  if (normalized.startsWith('/mi-cuenta')) return getGuideChapterById('mi-estado-cuenta')
  if (normalized.startsWith('/deudas/mi-cuenta')) return getGuideChapterById('mi-estado-cuenta')
  if (normalized.startsWith('/dashboard')) return getGuideChapterById('inicio')
  if (normalized.startsWith('/calendario')) return getGuideChapterById('calendario')
  if (normalized.startsWith('/tareas')) return getGuideChapterById('tareas')
  if (normalized.startsWith('/socios')) return getGuideChapterById('socios')
  if (normalized.startsWith('/deudas')) return getGuideChapterById('deudas')
  if (normalized.startsWith('/movimientos')) return getGuideChapterById('movimientos')
  if (normalized.startsWith('/finanzas')) return getGuideChapterById('finanzas')
  if (normalized.startsWith('/tesoreria')) return getGuideChapterById('tesoreria')
  if (normalized.startsWith('/reintegros')) return getGuideChapterById('reintegros')
  if (normalized.startsWith('/documentos')) return getGuideChapterById('documentos')
  if (normalized.startsWith('/configuracion')) return getGuideChapterById('ajustes')

  return null
}

export function getGuideHrefForPath(pathname?: string | null): string {
  const chapter = resolveGuideChapterFromPath(pathname)
  if (!chapter) return '/guia'
  return `/guia#${chapter.id}`
}
