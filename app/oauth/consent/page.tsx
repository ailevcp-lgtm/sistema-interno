import { Suspense } from 'react'
import OAuthConsentClient from './oauth-consent-client'

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={null}>
      <OAuthConsentClient />
    </Suspense>
  )
}
