import type { MetadataRoute } from 'next'

import {
  ICON_VERSION,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
} from '@/lib/site-config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F1F6',
    theme_color: '#6314A7',
    lang: 'es-AR',
    icons: [
      {
        src: `/icon?v=${ICON_VERSION}`,
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: `/apple-icon?v=${ICON_VERSION}`,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
