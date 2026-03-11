interface QuickGuideCard {
  title: string
  text: string
}

interface QuickGuideColumn {
  title: string
  items: string[]
}

interface QuickGuideSection {
  eyebrow: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  steps?: string[]
  cards?: QuickGuideCard[]
  columns?: QuickGuideColumn[]
  note?: string
}

const QUICK_GUIDE_SECTIONS: QuickGuideSection[] = [
  {
    eyebrow: "1. Qué es este sistema",
    title: "Una oficina digital para el trabajo diario de AILE",
    paragraphs: [
      "El sistema interno de AILE reúne en un solo lugar las tareas más importantes de la institución: personas, cuotas, movimientos, documentos, tareas, calendario, tesorería y reintegros.",
      "La idea es simple: que cada persona tenga un único lugar para consultar información, registrar acciones y seguir lo que está pasando sin depender de mensajes, planillas sueltas o cadenas largas de WhatsApp.",
    ],
    bullets: [
      "Muestra solo lo que cada persona necesita según su rol.",
      "Deja registro de cobros, pagos, tareas y decisiones.",
      "Ordena la información institucional para que no se pierda.",
    ],
  },
  {
    eyebrow: "2. Cómo ingresar",
    title: "Acceso con cuenta autorizada",
    paragraphs: [
      "El ingreso se hace con correo y contraseña o con cuenta de Google, siempre que la persona esté autorizada dentro del sistema.",
    ],
    steps: [
      "Abrir la pantalla de ingreso.",
      "Entrar con correo y contraseña o con Google.",
      "Esperar a que el sistema cargue el perfil.",
      "Comenzar desde la pantalla de Inicio.",
    ],
    note: "Si una persona entra pero no ve una pantalla esperada, normalmente se trata de permisos y no de un error técnico.",
  },
  {
    eyebrow: "3. Cómo se organiza",
    title: "Pantallas principales del sistema",
    cards: [
      {
        title: "Inicio",
        text: "Resume la situación general: socios activos, deuda, saldo, resoluciones y accesos rápidos.",
      },
      {
        title: "Calendario",
        text: "Unifica reuniones, planificación institucional y vencimientos de tareas.",
      },
      {
        title: "Tareas",
        text: "Ordena proyectos, tareas y subtareas en tableros por proyecto o por dirección.",
      },
      {
        title: "Socios",
        text: "Muestra la base de personas y su información principal.",
      },
      {
        title: "Deudas",
        text: "Permite seguir cuotas, registrar cobros y revisar historial de pagos.",
      },
      {
        title: "Movimientos",
        text: "Ordena cronológicamente ingresos y egresos.",
      },
      {
        title: "Finanzas",
        text: "Analiza la información económica ya registrada.",
      },
      {
        title: "Tesorería",
        text: "Administra cuentas, arqueos y movimientos diarios.",
      },
      {
        title: "Reintegros",
        text: "Gestiona solicitudes, aprobación y pago de reintegros.",
      },
      {
        title: "Documentos",
        text: "Centraliza estatuto, resoluciones, decretos y balances.",
      },
      {
        title: "Ajustes",
        text: "Administra roles, cuotas, categorías y registros de actividad.",
      },
      {
        title: "Mi perfil / Mi cuenta",
        text: "Permite a cada persona revisar sus propios datos y su situación personal.",
      },
    ],
  },
  {
    eyebrow: "4. Qué hace cada perfil",
    title: "Roles explicados de forma simple",
    cards: [
      {
        title: "Socio",
        text: "Consulta información básica, calendario, tareas visibles y su propia cuenta.",
      },
      {
        title: "Comisión Directiva",
        text: "Gestiona módulos institucionales, revisa información sensible y toma decisiones dentro del sistema.",
      },
      {
        title: "Revisor de Cuentas",
        text: "Accede a información de consulta, especialmente para revisión y control.",
      },
      {
        title: "Administrador",
        text: "Tiene acceso total y puede configurar reglas generales del sistema.",
      },
    ],
    note: "Además del rol general, cada persona puede tener un cargo institucional como Presidente, Secretario General, Director de Finanzas o Tesorero.",
  },
  {
    eyebrow: "5. Recorridos más comunes",
    title: "Flujos rápidos de uso",
    columns: [
      {
        title: "Para revisar el estado general",
        items: [
          "Entrar a Inicio.",
          "Mirar indicadores principales.",
          "Abrir accesos rápidos según la prioridad del día.",
        ],
      },
      {
        title: "Para registrar un cobro",
        items: [
          "Ir a Deudas.",
          "Buscar al socio o la cuota.",
          "Registrar el pago con la cuenta correcta.",
          "El sistema genera también el movimiento de ingreso.",
        ],
      },
      {
        title: "Para seguir tareas",
        items: [
          "Entrar a Tareas.",
          "Ubicar el proyecto.",
          "Revisar responsable, estado y fecha límite.",
          "Actualizar el avance o completar la tarea.",
        ],
      },
      {
        title: "Para pagar un reintegro",
        items: [
          "Entrar a Reintegros.",
          "Revisar pendientes de pago.",
          "Elegir cuenta, fecha y comprobante.",
          "Confirmar el pago para dejar trazabilidad.",
        ],
      },
    ],
  },
  {
    eyebrow: "6. Qué conviene mirar en cada módulo",
    title: "Lectura rápida por tema",
    bullets: [
      "Si la duda es sobre personas: ir a Socios.",
      "Si la duda es sobre cuotas o cobros: ir a Deudas.",
      "Si la duda es sobre entradas y salidas de dinero: ir a Movimientos o Tesorería.",
      "Si la duda es sobre análisis económico: ir a Finanzas.",
      "Si la duda es sobre fechas importantes: ir a Calendario.",
      "Si la duda es sobre trabajo pendiente: ir a Tareas.",
      "Si la duda es sobre una devolución de gasto: ir a Reintegros.",
      "Si la duda es sobre normas o documentos: ir a Documentos.",
    ],
  },
  {
    eyebrow: "7. Buenas prácticas",
    title: "Uso recomendado",
    bullets: [
      "Usar Inicio como tablero general y no como único lugar de trabajo.",
      "Registrar información en el módulo correcto para que quede trazabilidad.",
      "Escribir descripciones claras cuando otra persona necesite entender lo que pasó.",
      "No cambiar permisos o configuraciones sin criterio institucional.",
      "Si una persona tiene dudas, primero identificar qué quiere hacer y en qué pantalla corresponde.",
    ],
  },
  {
    eyebrow: "8. Mensaje final",
    title: "Qué idea tiene que quedar clara",
    paragraphs: [
      "El sistema interno de AILE está pensado para ordenar el trabajo institucional, no para complicarlo.",
      "Cada persona entra, ve lo que necesita, registra lo que hace y puede volver después para encontrar esa información clara y ordenada.",
    ],
  },
] as const

export function QuickGuidePdfDocument() {
  return (
    <div className="min-h-screen bg-[#f6f0fb] text-slate-900">
      <div
        id="quick-guide-pdf-root"
        className="mx-auto bg-white shadow-[0_24px_90px_-50px_rgba(99,20,167,0.35)]"
        style={{ width: "210mm", minHeight: "297mm" }}
      >
        <section className="relative overflow-hidden px-12 pb-14 pt-12 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(140deg,#6314a7_0%,#7c2cbc_52%,#e50051_100%)]" />
          <div className="absolute -right-10 top-[-30px] h-56 w-56 rounded-full bg-white/12 blur-3xl" />
          <div className="absolute left-[-40px] top-[180px] h-48 w-48 rounded-full bg-[#00a3e2]/25 blur-3xl" />

          <div className="relative z-10 grid grid-cols-[1.25fr_0.75fr] gap-8">
            <div className="space-y-7">
              <div className="flex items-center gap-4">
                <div className="rounded-3xl border border-white/20 bg-white/10 px-4 py-3">
                  <img
                    src="/images/aile-logo-white.png"
                    alt="AILE"
                    className="h-14 w-auto object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-white/70">Sistema interno</p>
                  <h1 className="mt-2 text-5xl font-black tracking-tight">Guía rápida</h1>
                </div>
              </div>

              <div className="max-w-3xl space-y-4">
                <p className="text-[19px] leading-8 text-white/92">
                  Resumen visual y breve para compartir por WhatsApp con directores, autoridades y personas
                  que necesitan entender el sistema sin leer un manual largo.
                </p>
                <p className="text-[15px] leading-7 text-white/82">
                  Esta versión prioriza orientación general, recorridos frecuentes y significado de cada
                  pantalla principal.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Formato</p>
                  <p className="mt-2 text-2xl font-black">Rápido</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Bloques</p>
                  <p className="mt-2 text-2xl font-black">{QUICK_GUIDE_SECTIONS.length}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/60">Objetivo</p>
                  <p className="mt-2 text-lg font-black leading-tight">Entender y usar</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">Ideal para compartir</p>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/88">
                <p>Enviar por WhatsApp antes de una reunión o al incorporar a una persona nueva.</p>
                <p>Usar como resumen inicial y luego ampliar con la guía completa dentro del sistema.</p>
                <p>Actualizar cuando cambien módulos, permisos o circuitos internos.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#eadcf4] bg-[#fcf8ff] px-12 py-9">
          <div className="grid grid-cols-[0.9fr_1.1fr] gap-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Resumen</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
                Qué necesita saber alguien para usar AILE sin perderse
              </h2>
            </div>
            <div className="space-y-3 text-[15px] leading-7 text-slate-700">
              <p>
                Esta guía no intenta reemplazar la capacitación completa. Sirve para que una persona se ubique rápido,
                identifique cada módulo y entienda dónde consultar o registrar la información correcta.
              </p>
              <p>
                La regla más importante es esta: cada acción debe hacerse en la pantalla adecuada para que el sistema
                deje registro y la información quede ordenada.
              </p>
            </div>
          </div>
        </section>

        {QUICK_GUIDE_SECTIONS.map((section, index) => (
          <section
            key={section.title}
            className="border-t border-slate-200 px-12 py-9"
            style={index === 0 ? undefined : { breakBefore: "page" }}
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
                <div className="space-y-2">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">
                    {section.eyebrow}
                  </p>
                  <h2 className="text-[32px] font-black leading-tight tracking-tight text-slate-900">
                    {section.title}
                  </h2>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6314a7] text-base font-black text-white">
                  {index + 1}
                </div>
              </div>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-[15px] leading-8 text-slate-700">
                  {paragraph}
                </p>
              ))}

              {section.steps ? (
                <div className="grid gap-3">
                  {section.steps.map((step, stepIndex) => (
                    <div
                      key={step}
                      className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 rounded-2xl border border-[#e7daf3] bg-[#fbf7fe] px-5 py-4"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6314a7] text-sm font-black text-white">
                        {stepIndex + 1}
                      </div>
                      <p className="pt-0.5 text-[15px] leading-7 text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.bullets ? (
                <ul className="grid gap-3">
                  {section.bullets.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-[15px] leading-7 text-slate-700"
                    >
                      <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#e50051]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {"cards" in section && section.cards ? (
                <div className="grid grid-cols-2 gap-4">
                  {section.cards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.35)]"
                    >
                      <p className="text-lg font-black tracking-tight text-slate-900">{card.title}</p>
                      <p className="mt-2 text-[14px] leading-7 text-slate-600">{card.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {"columns" in section && section.columns ? (
                <div className="grid grid-cols-2 gap-4">
                  {section.columns.map((column) => (
                    <div
                      key={column.title}
                      className="rounded-[24px] border border-[#e7daf3] bg-[#fbf7fe] px-5 py-5"
                    >
                      <p className="text-lg font-black tracking-tight text-[#6314a7]">{column.title}</p>
                      <ul className="mt-3 space-y-2">
                        {column.items.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-[14px] leading-7 text-slate-700">
                            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6314a7]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}

              {section.note ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-[14px] leading-7 text-cyan-950">
                  <span className="font-black">Nota:</span> {section.note}
                </div>
              ) : null}
            </div>
          </section>
        ))}

        <section className="border-t border-slate-200 bg-[#16091f] px-12 py-10 text-white">
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-8">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#cea2dc]">Mensaje para reenviar</p>
              <p className="text-[16px] leading-8 text-white/88">
                “Te comparto la guía rápida del sistema interno de AILE. Sirve para entender qué hace cada
                pantalla y por dónde empezar. Si después necesitas más detalle, dentro del sistema está la guía completa.”
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <img
                    src="/images/aile-logo-white.png"
                    alt="AILE"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <div>
                  <p className="text-lg font-black">AILE</p>
                  <p className="text-sm text-white/65">Guía rápida para compartir</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
