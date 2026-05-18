-- Migración 012: solo admin puede crear/modificar tintorerías
--
-- Antes: "Operario y admin gestionan tintorerias" (FOR ALL) permitía
-- a operarios insertar tintorerías nuevas, lo cual era incorrecto.
-- La lectura (SELECT) ya está cubierta por la política existente
-- "Autenticados leen tintorerias de su empresa".

DROP POLICY IF EXISTS "Operario y admin gestionan tintorerias" ON tintorerias;

CREATE POLICY "Admin gestiona tintorerias"
  ON tintorerias FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
