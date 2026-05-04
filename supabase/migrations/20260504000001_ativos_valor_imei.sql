-- Adiciona campos valor_compra e imei à tabela ti_ativos
ALTER TABLE ti_ativos
  ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS imei         VARCHAR(100)  DEFAULT NULL;
