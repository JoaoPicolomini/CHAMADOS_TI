import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redireciona a raiz do projeto (antigo RNC) direto para o módulo de Chamados de TI
  redirect('/ti')
}