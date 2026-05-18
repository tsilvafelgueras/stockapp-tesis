-- Migración 014: columna disabled en profiles
--
-- Permite que el admin desactive temporalmente a un usuario sin eliminarlo.
-- La desactivación también banea la cuenta en Supabase Auth (vía acción del servidor)
-- para impedir el inicio de sesión. El campo es solo para visualización y filtrado.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
