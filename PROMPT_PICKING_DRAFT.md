# Prompt: Picking en borrador local + botón "Aceptar pedido"

Contexto del proyecto: Next.js App Router + TypeScript, Server Components +
Server Actions, Supabase Postgres con RLS multi-tenant (`empresa_id`), RPCs
`SECURITY DEFINER` en plpgsql con row locking (`FOR UPDATE`). Working branch:
`development`.

## Problema

En `/picking/[id]` ([src/app/picking/[id]/PickingScanner.tsx](src/app/picking/[id]/PickingScanner.tsx)),
cada vez que el operario escanea un rollo se llama de inmediato a la server
action `pickearRollo` ([src/app/picking/[id]/actions.ts](src/app/picking/[id]/actions.ts)),
que ejecuta la RPC `pickear_rollo` y escribe en la base al toque
(`pedido_rollos`, `rollos.estado`).

Esto hace que `/pedidos/[id]` (que ventas/admin pueden estar mirando) muestre
los rollos pickeados en tiempo real, ANTES de que el operario termine de
armar el pedido. Feedback de un operario (Enzo): le resulta invasivo que
ventas vea movimientos a medias mientras él todavía está trabajando ("como
que nos pisamos"). Quiere poder seguir viendo/ajustando su picking sin que se
refleje hasta confirmar.

## Objetivo

Cambiar el flujo de picking para que:

1. Los escaneos/agregados/reemplazos/quitados de rollos se mantengan en un
   **estado local (borrador)** en el navegador del operario, sin tocar la
   base de datos.
2. Recién al apretar un botón **"Aceptar pedido"** (o similar) se mande TODO
   el borrador junto al backend, en una operación que aplique los cambios de
   forma atómica.
3. El historial (`log_movimiento`) y los estados de `pedido_rollos`/`rollos`
   reflejen el resultado final, sin pasos intermedios visibles para otros
   roles.

## Restricciones / cosas a decidir con el usuario antes de programar

- **Persistencia del borrador**: ¿se pierde si el operario cierra la pestaña,
  o se guarda en `localStorage`/`sessionStorage` por `pedidoId` para poder
  retomar?
- **Validación de stock al aceptar**: otro pedido podría haber tomado esos
  rollos mientras el operario tenía el borrador abierto. La RPC de "aceptar"
  debe revalidar disponibilidad y devolver errores claros por rollo si algo
  ya no está disponible (sin perder el resto del borrador).
- **Reemplazos y "quitar" dentro del borrador**: si el operario escanea, después
  reemplaza, y después quita un rollo — todo eso debe resolverse a un estado
  final coherente antes de mandar al backend (no se debe trackear el
  historial de pasos intermedios, solo el resultado neto).
- **Qué pasa con "Confirmar egreso"**: actualmente el flujo permite confirmar
  egreso cuando `pedido.estado === 'lista'`
  ([src/app/picking/[id]/page.tsx](src/app/picking/[id]/page.tsx),
  `ConfirmarEgresoCard`). Definir si "Aceptar pedido" es un paso separado de
  "Confirmar egreso" o si se fusionan.
- **Multi-dispositivo**: si el mismo pedido se pickea desde dos sesiones
  (poco probable pero posible), ¿qué pasa con los dos borradores?

## Archivos relevantes para entender el flujo actual

- [src/app/picking/[id]/page.tsx](src/app/picking/[id]/page.tsx) — carga
  partidas/items desde Supabase, decide si se puede pickear
  (`pickeable || listo`).
- [src/app/picking/[id]/PickingScanner.tsx](src/app/picking/[id]/PickingScanner.tsx) —
  componente cliente con el escáner, lista de partidas/items, modales de
  reemplazo y quitar. Acá vive hoy la lógica de "cada acción pega al
  backend".
- [src/app/picking/[id]/actions.ts](src/app/picking/[id]/actions.ts) — server
  actions: `pickearRollo`, `reemplazarRolloEnPicking`, `quitarRolloDePicking`.
  Cada una llama una RPC distinta (`pickear_rollo`,
  `reemplazar_rollo_picking`, `quitar_rollo_picking`).
- Migraciones relevantes: `supabase/migrations/050_pedidos_edicion_tareas_reemplazo.sql`
  (RPCs originales) y `supabase/migrations/056_picking_quitar_rollo_y_fix_reemplazo.sql`
  (fix + RPC de quitar).
- [src/lib/picking.ts](src/lib/picking.ts) y
  [src/lib/picking.test.ts](src/lib/picking.test.ts) — helper
  `buildUbicacionesSugeridas` con tests Vitest (único test infra del repo).

## Qué se espera del trabajo

1. Empezar por una conversación de diseño con el usuario para resolver los
   puntos de "Restricciones / cosas a decidir" antes de tocar código.
2. Diseñar la nueva RPC (probablemente `aplicar_picking_pedido` o similar)
   que reciba el estado final del borrador (lista de rollos a pickear,
   reemplazar, quitar) y lo aplique todo en una transacción, devolviendo
   errores por ítem si algo falló.
3. Refactorizar `PickingScanner.tsx` para que las acciones de escanear/
   reemplazar/quitar solo actualicen estado local (`useState`/`useReducer`),
   y agregar el botón "Aceptar pedido" que llama a la nueva RPC.
4. Mantener el `log_movimiento` con el detalle relevante (sin loguear cada
   paso intermedio del borrador, salvo que se decida lo contrario).
5. Probar manualmente el flujo completo en `/picking/[id]` antes de dar por
   terminado: escanear varios rollos, reemplazar uno, quitar otro, y recién
   ahí aceptar — verificar que `/pedidos/[id]` no muestra nada hasta aceptar,
   y que después de aceptar todo queda consistente.

No es un fix chico — es un cambio de arquitectura del flujo de picking.
Trabajar en `development`, no mergear a `main` hasta probar.
