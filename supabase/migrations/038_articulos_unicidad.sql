-- ============================================================
-- Migración 038 — Unicidad de articulos por (empresa_id, nombre, color)
--
-- Modelo: una fila de `articulos` representa una combinación
-- concreta (nombre, color). Ej: ("Lycra", "Rojo") y ("Lycra", "Azul")
-- son DOS filas distintas. `color` pasa a NOT NULL y participa de
-- UNIQUE (empresa_id, nombre, color).
--
-- Antes: `articulos.color` era opcional (migración 025), sin unicidad.
-- `createArticuloInline` no normalizaba ni deduplicaba → duplicados
-- accidentales ("LYCRA" vs "lycra" vs "Lycra ").
--
-- `rollos.color` (migración 036) queda DEPRECATED: derivable de
-- `articulos.color` via `articulo_id`. La columna se mantiene por
-- compat con queries existentes (~20 archivos leen r.color directo:
-- reportes, stock, picking, ingresos, pedidos, muestras, CSV). Un
-- trigger BEFORE INSERT/UPDATE en `rollos` garantiza que se mantiene
-- sincronizada con articulos.color.
--
-- Estrategia de backfill defensiva:
--   - articulos.color NULL con todos sus rollos del mismo color
--     → adoptar ese color
--   - articulos.color NULL con rollos de colores distintos
--     → splitear el articulo en N filas y reapuntar cada rollo
--   - articulos.color NULL sin rollos
--     → marcar '__sin_color__' como placeholder visible (el admin lo
--       cura desde /admin/articulos)
--   - duplicados (empresa_id, nombre, color)
--     → elegir canónico por menor created_at, reapuntar FKs, borrar
--
-- Idempotente.
-- ============================================================


-- ── 0. Helper title case ───────────────────────────────────
-- Consistente con normalizarTitleCase en src/lib/text/normalize.ts

CREATE OR REPLACE FUNCTION public.title_case(s TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT INITCAP(LOWER(TRIM(s)));
$$;


-- ── 1. Normalizar articulos.color existente ────────────────
-- Vacíos → NULL para tratarlos en el paso 2.

UPDATE public.articulos
   SET color = NULLIF(public.title_case(color), '')
 WHERE color IS NOT NULL
   AND color <> public.title_case(color);

UPDATE public.articulos
   SET color = NULL
 WHERE color IS NOT NULL
   AND TRIM(color) = '';


-- ── 2. Backfill articulos.color = NULL ─────────────────────

-- 2.a) Si todos los rollos del articulo tienen un único color → adoptar
UPDATE public.articulos a
   SET color = sub.color_unico
  FROM (
    SELECT r.articulo_id,
           MIN(public.title_case(r.color)) AS color_unico
      FROM public.rollos r
     WHERE r.color IS NOT NULL AND TRIM(r.color) <> ''
     GROUP BY r.articulo_id
    HAVING COUNT(DISTINCT public.title_case(r.color)) = 1
  ) sub
 WHERE sub.articulo_id = a.id
   AND a.color IS NULL;

-- 2.b) Si los rollos tienen N>1 colores distintos → splitear el articulo
-- Para cada color extra de cada articulo, crear una fila nueva en
-- articulos con ese color y reapuntar los rollos correspondientes.
-- El color "principal" (MIN alfabético) ya quedó en la fila original
-- por la lógica de 2.a (que también se aplica a estos casos cuando
-- el grupo tiene 1 color). Acá completamos los colores extra.
DO $$
DECLARE
  rec RECORD;
  nuevo_id UUID;
BEGIN
  FOR rec IN
    SELECT a.id AS viejo_id,
           a.empresa_id,
           a.nombre,
           a.descripcion,
           a.activo,
           a.stock_minimo_kg,
           public.title_case(r.color) AS color_nuevo
      FROM public.articulos a
      JOIN public.rollos r ON r.articulo_id = a.id
     WHERE a.color IS NOT NULL  -- ya fue procesado por 2.a (si era 1-color)
       AND r.color IS NOT NULL AND TRIM(r.color) <> ''
       AND public.title_case(r.color) <> a.color
     GROUP BY a.id, a.empresa_id, a.nombre, a.descripcion,
              a.activo, a.stock_minimo_kg, public.title_case(r.color)
  LOOP
    -- ¿Ya existe articulo con (nombre, color_nuevo)? Reusar.
    SELECT id INTO nuevo_id
      FROM public.articulos
     WHERE empresa_id = rec.empresa_id
       AND nombre = rec.nombre
       AND color = rec.color_nuevo;

    IF nuevo_id IS NULL THEN
      INSERT INTO public.articulos
        (empresa_id, nombre, color, descripcion, activo, stock_minimo_kg)
      VALUES
        (rec.empresa_id, rec.nombre, rec.color_nuevo, rec.descripcion,
         rec.activo, rec.stock_minimo_kg)
      RETURNING id INTO nuevo_id;
    END IF;

    UPDATE public.rollos
       SET articulo_id = nuevo_id
     WHERE articulo_id = rec.viejo_id
       AND public.title_case(color) = rec.color_nuevo;
  END LOOP;
END $$;

-- 2.c) Articulos sin rollos y color NULL → placeholder visible
UPDATE public.articulos
   SET color = '__sin_color__'
 WHERE color IS NULL;


-- ── 3. Dedupe defensivo ────────────────────────────────────
-- Si quedaron grupos (empresa_id, nombre, color) repetidos, elegir
-- canónico por menor created_at y reapuntar todas las FKs.

DO $$
DECLARE
  grupo RECORD;
  canon UUID;
BEGIN
  FOR grupo IN
    SELECT empresa_id, nombre, color
      FROM public.articulos
     GROUP BY empresa_id, nombre, color
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO canon
      FROM public.articulos
     WHERE empresa_id = grupo.empresa_id
       AND nombre = grupo.nombre
       AND color = grupo.color
     ORDER BY created_at ASC, id ASC
     LIMIT 1;

    UPDATE public.rollos SET articulo_id = canon
     WHERE articulo_id IN (
       SELECT id FROM public.articulos
        WHERE empresa_id = grupo.empresa_id
          AND nombre = grupo.nombre
          AND color = grupo.color
          AND id <> canon
     );

    UPDATE public.ingresos SET articulo_id = canon
     WHERE articulo_id IN (
       SELECT id FROM public.articulos
        WHERE empresa_id = grupo.empresa_id
          AND nombre = grupo.nombre
          AND color = grupo.color
          AND id <> canon
     );

    UPDATE public.pedidos_pendientes SET articulo_id = canon
     WHERE articulo_id IN (
       SELECT id FROM public.articulos
        WHERE empresa_id = grupo.empresa_id
          AND nombre = grupo.nombre
          AND color = grupo.color
          AND id <> canon
     );

    DELETE FROM public.articulos
     WHERE empresa_id = grupo.empresa_id
       AND nombre = grupo.nombre
       AND color = grupo.color
       AND id <> canon;
  END LOOP;
END $$;


-- ── 4. NOT NULL + UNIQUE en articulos ──────────────────────

ALTER TABLE public.articulos
  ALTER COLUMN color SET NOT NULL;

ALTER TABLE public.articulos
  DROP CONSTRAINT IF EXISTS articulos_empresa_nombre_color_key;

ALTER TABLE public.articulos
  ADD CONSTRAINT articulos_empresa_nombre_color_key
  UNIQUE (empresa_id, nombre, color);


-- ── 5. Trigger de sincronización rollos.color ──────────────
-- Mantiene rollos.color = articulos.color del articulo_id apuntado.
-- Si articulo_id es NULL, no toca rollos.color (legacy permitido).
-- Se dispara también si alguien intenta editar rollos.color directo
-- → lo sobrescribe con articulos.color. POR DISEÑO: el color del
-- rollo deriva del articulo_id, no se setea independiente. Para
-- cambiar el color de un rollo, hay que reapuntar articulo_id a
-- la fila (mismo_nombre, nuevo_color).

CREATE OR REPLACE FUNCTION public.sync_rollo_color_from_articulo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.articulo_id IS NOT NULL THEN
    SELECT color INTO NEW.color
      FROM public.articulos
     WHERE id = NEW.articulo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_rollo_color ON public.rollos;
CREATE TRIGGER sync_rollo_color
  BEFORE INSERT OR UPDATE OF articulo_id, color
  ON public.rollos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rollo_color_from_articulo();


-- ── 6. Backfill final rollos.color = articulos.color ───────
-- Para rollos cuya articulo_id ya apunta a la fila correcta pero
-- el rollos.color quedó desincronizado (case mismatch, viejo).

UPDATE public.rollos r
   SET color = a.color
  FROM public.articulos a
 WHERE r.articulo_id = a.id
   AND (r.color IS NULL OR r.color <> a.color);
