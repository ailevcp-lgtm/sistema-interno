import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { cache } from 'react'

export const getAileLogoDataUrl = cache(async () => {
  const logoBuffer = await readFile(
    join(process.cwd(), 'public', 'FAVICONS AILE-02.png')
  )

  return `data:image/png;base64,${logoBuffer.toString('base64')}`
})
