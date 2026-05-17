-- Altera sla_horas_pausadas de INT para NUMERIC para suportar frações de hora.
-- Isso evita perda de precisão em pausas curtas (ex: 45 min = 0.75h).
ALTER TABLE ti_chamados
  ALTER COLUMN sla_horas_pausadas TYPE NUMERIC USING sla_horas_pausadas::numeric;
