import React from 'react'
import { cn } from '@/lib/utils'

interface LinkifiedTextProps {
  text: string
  className?: string
  linkClassName?: string
}

const URL_SPLIT_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/gi
const URL_TEST_REGEX = /^(?:https?:\/\/|www\.)[^\s]+$/i

function normalizeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function splitTrailingPunctuation(url: string) {
  let end = url.length
  while (end > 0 && /[.,!?;:)\]}]$/.test(url[end - 1])) {
    end -= 1
  }

  return {
    core: url.slice(0, end),
    trailing: url.slice(end),
  }
}

export function LinkifiedText({ text, className, linkClassName }: LinkifiedTextProps) {
  const lines = text.split(/\r?\n/)

  return (
    <span className={cn('break-words', className)}>
      {lines.map((line, lineIndex) => {
        const chunks = line.split(URL_SPLIT_REGEX)

        return (
          <React.Fragment key={`line-${lineIndex}`}>
            {chunks.map((chunk, chunkIndex) => {
              if (!chunk) return null
              if (!URL_TEST_REGEX.test(chunk)) {
                return <React.Fragment key={`txt-${lineIndex}-${chunkIndex}`}>{chunk}</React.Fragment>
              }

              const { core, trailing } = splitTrailingPunctuation(chunk)
              if (!core) {
                return <React.Fragment key={`txt-${lineIndex}-${chunkIndex}`}>{chunk}</React.Fragment>
              }

              return (
                <React.Fragment key={`url-${lineIndex}-${chunkIndex}`}>
                  <a
                    href={normalizeHref(core)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('text-primary underline underline-offset-2 hover:text-primary/80 break-all', linkClassName)}
                  >
                    {core}
                  </a>
                  {trailing}
                </React.Fragment>
              )
            })}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        )
      })}
    </span>
  )
}
