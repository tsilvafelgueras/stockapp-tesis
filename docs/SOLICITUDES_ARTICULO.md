# Artículos pendientes en ingresos

Antes de desplegar este cambio, ejecutar en la base Supabase la migración:

`supabase/migrations/072_solicitudes_articulo.sql`

En Supabase: SQL Editor → New query → pegar el contenido completo del archivo → Run. La migración depende de las migraciones anteriores (hasta 071). Crea una tabla y funciones nuevas; no elimina ingresos ni rollos existentes.

Flujo:

1. Subir la planilla. Los nombres de artículos no encontrados se conservan.
2. En “Artículos nuevos detectados”, revisar o corregir cada nombre y pulsar “Solicitar y asignar”. Una solicitud agrupa todos los rollos del mismo nombre.
3. Guardar el ingreso normalmente. El artículo provisional tiene un ID real, permanece fuera del catálogo activo y sus rollos conservan kilos, colores y números de pieza.
4. Un administrador abre Artículos → Artículos pendientes de aprobación (también desde la notificación) y aprueba.
5. Se activa el mismo artículo; no se duplican ni se reasignan los rollos. El aviso se resuelve automáticamente.

La solicitud exige usuario admin/operario y empresa; la aprobación exige administrador de esa empresa. La tabla solo admite lectura directa. Las RPC realizan la escritura en una transacción. Solicitudes repetidas por nombre normalizado reutilizan el artículo; un artículo dado de baja sin solicitud pendiente no se reactiva por este flujo.

El estado de aprobación del artículo es independiente de la recepción física del ingreso. La aprobación no cambia el estado de los rollos ni sus cantidades. El sistema no crea un nombre si la lectura no detectó ninguno: ese caso sigue requiriendo asignación manual.

Validación: `npm test`, `npm run build` y prueba de PostgreSQL embebido en memoria:

```powershell
npm install --prefix "$env:TEMP/stockapp-articulos-db-tests" --no-audit --no-fund @electric-sql/pglite
node scripts/test-solicitudes-articulo.cjs "$env:TEMP/stockapp-articulos-db-tests"
```

La prueba aplica las migraciones 051 y 072 sobre un esquema mínimo y verifica persistencia de 16 rollos pendientes, deduplicación, aislamiento de empresas, roles, aprobación, colores y resolución del aviso. No se conecta a la base real.
