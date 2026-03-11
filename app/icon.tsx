import { ImageResponse } from 'next/og'

import { getAileLogoDataUrl } from '@/lib/aile-logo'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

export default async function Icon() {
  const logoSrc = await getAileLogoDataUrl()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <img
          src={logoSrc}
          alt="AILE"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    size
  )
}
