import type { Metadata } from 'next'
import './globals.css'
import { MsalProviderWrapper } from '@/lib/msal/MsalProviderWrapper'

export const metadata: Metadata = {
  title: 'Chamados T.I | Helpdesk Costa Lavos',
  description: 'Sistema de Abertura e Gestão de Chamados de T.I',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MsalProviderWrapper>
          {children}
        </MsalProviderWrapper>
      </body>
    </html>
  )
}
