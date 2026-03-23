import type { Metadata, ResolvingMetadata } from "next"
import { createClient } from "@supabase/supabase-js"

// Cliente de Supabase para obtener datos públicos durante SSR
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Props = {
  params: Promise<{ slug: string }>
}

function stripHtml(html: string) {
  if (!html) return ""
  // Reemplazar etiquetas HTML por espacios y estandarizar
  const text = html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()
  return text.substring(0, 160) + (text.length > 160 ? "..." : "")
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params

  try {
    const { data: prop, error } = await supabase
      .from("propuestas")
      .select("titulo, contenido, hero_image_url")
      .eq("slug", slug)
      .maybeSingle()

    if (error || !prop) {
      return {
        title: "Propuesta no encontrada | AILE",
      }
    }

    const title = `${prop.titulo} | AILE`
    const description = prop.contenido ? stripHtml(prop.contenido) : "Propuesta Institucional de AILE."
    
    // Imagen por defecto si la propuesta no tiene un hero image
    const ogImage = prop.hero_image_url || "https://aile.com.ar/FAVICONS%20AILE-02.png"

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://aile.com.ar/p/${slug}`,
        siteName: "AILE",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: prop.titulo,
          },
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
      alternates: {
        canonical: `https://aile.com.ar/p/${slug}`,
      },
    }
  } catch (error) {
    return {
      title: "Propuesta | AILE",
    }
  }
}

export default function PublicPropuestaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
