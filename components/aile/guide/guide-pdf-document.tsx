"use client"

import { GUIDE_CHAPTERS, type GuideChapter, type GuideSection } from "@/lib/guide-content"

const SIMPLE_ROLES = [
  {
    title: "Socio",
    text: "Consulta su información personal, revisa su estado de cuenta y accede a las pantallas habilitadas para seguimiento general.",
  },
  {
    title: "Comisión Directiva",
    text: "Trabaja sobre la gestión institucional, revisa información sensible y toma decisiones dentro del sistema.",
  },
  {
    title: "Revisor de Cuentas",
    text: "Accede principalmente a información de control y consulta, sobre todo en temas económicos y administrativos.",
  },
  {
    title: "Administrador",
    text: "Mantiene la estructura general del sistema y puede configurar reglas, permisos y parámetros.",
  },
] as const

const MANUAL_KEYS = [
  "Explica qué hace el sistema y para qué existe dentro de AILE.",
  "Describe cada pantalla con palabras simples y sin lenguaje técnico.",
  "Indica cómo usar cada módulo paso a paso según la tarea a realizar.",
  "Ayuda a ubicar dudas frecuentes sin depender de explicaciones informales.",
] as const

const USAGE_RECOMMENDATIONS = [
  "Entrar primero a Inicio para tener una lectura general del estado de la institución.",
  "Ir después al módulo correcto según la tarea concreta que se quiere resolver.",
  "Registrar cada acción en la pantalla que corresponde para que quede trazabilidad.",
  "Volver al sistema más adelante y encontrar la información ordenada, clara y completa.",
] as const

function chapterNumber(index: number) {
  return String(index + 1).padStart(2, "0")
}

function renderParagraphs(section: GuideSection) {
  return section.body?.map((paragraph, index) => (
    <p key={`${section.title}-body-${index}`} className="mt-4 text-[15px] leading-8 text-slate-700">
      {paragraph}
    </p>
  ))
}

function renderBullets(section: GuideSection) {
  if (!section.bullets?.length) return null

  return (
    <ul className="mt-5 space-y-3">
      {section.bullets.map((item, index) => (
        <li
          key={`${section.title}-bullet-${index}`}
          className="flex items-start gap-3 text-[15px] leading-7 text-slate-700"
        >
          <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#e50051]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function renderSteps(section: GuideSection) {
  if (!section.steps?.length) return null

  return (
    <ol className="mt-5 space-y-3">
      {section.steps.map((step, index) => (
        <li
          key={`${section.title}-step-${index}`}
          className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-4 text-[15px] leading-7 text-slate-700"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6314a7]/10 text-sm font-black text-[#6314a7]">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function ChapterSectionCard({ section }: { section: GuideSection }) {
  return (
    <div className="avoid-break rounded-[24px] border border-slate-200 bg-white px-6 py-6 shadow-[0_12px_36px_-30px_rgba(15,23,42,0.45)]">
      <h3 className="text-xl font-black tracking-tight text-slate-900">{section.title}</h3>
      {renderParagraphs(section)}
      {renderBullets(section)}
      {renderSteps(section)}

      {section.note ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-[14px] leading-7 text-cyan-950">
          <span className="font-black">Nota:</span> {section.note}
        </div>
      ) : null}

      {section.caution ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] leading-7 text-amber-950">
          <span className="font-black">Importante:</span> {section.caution}
        </div>
      ) : null}
    </div>
  )
}

function ChapterPage({ chapter, index }: { chapter: GuideChapter; index: number }) {
  return (
    <section className="pdf-page page-break bg-white px-12 py-12">
      <div className="space-y-8">
        <div className="avoid-break rounded-[28px] border border-[#e7d7f2] bg-[linear-gradient(135deg,#fcf8ff_0%,#ffffff_65%,#fff3f8_100%)] px-8 py-8">
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 rounded-full bg-[#6314a7]/8 px-4 py-2 text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">
                <span>Capítulo {chapterNumber(index)}</span>
              </div>
              <div>
                <h2 className="text-[34px] font-black leading-tight tracking-tight text-slate-900">
                  {chapter.shortTitle}
                </h2>
                <p className="mt-3 max-w-3xl text-[15px] leading-8 text-slate-700">
                  {chapter.description}
                </p>
              </div>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#6314a7] text-xl font-black text-white">
              {chapterNumber(index)}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6314a7]">Pensado para</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">{chapter.audience.join(" • ")}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6314a7]">Qué vas a encontrar</p>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                Este capítulo explica cómo usar esta parte del sistema, qué información muestra y en qué casos conviene entrar.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {chapter.sections.map((section) => (
            <ChapterSectionCard key={section.title} section={section} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function GuidePdfDocument() {
  const moduleChapters = GUIDE_CHAPTERS.filter((chapter) => chapter.route)

  return (
    <div className="min-h-screen bg-[#f3edf8] text-slate-900">
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0;
            padding: 0;
            background: #f3edf8;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        .pdf-page {
          width: 210mm;
          min-height: 297mm;
        }

        .page-break {
          break-before: page;
          page-break-before: always;
        }

        .avoid-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `}</style>

      <div
        id="guide-pdf-root"
        className="mx-auto bg-white shadow-[0_24px_90px_-50px_rgba(99,20,167,0.35)] print:shadow-none"
        style={{ width: "210mm" }}
      >
        <section className="pdf-page relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#6314a7_0%,#7d2bc0_48%,#e50051_100%)]" />
          <div className="absolute -right-16 top-[-10px] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-[-40px] top-[220px] h-56 w-56 rounded-full bg-[#00a3e2]/25 blur-3xl" />

          <div className="relative z-10 flex min-h-[297mm] flex-col justify-between px-12 pb-12 pt-12 text-white">
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                <div className="rounded-[28px] border border-white/25 bg-white/10 px-5 py-4 backdrop-blur-sm">
                  <img
                    src="/images/aile-logo-white.png"
                    alt="AILE"
                    className="h-14 w-auto object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-white/70">Sistema interno AILE</p>
                  <h1 className="mt-2 text-5xl font-black tracking-tight">Manual completo de uso</h1>
                </div>
              </div>

              <div className="grid grid-cols-[1.2fr_0.8fr] gap-8">
                <div className="space-y-5">
                  <p className="max-w-3xl text-[19px] leading-9 text-white/92">
                    Guía pensada para directores, autoridades y personas que necesitan entender el sistema
                    con un lenguaje claro, simple y orientado al uso diario.
                  </p>
                  <p className="max-w-3xl text-[15px] leading-8 text-white/82">
                    Este documento explica para qué existe el sistema, qué hace cada pantalla, cómo se
                    usa cada módulo y qué debe saber una persona que nunca trabajó antes con una herramienta de gestión.
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/60">Capítulos</p>
                      <p className="mt-2 text-3xl font-black">{GUIDE_CHAPTERS.length}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/60">Pantallas</p>
                      <p className="mt-2 text-3xl font-black">{moduleChapters.length}</p>
                    </div>
                    <div className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/60">Enfoque</p>
                      <p className="mt-2 text-lg font-black leading-tight">Lenguaje simple</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/60">Actualización</p>
                  <p className="mt-2 text-2xl font-black">11 de marzo de 2026</p>
                  <div className="mt-5 space-y-3 text-[14px] leading-7 text-white/88">
                    <p>Documento preparado para lectura directa y para compartir fuera del sistema.</p>
                    <p>La idea es que cualquier persona autorizada pueda ubicarse sin depender de explicaciones técnicas.</p>
                    <p>Siempre que cambien módulos o circuitos internos, conviene actualizar este manual.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {MANUAL_KEYS.slice(0, 2).map((item) => (
                <div key={item} className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-5 backdrop-blur-sm">
                  <p className="text-[15px] leading-7 text-white/90">{item}</p>
                </div>
              ))}
              {MANUAL_KEYS.slice(2).map((item) => (
                <div key={item} className="rounded-[24px] border border-white/15 bg-white/10 px-5 py-5 backdrop-blur-sm">
                  <p className="text-[15px] leading-7 text-white/90">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pdf-page page-break bg-[#fcf9ff] px-12 py-12">
          <div className="space-y-8">
            <div className="avoid-break rounded-[28px] border border-[#eadcf4] bg-white px-8 py-8">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Antes de empezar</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                Qué conviene entender primero
              </h2>
              <div className="mt-5 space-y-4 text-[15px] leading-8 text-slate-700">
                <p>
                  El sistema interno de AILE reúne en un solo lugar la información y las acciones más importantes
                  del trabajo institucional: personas, cuotas, calendario, tareas, documentos, movimientos,
                  tesorería, análisis financiero y reintegros.
                </p>
                <p>
                  La lógica general es simple: cada persona entra con su cuenta, ve solo lo que necesita según
                  su rol y realiza sus acciones dentro de la pantalla correcta para que todo quede registrado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[1.05fr_0.95fr] gap-6">
              <div className="avoid-break rounded-[28px] border border-slate-200 bg-white px-7 py-7">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Cómo usar este manual</p>
                <ol className="mt-5 space-y-4">
                  {USAGE_RECOMMENDATIONS.map((item, index) => (
                    <li
                      key={item}
                      className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 text-[15px] leading-7 text-slate-700"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6314a7] text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="avoid-break rounded-[28px] border border-slate-200 bg-white px-7 py-7">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Roles explicados de forma simple</p>
                <div className="mt-5 space-y-4">
                  {SIMPLE_ROLES.map((role) => (
                    <div key={role.title} className="rounded-2xl border border-[#ece4f5] bg-[#fcf8ff] px-4 py-4">
                      <p className="text-lg font-black tracking-tight text-slate-900">{role.title}</p>
                      <p className="mt-2 text-[15px] leading-7 text-slate-700">{role.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="avoid-break rounded-[28px] border border-slate-200 bg-white px-7 py-7">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Pantallas principales del sistema</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {moduleChapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    className="rounded-2xl border border-[#ece4f5] bg-[linear-gradient(135deg,#ffffff_0%,#fbf6ff_100%)] px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6314a7] text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <p className="text-base font-black tracking-tight text-slate-900">{chapter.shortTitle}</p>
                    </div>
                    <p className="mt-3 text-[14px] leading-6 text-slate-700">{chapter.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pdf-page page-break bg-white px-12 py-12">
          <div className="space-y-8">
            <div className="avoid-break rounded-[28px] border border-[#eadcf4] bg-[linear-gradient(135deg,#fcf8ff_0%,#ffffff_100%)] px-8 py-8">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6314a7]">Índice</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
                Contenido completo del manual
              </h2>
              <p className="mt-4 text-[15px] leading-8 text-slate-700">
                El orden recomendado es empezar por los dos primeros capítulos para entender la lógica general
                y después avanzar pantalla por pantalla según el trabajo que cada persona necesite realizar.
              </p>
            </div>

            <div className="space-y-4">
              {GUIDE_CHAPTERS.map((chapter, index) => (
                <div
                  key={chapter.id}
                  className="avoid-break flex items-start gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_24px_-30px_rgba(15,23,42,0.4)]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6314a7] text-sm font-black text-white">
                    {chapterNumber(index)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black tracking-tight text-slate-900">{chapter.shortTitle}</p>
                    <p className="mt-1 text-[15px] leading-7 text-slate-700">{chapter.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {GUIDE_CHAPTERS.map((chapter, index) => (
          <ChapterPage key={chapter.id} chapter={chapter} index={index} />
        ))}

        <section className="pdf-page page-break bg-[#13071d] px-12 py-12 text-white">
          <div className="space-y-8">
            <div className="rounded-[30px] border border-white/10 bg-white/5 px-8 py-8">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d7b3ea]">Cierre</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">
                Qué idea tiene que quedar clara
              </h2>
              <div className="mt-5 space-y-4 text-[16px] leading-9 text-white/88">
                <p>
                  El sistema interno de AILE está pensado para ordenar el trabajo institucional, no para complicarlo.
                </p>
                <p>
                  Cada persona entra, encuentra la pantalla que necesita, registra la acción correspondiente
                  y puede volver después para revisar esa información de manera clara y ordenada.
                </p>
                <p>
                  Cuando aparece una duda, casi siempre conviene revisar estas cuatro preguntas: qué se quiere hacer,
                  en qué pantalla corresponde, si el rol actual permite esa acción y si la información ya fue cargada.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 px-7 py-7">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d7b3ea]">Recomendación de uso</p>
                <ul className="mt-5 space-y-3">
                  {MANUAL_KEYS.map((item, index) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-white/82">
                      <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-[#e50051]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 px-7 py-7">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d7b3ea]">Identidad AILE</p>
                <div className="mt-5 flex items-center gap-4">
                  <div className="rounded-[24px] bg-white/10 p-4">
                    <img
                      src="/images/aile-logo-white.png"
                      alt="AILE"
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-2xl font-black">AILE</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Asociación Independiente para Líderes Empoderados
                    </p>
                  </div>
                </div>
                <p className="mt-6 text-[15px] leading-7 text-white/82">
                  Manual completo del sistema interno orientado a directores y usuarios que necesitan una guía clara,
                  detallada y fácil de consultar.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
