-- Corrige o trigger de violação de SLA para considerar pausas.
-- Antes: comparava sla_prazo < now() sem considerar horas pausadas.
-- Depois: usa o prazo ajustado (sla_prazo + pausas acumuladas) e
--         não marca violação enquanto o SLA estiver pausado (sla_pausado_em IS NOT NULL).
CREATE OR REPLACE FUNCTION ti_check_sla_violation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  prazo_ajustado TIMESTAMPTZ;
BEGIN
  IF NEW.sla_prazo IS NOT NULL
    AND NEW.sla_violado = false
    AND NEW.sla_pausado_em IS NULL
  THEN
    prazo_ajustado := NEW.sla_prazo
      + (COALESCE(NEW.sla_horas_pausadas, 0) * INTERVAL '1 hour');

    IF prazo_ajustado < now() THEN
      NEW.sla_violado    = true;
      NEW.sla_violado_em = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
