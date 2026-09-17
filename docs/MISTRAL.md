# Lectura de planillas con Mistral

El ingreso por planilla usa Mistral Document AI: OCR y anotación estructurada en una solicitud. El navegador sube el archivo a Supabase Storage; la acción del servidor verifica usuario, empresa y tintorería antes de descargarlo y enviarlo a Mistral. No utiliza la prelectura local ni Gemini/OpenRouter en este flujo.

Configuración del servidor:

```dotenv
MISTRAL_API_KEY=...
# Opcional; por defecto se usa mistral-ocr-latest
MISTRAL_OCR_MODEL=mistral-ocr-latest
```

En desarrollo, configurar `.env.local` y reiniciar `npm run dev`. En Vercel, configurar la misma clave en los entornos correspondientes y desplegar nuevamente. Nunca usar `NEXT_PUBLIC_` para esta clave.

La extracción conserva el contrato `{ value, confidence }`, las pistas por tintorería y los catálogos de la empresa. Valida la estructura recibida antes de evaluar totales, filas y campos faltantes. Las confianzas son estimaciones del modelo, no garantías de exactitud. El usuario revisa los datos antes de confirmar el ingreso.

El timeout de Mistral es de 100 segundos, sin reintentos automáticos, dentro de los 120 segundos de la página de ingreso. El botón de reintento reutiliza el archivo ya subido. Los errores de credenciales, facturación, cuota y timeout se muestran sin exponer la respuesta cruda ni la clave.

El SDK requiere `@opentelemetry/api` para compilar con Turbopack, aunque no se configure telemetría.

Validación local: `npm test` y `npm run build`. Para evaluar precisión, probar PDFs y fotos reales y comparar todas las filas, números de pieza, kilos y metros antes de confirmar.

Documentación: https://docs.mistral.ai/studio/document-processing/annotations
