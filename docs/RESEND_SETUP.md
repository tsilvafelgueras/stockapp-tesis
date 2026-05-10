# Setup de SMTP con Resend (bloqueante para launch)

Supabase Auth viene con un servicio de email built-in que tiene un cap **duro de 2 emails/hora por proyecto**. Eso alcanza para desarrollo y testing pero **no escala a producción**: una empresa-cliente onboardeando + invitando 2-3 usuarios pega el límite y los siguientes mails fallan en silencio.

Este límite no se levanta con plan paid de Supabase (ni Pro $25/mes ni Team $599/mes lo aumentan — está deprecado para producción). La solución es configurar SMTP custom con un proveedor externo. Recomendado: **Resend** — 3.000 emails/mes free, sin tarjeta.

---

## Pasos (≈20 min, una vez)

### 1. Cuenta en Resend
1. Crear cuenta gratis en https://resend.com.
2. Verificar el email.

### 2. Verificar un dominio
Resend requiere que mandes desde un dominio propio (no se puede usar gmail/etc).

Opciones:
- **Comprar `stockapp.com.ar` o `stockapp.app`** (≈$15-30 USD/año en Namecheap o Hover). Esto da credibilidad de marca para los emails.
- **Reutilizar un dominio existente** si ya tenés uno propio.

Una vez tengas el dominio:
1. En Resend → Domains → Add Domain → `stockapp.com.ar`.
2. Copiar los 3 records DNS que muestra (SPF, DKIM, MX).
3. Pegarlos en el panel DNS del dominio (Namecheap/Cloudflare/etc).
4. Esperar verificación (suele tomar 5-30 min).
5. Cuando aparezca "Verified" en Resend, listo.

### 3. Crear API key en Resend
1. Resend → API Keys → Create.
2. Permisos: `Sending access` para el dominio verificado.
3. Copiar la key (solo se muestra una vez).

### 4. Configurar Supabase
Supabase Dashboard → tu proyecto → **Authentication → SMTP Settings**:

```
Enable Custom SMTP:    ✓
Sender email:          no-reply@stockapp.com.ar
Sender name:           StockApp
Host:                  smtp.resend.com
Port:                  465
Username:              resend
Password:              <la API key que copiaste>
Min interval:          0
```

Guardar.

### 5. Subir el rate limit
**Authentication → Rate Limits**:
- "Rate limit for sending emails" → subir de 2/hora a **60-100/hora**.

Guardar.

### 6. Probar
Desde la app:
1. `/super` → invitar admin a una empresa de prueba con un email real tuyo.
2. Verificar que el email llegó desde `no-reply@stockapp.com.ar` (no desde `noreply@mail.app.supabase.io`).
3. Confirmar que se puede invitar 5+ usuarios seguidos sin que falle.

---

## Costos

| Concepto | Costo |
|---|---|
| Cuenta Resend | $0 (3.000 emails/mes free) |
| Dominio `stockapp.com.ar` | ~$15-30 USD/año (Namecheap, Hover) |
| Subir el rate limit Supabase | $0 |

**Total**: $15-30 USD/año para tener emails de invitación funcionando en escala razonable.

---

## Síntomas si NO está hecho

- **En testing**: invitás 3 usuarios seguidos → el 3ro nunca recibe email. Te frustrás.
- **En producción**: una empresa-cliente onboardea con admin + 4-5 operarios. Los 2 primeros entran. Los siguientes 3 quedan en limbo: en `/admin/equipo` figuran como invitados pero nunca pueden activar la cuenta. Soporte manual obligatorio.

---

## Alternativas si Resend no convence

- **Mailgun**: free tier (100 emails/día). Setup similar.
- **AWS SES**: muy barato pero setup más complejo (sandbox vs producción, verificación AWS).
- **Postmark**: pago desde día 1.

Resend es el más friendly para un MVP y el free tier alcanza para 5-10 empresas-cliente de tamaño Muter onboardeando en simultáneo.
