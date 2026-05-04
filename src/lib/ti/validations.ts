import { z } from 'zod'

export const etapa1Schema = z.object({
  solicitante_nome:    z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(120),
  solicitante_email:   z.string().email('E-mail inválido'),
  solicitante_ramal:   z.string().max(20).optional(),
  solicitante_setor:   z.string().min(2, 'Informe o setor').max(100),
  solicitante_unidade: z.string().min(2, 'Informe a unidade').max(100),
})

export const etapa2Schema = z.object({
  categoria_id:      z.string().uuid().optional(),
  subcategoria_id:   z.string().uuid().optional(),
  tipo:              z.enum(['incidente', 'solicitacao', 'problema', 'mudanca']).optional(),
  titulo:            z.string().max(255).optional(),
  descricao:         z.string().min(10, 'Descreva o problema com mais detalhes').max(10000),
  passos_reproduzir: z.string().max(5000).optional(),
  ativo_descricao:   z.string().max(200).optional(),
})

export const criarChamadoSchema = etapa1Schema.merge(etapa2Schema)

export type CriarChamadoFormData = z.infer<typeof criarChamadoSchema>
export type Etapa1FormData       = z.infer<typeof etapa1Schema>
export type Etapa2FormData       = z.infer<typeof etapa2Schema>
