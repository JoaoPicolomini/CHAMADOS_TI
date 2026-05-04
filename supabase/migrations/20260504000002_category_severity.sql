-- ============================================================
-- CHAMADOS T.I — Severidade por Categoria
-- Adiciona coluna de severidade padrão às categorias para simplificar SLA.
-- ============================================================

ALTER TABLE ti_categorias 
ADD COLUMN IF NOT EXISTS severidade TEXT CHECK (severidade IN ('critica', 'alta', 'media', 'baixa'));

COMMENT ON COLUMN ti_categorias.severidade IS 'Prioridade padrão da categoria/subcategoria. Se definida, força o SLA correspondente.';
