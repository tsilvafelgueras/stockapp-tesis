# StockApp — Contexto del proyecto

> **Cómo usar este documento**: pegá esto al inicio de un chat nuevo cuando quieras retomar el desarrollo desde otra sesión. Está pensado para que un asistente (Claude o quien sea) tenga todo el contexto necesario para seguir colaborando sin que tengas que re-explicar el proyecto.

---

## 1. Identidad y stakeholders

**Producto**: StockApp — sistema multi-tenant de gestión de stock de rollos textiles para PyMEs argentinas.

**Cliente principal de validación**: Muter Textil (fábrica textil con tintorería tercerizada).

**Naturaleza**: MVP de tesis (ITBA — Instituto Tecnológico de Buenos Aires), pensado para escalar y vender a múltiples empresas textiles.

**Equipo de desarrollo**: 4 estudiantes (Trinidad Silva Felgueras lidera el dev). Al menos 1-2 más necesitan acceso de super-admin para ayudar con onboarding de clientes.

**Repo**: https://github.com/tsilvafelgueras/stockapp-tesis (privado, GitHub).

**Path local**: `C:\dev\stockapp-tesis` (intencionalmente fuera de OneDrive, porque OneDrive sincroniza `node_modules` y eso rompe).

**URL en producción**: https://stockapp-tesis.vercel.app

---

## 2. Estilo de colaboración (importante)

- **Argentine Spanish** en todas las respuestas y en la UI.
- **Propose-then-act**: antes de tocar archivos o tomar decisiones técnicas no triviales, explicar qué se va a hacer y esperar OK explícito.
- **Etapas chicas y verificables**: cada etapa termina en algo que la usuaria puede correr y probar antes de avanzar.
- **Sin gold-plating**: priorizar el flujo end-to-end aunque sea simple sobre features perfectas a medias.
- **Cuestionar el pedido si no cierra**: si algo no tiene sentido o se puede simplificar, decirlo en vez de implementarlo igual.
- **Cost-conscious**: solo herramientas con free tier real. Hoy todo corre en $0/mes.

---

## 3. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend / Backend | Next.js 16 (App Router) + TypeScript | Un solo repo, Server Actions para la lógica del backend |
| UI | Tailwind CSS v4 + shadcn/ui | Tema custom: paleta navy + naranja |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage) | Tier gratis. Region: `sa-east-1` (São Paulo) |
| ORM | Ninguno — cliente Supabase JS directo | `@supabase/supabase-js` + `@supabase/ssr` |
| Hosting | Vercel | Region `gru1` (São Paulo) en `vercel.json` para reducir latencia |
| Scanner códigos | `@zxing/browser` (planeado, no instalado aún) | Etapa 4 |
| IA | Gemini 2.5 Flash via `@google/genai` (planeado) | Etapa 3. Único modelo con free tier sin tarjeta |

**Versiones de runtime**: Node.js 24 LTS, npm 11.

**Paleta de colores** (en `src/app/globals.css`, formato oklch):
- Primary (navy): `#1A2744`
- Warning (naranja): `#E8913A`
- Success (verde): `#2E7D32`
- Destructive (rojo): `#C62828`

---

## 4. Modelo de roles

4 roles, definidos en `profiles.role`:

| Rol | Quién | Dónde trabaja | Qué hace |
|---|---|---|---|
| `operario` | Personal de depósito | Mobile-first | Carga despachos manualmente, escanea QR/código de barras para confirmar ingresos, asigna ubicaciones, hace picking de pedidos |
| `ventas` | Empleados de ventas (ej: Belén en Muter) | Desktop | Ve stock, crea pedidos seleccionando rollos específicos, asocia con número de remito externo |
| `admin` | Dueño/gerente de **una empresa-cliente** | Desktop | Gestiona catálogos, equipo, ve reportes, hace bajas, libera reservas. Es superset funcional de ventas y operario para SU empresa |
| `super` | Trinidad y compañeras (gestionan la plataforma StockApp en sí) | Desktop | Crea empresas-cliente, invita primeros admins, ve todas las empresas. NO pertenece a ninguna empresa-cliente |

**Reglas duras (enforced en DB con CHECK constraint)**:
- `role = 'super'` → `empresa_id IS NULL`
- `role IN ('admin', 'ventas', 'operario')` → `empresa_id IS NOT NULL`

---

## 5. Multi-tenant

Cada empresa-cliente tiene **datos completamente aislados**. Belén de Empresa A nunca puede ver un solo dato de Empresa B.

**Cómo se enforza**:
- Tabla `empresas` central
- Cada tabla tenant-specific (profiles, articulos, tintorerias, despachos, rollos, pedidos, pedido_rollos) tiene `empresa_id UUID REFERENCES empresas(id)` NOT NULL
- RLS policies en cada tabla filtran por `empresa_id = current_empresa_id() OR is_super_admin()`
- Trigger BEFORE INSERT en cada tabla auto-rellena `empresa_id` desde el perfil del usuario actual (la app no necesita setearlo explícitamente)
- Helper functions: `current_empresa_id()` y `is_super_admin()` (ambas SECURITY DEFINER, leen del perfil del `auth.uid()`)

---

## 6. Modelo de datos / schema

Tablas principales:

### `empresas`
- id, nombre, activo, created_at
- Lo gestiona super-admin desde `/super`

### `profiles` (extiende `auth.users`)
- id (FK a auth.users), nombre, role (`operario`|`ventas`|`admin`|`super`), empresa_id (nullable solo si super), created_at
- CHECK constraint enforza la regla super ↔ empresa_id NULL

### `articulos`
- id, empresa_id, nombre, descripcion, activo, created_at
- Lo gestionan admin Y operario (lo deciden por flow real: a veces operario carga tintorerías nuevas en el momento)

### `tintorerias`
- id, empresa_id, nombre, activo, created_at
- Mismas reglas que articulos

### `despachos`
- id, empresa_id, tintoreria_id, articulo_id, fecha_despacho, numero_remito, total_rollos_declarado, total_kilos_declarado, estado, **origen** (`manual`|`planilla_ia`), imagen_url, created_by, created_at
- Estados: `borrador` → `auditado` → `confirmado`
- "Despacho" = una llegada de mercadería con su remito (header). Los rollos son las "líneas".

### `rollos`
- id, empresa_id, despacho_id, articulo_id, numero_pieza (string), codigo_externo (QR/barcode de la tintorería), color, **ubicacion** (slot tipo "A42"), pantone, foto_url, kilos, metros, ratio_rendimiento, kilos_propios, metros_propios, ancho_propio, gramaje_propio, estado, confianza_ia, created_at
- Estados: `pendiente` → `en_stock` → `reservado` → `entregado`
- Salidas adicionales: `reservado` → `en_stock` (cancelación), cualquiera → `baja` (dueño)
- UNIQUE (despacho_id, numero_pieza)

### `pedidos`
- id, empresa_id, numero_pedido, cliente, **numero_remito_externo** (link al sistema de facturación tipo Softland), estado, created_by, created_at
- Estados: `pendiente` → `en_preparacion` → `lista` → `entregada` (o `cancelada`)

### `pedido_rollos` (m2m)
- id, empresa_id, pedido_id, rollo_id, created_at
- UNIQUE (rollo_id) — un rollo solo puede estar en un pedido a la vez

**No existen** las tablas `orden_items` ni `asignaciones` (estaban en una versión vieja del schema, fueron dropeadas en la migración 001).

---

## 7. Estructura del código

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Root → redirige según rol
│   ├── layout.tsx                # Root layout (metadata, fonts)
│   ├── globals.css               # Tailwind + theme tokens (navy + naranja)
│   ├── login/page.tsx            # Login email + password
│   │
│   ├── auth/
│   │   ├── confirm/route.ts      # Route handler que verifica token de invitación
│   │   └── setup/                # Pantalla para que invitado defina contraseña
│   │       ├── page.tsx
│   │       └── SetupForm.tsx
│   │
│   ├── super/                    # Solo role='super'
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Lista empresas + form para crear nueva
│   │   ├── NuevaEmpresaForm.tsx
│   │   └── actions.ts            # createEmpresaConAdmin()
│   │
│   ├── admin/                    # Solo role='admin'
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── articulos/            # CRUD de artículos
│   │   ├── tintorerias/          # CRUD de tintorerías
│   │   └── equipo/               # Lista usuarios + invita
│   │       ├── page.tsx
│   │       ├── InviteForm.tsx
│   │       └── actions.ts        # inviteTeamMember()
│   │
│   ├── ventas/                   # role='ventas' o 'admin'
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx    # Solo placeholder (Etapa 6)
│   │
│   └── operario/                 # role='operario' o 'admin'
│       ├── layout.tsx
│       ├── dashboard/page.tsx
│       └── despachos/            # ← acá está el form complejo de Etapa 2
│           ├── page.tsx          # Lista despachos
│           ├── [id]/page.tsx     # Detalle de un despacho
│           └── nuevo/
│               ├── page.tsx
│               ├── NuevoDespachoForm.tsx  # Form con tabla editable de rollos
│               └── actions.ts            # createDespacho() + creates inline de catálogos
│
├── lib/
│   └── supabase/
│       ├── client.ts             # createBrowserClient (para Client Components)
│       ├── server.ts             # createServerClient (para Server Components/Actions)
│       ├── middleware.ts         # Sesión + guards por rol
│       └── admin.ts              # Service-role client (bypassa RLS, solo para super-admin actions)
│
├── components/
│   ├── ui/button.tsx             # Solo este de shadcn está instalado
│   └── LogoutButton.tsx
│
└── middleware.ts                 # Wrapper que llama a updateSession()

supabase/
├── schema.sql                    # Schema canónico para fresh installs
└── migrations/                   # Historial idempotente
    ├── 001_etapa2_refactor.sql              # 3 roles, drop orden_items, rename ordenes→pedidos
    ├── 002_despacho_origen.sql              # despachos.origen
    ├── 003_operario_gestiona_catalogos.sql  # RLS para que operario CRUD catálogos
    ├── 004_operario_inserta_despachos_rollos.sql  # operario INSERT en despachos+rollos
    ├── 005_multi_tenant.sql                 # Tabla empresas, empresa_id en todas las tablas, triggers, RLS
    └── 006_super_admin_internal_empresa.sql # role='super' + empresa_id NULLABLE para super

vercel.json                       # regions: ["gru1"] (São Paulo)
.env.local                        # (gitignored) NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

---

## 8. Migraciones aplicadas (orden)

Todas idempotentes, todas pegadas en Supabase SQL Editor.

| # | Qué hace |
|---|---|
| 001 | Refactor inicial: 3 roles (operario/ventas/admin), drop orden_items+asignaciones, rename ordenes→pedidos, agrega numero_remito_externo, drop estados viejos |
| 002 | `despachos.origen` (`manual` \| `planilla_ia`) |
| 003 | RLS: operario también puede CRUD `articulos` y `tintorerias` |
| 004 | RLS: operario también puede INSERT en `despachos` y `rollos` (no solo UPDATE) |
| 005 | **Multi-tenant**. Tabla `empresas`, `empresa_id` en todas, RLS por empresa, trigger auto-set, helper functions |
| 006 | Super-admin como rol propio (`role='super'`), empresa_id NULLABLE solo para super, CHECK constraint |

**Schema canónico actualizado**: `supabase/schema.sql` refleja el estado FINAL post-006 (para fresh installs).

---

## 9. Flujo de autenticación / invitaciones

**Login**: email + password en `/login`. Una vez logueado, middleware redirige según rol.

**Cómo se crea un usuario nuevo** (ningún sign-up público):

### Caso 1 — Super-admin crea empresa-cliente nueva

1. Trinidad entra a `/super`.
2. Click "+ Nueva empresa", llena nombre + datos del primer admin (nombre + mail real).
3. El server action `createEmpresaConAdmin`:
   - Inserta empresa con admin client (bypassa RLS)
   - Llama `admin.auth.admin.inviteUserByEmail(email, { data: { nombre, role: 'admin', empresa_id }, redirectTo: <site>/auth/confirm?next=/auth/setup })`
4. Supabase manda email al admin invitado.
5. Admin invitado clickea link → `/auth/confirm` → verifica token con `verifyOtp` → redirige a `/auth/setup`.
6. En `/auth/setup` define su contraseña. Ya queda logueado.
7. Lo redirige al dashboard de SU empresa.

### Caso 2 — Admin de una empresa invita a su equipo

Mismo flow pero desde `/admin/equipo`. El rol va en el form (operario|ventas|admin), `empresa_id` se hereda automáticamente del admin que invita.

### ⚠ Email template configurado en Supabase

Por default Supabase usa el flow **legacy** que no funciona con SSR. Hay que customizar el template en:
**Supabase → Authentication → Email Templates → "Invite user"**

```html
<h2>Te invitaron a StockApp</h2>
<p>Hacé click acá para configurar tu contraseña:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/setup">
    Configurar contraseña y entrar
  </a>
</p>
```

**Site URL** y **Redirect URLs** en Supabase Auth tienen que tener `https://stockapp-tesis.vercel.app` y `/auth/confirm`.

---

## 10. Plan de etapas

### Estado actual

| # | Etapa | Estado |
|---|---|---|
| 0 | Bootstrap (Next + Tailwind + shadcn + deploy) | ✅ |
| 1 | Modelo de datos + auth con roles (3 roles iniciales) | ✅ |
| 2 | Ingreso manual de despacho con sus rollos | ✅ |
| Multi-tenant | (no era etapa, se metió entre 2 y 3) | ✅ casi terminada (falta validar último test de invitación con email template fixeado) |
| **3** | **Extracción IA de planilla + auditoría side-by-side** | ⏳ próxima |
| 4 | Confirmación física en mobile (scanner QR/barcode + asignación de ubicación) | ⏳ |
| 5 | Vista de stock con filtros (artículo, color, partida, ubicación) | ⏳ |
| 6 | Pedidos + picking (ventas crea, operario prepara) | ⏳ |
| 7 | Muestras + reportes + **rediseño UI/UX completo + responsive** | ⏳ |

### Polish acordado

En cada etapa que se cierre, dedicar 20-30 min a que la pantalla nueva quede prolija (no cruda). En **Etapa 7** se hace el rediseño grande con sidebar de navegación, drawer en mobile, toasts, dialogs, skeletons, iconos, etc.

### Lo que NO está en el MVP (cosas mencionadas pero pospuestas)

- **Valorización del stock**: costo por rollo (hilado + licra + tintorería + merma), dashboard valorizado solo para dueño. Subsistema entero, post-MVP.
- **Control de calidad en recepción**: kilos/metros/ancho propios vs proveedor, gramaje, listado de fallas con origen, clasificación A/B/C automática.
- **Alertas automáticas**: reserva vencida, stock viejo en crudo (>30 días para poliéster).
- **Módulo chofer**: chofer escanea remito al entregar al cliente final.
- **Edit/delete de catálogos y empresas** (hoy solo se crean; "borrar empresa" se hace via SQL).
- **Sign-up público** (hoy solo invitation-only).

---

## 11. Decisiones de dominio importantes

Surgidas de leer el documento de tesis con entrevistas a Mariela (experta WMS), visita a Muter, charlas con Texcom, Dakuba e ingeniera SIGE.

### Concepto clave: "aduana"

El escaneo del operario es el punto **obligatorio** de entrada y salida. Si escanea un rollo equivocado → BLOQUEAR. Si esperás 15 piezas y solo escaneó 14 → no puede cerrar. Sin esa fricción, el sistema no sirve.

### Quién es dueño del dato

El **operario** es el dueño del dato del stock. Hay que hacerle la app **muy fácil** para que la use. El depósito en Muter rota mucho (4 personas distintas en visitas) — la UX tiene que aprenderse en un día.

### Códigos de rollo

Vienen de la tintorería (no los generamos). Formatos varían (QR + Code128 + EAN). Scanner debe ser adaptable. Fallback: re-OCR de PDF → carga manual.

### Planilla de tintorería (input para Etapa 3)

Llega en papel, foto o PDF. Layout raro: **bloques paralelos de columnas** (no una tabla vertical clásica). Para la IA hay que pedirle "rollos en bloques" explícitamente, no "tabla".

### Modelo de pedidos

Ventas selecciona **rollos específicos** para cubrir un pedido. NO hay "kilos pedidos" como cantidad abstracta. El cliente pide "X kg de tal color", Belén busca y reserva los rollos puntuales. Por eso `pedido_rollos` es m2m simple, no hay tabla de "ítems".

### Estado del despacho derivado

Cuando operario carga manualmente con el toggle "ya están en el depósito", el estado del despacho se calcula desde los rollos: si todos `en_stock` → despacho `confirmado`, si alguno `pendiente` → despacho `borrador`.

---

## 12. Deploy y configuración

### Supabase
- Project URL: `https://cxspdcilrjnjblorbgzy.supabase.co`
- Region: South America (São Paulo)

### Vercel
- Region: `gru1` (São Paulo) — configurado en `vercel.json`
- Framework auto-detected (Next.js)
- Build command: default

### Variables de entorno

| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + .env.local | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + .env.local | "Publishable key" (sb_publishable_...) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Production+Preview, marcado sensitive) + .env.local | service_role key. **NUNCA con prefijo NEXT_PUBLIC_**, **NUNCA commiteada** |

### GitHub
- Repo privado.
- Para que compañeros contribuyan: Settings → Collaborators → invitar por username.
- Cada compañero clona, pone su `.env.local` con las credenciales (compartidas por canal seguro), `npm install`, `npm run dev`.
- Push a `main` redeploya Vercel automático (incluso si el push lo hace un compañero — Vercel está conectado a GitHub).

### Costo
$0 actualmente. Free tiers de GitHub + Vercel + Supabase + Google AI Studio (cuando arranque Etapa 3) cubren un MVP de tesis con margen.

---

## 13. Cosas a recordar (gotchas)

1. **Todas las migraciones son idempotentes** — se pueden re-correr sin romper nada. Pero seguilas en orden.
2. **El path del proyecto es `C:\dev\stockapp-tesis`, no OneDrive**. Si el shell muestra cwd en OneDrive, está bien — solo no edites archivos del proyecto desde ahí.
3. **Cada Bash que abro resetea el PATH**. Para usar Node en bash MSYS hay que `export PATH="/c/Program Files/nodejs:$PATH"` (ya está en `~/.bashrc` pero a veces no se source-a en non-interactive).
4. **Supabase SSR + invite emails**: el template default no funciona, hay que customizarlo (ver Sección 9).
5. **TypeScript con joins de Supabase**: cuando haces `select('rollos(kilos)')`, TS lo tipa como array de un solo objeto a veces. Usar `as unknown as { ... } | null` para casts.
6. **Redirect server-side > client-side**: `router.push(?creado=1)` + `router.refresh()` perdía la query string en Next 16. Usar `redirect()` de `next/navigation` en el Server Action.
7. **Trigger `set_empresa_id`**: si un super-admin intenta INSERT en una tabla tenant-specific, el trigger setea `empresa_id = NULL` y la tabla rechaza con NOT NULL. Esto es **deliberado**: super-admin no debería contaminar datos de cliente. Si quiere actuar sobre una empresa, se loguea como admin de esa empresa.
8. **`is_super_admin()` SQL function** sigue existiendo (la usan muchas RLS), pero internamente ahora chequea `role = 'super'`.
9. **Cuentas de prueba que están dando vueltas**:
   - `admin@probando.com` (admin de Muter Textil — fake email, no recibe mails, password seteado a mano)
   - `tsilvafelgueras@itba.edu.ar` (super-admin de la plataforma — Trinidad)

---

## 14. Cómo seguir

### Para retomar el desarrollo en otro chat

1. Pegá este documento al inicio del chat nuevo.
2. Decile al asistente la próxima etapa que querés encarar.
3. Mencioná tu working style si no está claro: "vamos por etapas chicas, propose-then-act, español argentino, sin gold-plating".

### Lo que viene técnicamente

**Etapa 3 — Extracción IA de planilla**:
- Subir imagen/PDF de la planilla desde `/operario/despachos/nuevo` (o quizá una variante para que admin también lo pueda hacer, ya que el doc dice "Dueño sube PDF").
- Mandar a Gemini 2.5 Flash via `@google/genai` con un prompt estructurado que devuelva JSON: header del despacho + array de rollos con confianza por campo.
- Mostrar pantalla side-by-side: imagen original a la izquierda, tabla editable de rollos extraídos a la derecha. Filas con baja confianza arrancan resaltadas.
- Validaciones automáticas (las mismas que ya existen en el form manual): cantidad de rollos vs declarado, números de pieza únicos, suma de kilos consistente, valores en rangos plausibles.
- Confirmar → rollos quedan en estado `pendiente`, esperando confirmación física por scanner (Etapa 4).
- Necesita `GEMINI_API_KEY` env var en Vercel.
- Storage en Supabase para guardar la imagen original (acceso desde `/operario/despachos/[id]`).

**Etapa 4 — Confirmación física en mobile**:
- `@zxing/browser` para scanner de QR + códigos de barra.
- Vista mobile-first en `/operario/confirmar` con cámara fullscreen.
- Cada scan: matchea `codigo_externo` o `numero_pieza` con un rollo `pendiente` del mismo despacho. Bloquea si no matchea.
- Asigna ubicación al rollo.
- Pasa el rollo a `en_stock`.
- Despacho pasa a `confirmado` cuando todos los rollos están en stock.
