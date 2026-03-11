import { ImageResponse } from 'next/og'

import { AileSocialPreview } from '@/components/brand/aile-social-preview'
import { getAileLogoDataUrl } from '@/lib/aile-logo'

export const alt = 'Vista de acceso al Sistema Interno AILE'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function TwitterImage() {
  const logoSrc = await getAileLogoDataUrl()

  return new ImageResponse(<AileSocialPreview logoSrc={logoSrc} />, size)
}
