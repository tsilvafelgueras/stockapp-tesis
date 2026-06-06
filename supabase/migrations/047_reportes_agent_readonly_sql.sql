-- ============================================================
-- Migracion 047 - SQL readonly para agente de reportes
--
-- Expone una RPC acotada para que el agente de reportes pueda
-- ejecutar SELECT/WITH bajo RLS del usuario autenticado.
--
-- Importante:
-- - SECURITY INVOKER: no bypassea RLS.
-- - Solo admins pueden ejecutarla.
-- - Revalida SQL readonly en DB, aunque la app ya lo valide.
-- - Siempre limita el resultado a 100 filas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ejecutar_sql_reportes(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_sql text;
  v_result jsonb;
  v_limit text;
BEGIN
  SELECT role INTO v_role
    FROM public.profiles
   WHERE id = auth.uid();

  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo admins pueden ejecutar SQL de reportes.';
  END IF;

  v_sql := regexp_replace(COALESCE(p_sql, ''), '/\*.*?\*/', ' ', 'gs');
  v_sql := regexp_replace(v_sql, '--[^\r\n]*', ' ', 'g');
  v_sql := btrim(v_sql);

  IF v_sql = '' THEN
    RAISE EXCEPTION 'La consulta SQL esta vacia.';
  END IF;

  IF length(v_sql) > 6000 THEN
    RAISE EXCEPTION 'La consulta es demasiado larga.';
  END IF;

  IF position(';' IN v_sql) > 0 THEN
    RAISE EXCEPTION 'La consulta no puede incluir punto y coma.';
  END IF;

  IF v_sql !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Solo se permiten consultas SELECT o WITH readonly.';
  END IF;

  IF v_sql ~* '\m(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|call|do|set|reset|execute|prepare|deallocate|lock|vacuum|analyze|listen|notify)\M' THEN
    RAISE EXCEPTION 'La consulta usa una operacion no permitida.';
  END IF;

  IF v_sql ~* '\mfor\s+(no\s+key\s+)?update\M'
     OR v_sql ~* '\mfor\s+(key\s+)?share\M'
     OR v_sql ~* '\minto\s+(temporary|temp|unlogged)?\s*[a-z_"]' THEN
    RAISE EXCEPTION 'La consulta usa locking o SELECT INTO, no permitido.';
  END IF;

  IF v_sql ~* '\m(public\.)?(crear_pedido|crear_pedido_por_partidas|cancelar_pedido|entregar_pedido|confirmar_egreso_pedido|pickear_rollo|registrar_muestra|aprobar_solicitud_color|rechazar_solicitud_color|reemplazar_rollo_en_pedido|log_movimiento|pg_sleep|pg_read_file|pg_read_binary_file|nextval|setval|pg_advisory_lock|pg_advisory_xact_lock|pg_terminate_backend|lo_import|lo_export)\s*\(' THEN
    RAISE EXCEPTION 'La consulta llama una funcion no permitida.';
  END IF;

  FOR v_limit IN
    SELECT (m)[1]
      FROM regexp_matches(v_sql, '\mlimit\s+([0-9]+)\M', 'gi') AS m
  LOOP
    IF v_limit::int > 100 THEN
      RAISE EXCEPTION 'El LIMIT maximo permitido es 100.';
    END IF;
  END LOOP;

  PERFORM set_config('statement_timeout', '5000', true);

  EXECUTE
    'SELECT COALESCE(jsonb_agg(to_jsonb(q)), ''[]''::jsonb)
       FROM (SELECT * FROM (' || v_sql || ') AS inner_q LIMIT 100) AS q'
    INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ejecutar_sql_reportes(text) TO authenticated;
