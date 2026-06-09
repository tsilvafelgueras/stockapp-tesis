-- Migration 051: Bidirectional auto-propagation between colores and articulos
--
-- Trigger A: new color → all active articles of the same company
-- Trigger B: new article → all active colors of the same company
-- Backfill: populate all missing (articulo, color) combos for existing data

-- ── Trigger A ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.propagate_new_color_to_articulos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO articulo_colores (empresa_id, articulo_id, color_id)
  SELECT a.empresa_id, a.id, NEW.id
  FROM articulos a
  WHERE a.empresa_id = NEW.empresa_id AND a.activo = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_color_to_articulos ON public.colores;
CREATE TRIGGER trg_propagate_color_to_articulos
  AFTER INSERT ON public.colores
  FOR EACH ROW EXECUTE FUNCTION public.propagate_new_color_to_articulos();

-- ── Trigger B ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.propagate_colors_to_new_articulo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO articulo_colores (empresa_id, articulo_id, color_id)
  SELECT NEW.empresa_id, NEW.id, c.id
  FROM colores c
  WHERE c.empresa_id = NEW.empresa_id AND c.activo = true
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_colors_to_new_articulo ON public.articulos;
CREATE TRIGGER trg_propagate_colors_to_new_articulo
  AFTER INSERT ON public.articulos
  FOR EACH ROW EXECUTE FUNCTION public.propagate_colors_to_new_articulo();

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Populate all missing (articulo, color) combinations for active records.

INSERT INTO articulo_colores (empresa_id, articulo_id, color_id)
SELECT a.empresa_id, a.id, c.id
FROM articulos a
CROSS JOIN colores c
WHERE a.empresa_id = c.empresa_id
  AND a.activo = true
  AND c.activo = true
ON CONFLICT DO NOTHING;
