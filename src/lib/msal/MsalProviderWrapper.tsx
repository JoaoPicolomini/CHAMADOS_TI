'use client'

import { ReactNode } from 'react'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config'

// Instancia fora do componente React para não recriar a cada renderização
const msalInstance = new PublicClientApplication(msalConfig)

// É necessário em SRR aguardar a inicialização do Msal no client-side
msalInstance.initialize().catch(console.error)


export function MsalProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  )
}
