import { Configuration } from '@azure/msal-browser'

// Validação simples para identificar no console da aplicação se as variáveis sumiram
if (typeof window !== 'undefined') {
  if (!process.env.NEXT_PUBLIC_AZURE_CLIENT_ID) {
    console.warn('MSAL: NEXT_PUBLIC_AZURE_CLIENT_ID não está definido.')
  }
}

export const msalConfig: Configuration = {
  auth: {
    // Client ID gerado pelo Azure App Registration
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',

    // URLs do Tenant, onde o "common" permite todos ou o ID específico fixa no corporativo
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,

    // Redireciona de volta p/ raiz para processar a autenticação
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
  },
  cache: {
    cacheLocation: 'sessionStorage', // localStorage para persistir mais ou sessionStorage para mais segurança
  }
}

// Permissões iniciais que serão pedidas pro usuário ao logar
export const loginRequest = {
  scopes: ['User.Read', 'email'],
  prompt: 'select_account'
}
