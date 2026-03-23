"use client"

import { useEffect, useState, use } from "react"
import { supabase } from "@/lib/supabase"
import type { Propuesta } from "@/lib/types"
import { Loader2, ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

export default function PublicPropuestaPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [data, setData] = useState<Propuesta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data?.seo_titulo) document.title = data.seo_titulo;
    if (data?.seo_descripcion) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', data.seo_descripcion);
    }
  }, [data])

  useEffect(() => {
    async function loadPropuesta() {
      try {
        const { data: prop, error: fetchError } = await supabase
          .from("propuestas")
          .select("*, creadoPor:created_by(id, nombre, apellido, avatar_url)")
          .eq("slug", slug)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (!prop) {
          setError("No se encontró la propuesta solicitada o no está disponible.")
        } else {
          setData(prop as Propuesta)
        }
      } catch (err) {
        console.error("Error fetching public propuesta:", err)
        setError("Ocurrió un error al cargar la propuesta.")
      } finally {
        setLoading(false)
      }
    }

    void loadPropuesta()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50">
        <Loader2 className="w-8 h-8 animate-spin text-[#6314a7] mb-4" />
        <p className="text-muted-foreground animate-pulse">Cargando propuesta...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-2xl shadow-sm border border-border">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">{error || "Propuesta no encontrada"}</h2>
          <p className="text-muted-foreground">La URL puede ser incorrecta o la propuesta ya no está disponible.</p>
          <div className="pt-6">
            <a href="https://aile.com.ar" className="text-[#6314a7] hover:underline font-medium">Conocer más sobre AILE</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-purple-500/30 selection:text-purple-900">
      {/* Navbar with deep purple background */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#541296] border-b border-white/10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-center">
          <a href="https://aile.com.ar" className="flex items-center justify-center hover:opacity-90 transition-opacity">
            <img 
              src="/FAVICONS AILE-02.png" 
              alt="AILE" 
              className="h-10 w-auto" 
            />
          </a>
        </div>
      </nav>

      {/* Hero Section with Purple Gradient Overlay */}
      <div 
        className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-[#541296]"
        style={data.hero_image_url ? {
          backgroundImage: `url(${data.hero_image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#6314a7] via-[#541296] to-[#3a086b] opacity-80 mix-blend-multiply z-0" />
        <div className="absolute inset-0 bg-[url('/images/hero-pattern.svg')] opacity-10 mix-blend-overlay z-0" />
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-purple-400 blur-3xl opacity-20 z-0" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-500 blur-3xl opacity-30 z-0" />
        
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-3 py-1 mb-6 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs font-semibold tracking-widest text-white/90 uppercase shadow-sm">
            Propuesta Institucional
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight drop-shadow-lg">
            {data.titulo}
          </h1>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 lg:-mt-20 mb-20">
        <article className="bg-white rounded-3xl shadow-xl shadow-purple-900/5 border border-gray-100 p-8 sm:p-12 lg:p-16">
          {data.secciones && data.secciones.length > 0 ? (
            data.secciones.sort((a, b) => a.orden - b.orden).map(sec => {
              const tipo = (sec.tipo || 'Texto').trim().toLowerCase();
              const cleanUrl = (sec.contenido || '').replace(/<[^>]*>?/gm, '').trim();
              
              return (
                <div key={sec.id} className="mb-12 last:mb-0">
                  {sec.titulo && <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 mt-12 mb-6">{sec.titulo}</h2>}
                  {tipo === 'texto' && (
                    <div
                      className="prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-700
                                 prose-headings:text-gray-900 prose-headings:font-bold prose-headings:tracking-tight
                                 prose-p:leading-relaxed prose-p:mb-6
                                 prose-a:text-[#6314a7] prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                                 prose-img:rounded-2xl prose-img:shadow-lg prose-img:my-10 mx-auto
                                 prose-ul:list-disc prose-li:my-2"
                      dangerouslySetInnerHTML={{ __html: sec.contenido }}
                    />
                  )}
                  {tipo === 'imagen' && cleanUrl && (
                    <div className="my-10">
                      <img src={cleanUrl} alt={sec.titulo || "Imagen de propuesta"} className="rounded-2xl shadow-lg w-full h-auto object-cover" />
                    </div>
                  )}
                  {tipo === 'video' && sec.contenido && (
                    <div className="my-10 aspect-video rounded-2xl overflow-hidden shadow-lg bg-black">
                      {sec.contenido.includes('<iframe') ? (
                        <div dangerouslySetInnerHTML={{ __html: sec.contenido }} className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />
                      ) : (
                        <iframe src={cleanUrl} className="w-full h-full" frameBorder="0" allowFullScreen />
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div
              className="prose prose-sm sm:prose-base lg:prose-lg max-w-none text-gray-700
                         prose-headings:text-gray-900 prose-headings:font-bold prose-headings:tracking-tight
                         prose-p:leading-relaxed prose-p:mb-6
                         prose-a:text-[#6314a7] prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                         prose-img:rounded-2xl prose-img:shadow-lg prose-img:my-10 mx-auto
                         prose-ul:list-disc prose-li:my-2"
              dangerouslySetInnerHTML={{ __html: data.contenido || '' }}
            />
          )}

          {/* Footer Contact Block */}
          <div className="mt-16 sm:mt-24 bg-gradient-to-br from-[#f8f5fc] to-[#f1ebf9] rounded-2xl p-8 sm:p-10 border border-[#6314a7]/10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6314a7] opacity-5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500 opacity-5 blur-2xl rounded-full -translate-x-1/2 translate-y-1/2" />
            
            <h3 className="relative z-10 text-xl font-bold text-[#4a0f7d] mb-3">¿Querés avanzar con esta propuesta?</h3>
            <p className="relative z-10 text-gray-600 mb-8 max-w-md mx-auto">
              Estamos a tu entera disposición para agendar reuniones, detallar los alcances o responder consultas.
            </p>
            <a 
              href="mailto:ailevcp@gmail.com"
              className="relative z-10 inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-full text-white bg-[#6314a7] hover:bg-[#541296] transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              Contactar a AILE
            </a>
          </div>
        </article>
      </main>
    </div>
  )
}
