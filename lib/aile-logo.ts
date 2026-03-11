import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { cache } from 'react'

export const getAileLogoDataUrl = cache(async () => {
  const logoBuffer = await readFile(
    join(process.cwd(), 'public', 'images', 'aile-logo-white.png')
  )

  return `data:image/png;base64,${logoBuffer.toString('base64')}`
})
