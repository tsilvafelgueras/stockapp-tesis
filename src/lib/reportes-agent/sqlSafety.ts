import 'server-only'

export const MAX_REPORT_SQL_ROWS = 100
const MAX_SQL_LENGTH = 6000

type SqlValidationResult =
  | { ok: true; sql: string }
  | { ok: false; error: string }

const FORBIDDEN_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'INSERT', pattern: /\binsert\b/i },
  { label: 'UPDATE', pattern: /\bupdate\b/i },
  { label: 'DELETE', pattern: /\bdelete\b/i },
  { label: 'MERGE', pattern: /\bmerge\b/i },
  { label: 'ALTER', pattern: /\balter\b/i },
  { label: 'DROP', pattern: /\bdrop\b/i },
  { label: 'CREATE', pattern: /\bcreate\b/i },
  { label: 'TRUNCATE', pattern: /\btruncate\b/i },
  { label: 'GRANT', pattern: /\bgrant\b/i },
  { label: 'REVOKE', pattern: /\brevoke\b/i },
  { label: 'COPY', pattern: /\bcopy\b/i },
  { label: 'CALL', pattern: /\bcall\b/i },
  { label: 'DO', pattern: /\bdo\b/i },
  { label: 'SET', pattern: /\bset\b/i },
  { label: 'RESET', pattern: /\breset\b/i },
  { label: 'EXECUTE', pattern: /\bexecute\b/i },
  { label: 'PREPARE', pattern: /\bprepare\b/i },
  { label: 'DEALLOCATE', pattern: /\bdeallocate\b/i },
  { label: 'LOCK', pattern: /\block\b/i },
  { label: 'VACUUM', pattern: /\bvacuum\b/i },
  { label: 'ANALYZE', pattern: /\banalyze\b/i },
  { label: 'LISTEN', pattern: /\blisten\b/i },
  { label: 'NOTIFY', pattern: /\bnotify\b/i },
  { label: 'SELECT INTO', pattern: /\binto\s+(temporary|temp|unlogged)?\s*[a-z_"]/i },
  { label: 'FOR UPDATE', pattern: /\bfor\s+(no\s+key\s+)?update\b/i },
  { label: 'FOR SHARE', pattern: /\bfor\s+(key\s+)?share\b/i },
  { label: 'crear_pedido', pattern: /\b(public\.)?crear_pedido\s*\(/i },
  { label: 'cancelar_pedido', pattern: /\b(public\.)?cancelar_pedido\s*\(/i },
  { label: 'entregar_pedido', pattern: /\b(public\.)?entregar_pedido\s*\(/i },
  { label: 'confirmar_egreso_pedido', pattern: /\b(public\.)?confirmar_egreso_pedido\s*\(/i },
  { label: 'pickear_rollo', pattern: /\b(public\.)?pickear_rollo\s*\(/i },
  { label: 'registrar_muestra', pattern: /\b(public\.)?registrar_muestra\s*\(/i },
  { label: 'aprobar_solicitud_color', pattern: /\b(public\.)?aprobar_solicitud_color\s*\(/i },
  { label: 'rechazar_solicitud_color', pattern: /\b(public\.)?rechazar_solicitud_color\s*\(/i },
  { label: 'reemplazar_rollo_en_pedido', pattern: /\b(public\.)?reemplazar_rollo_en_pedido\s*\(/i },
  { label: 'log_movimiento', pattern: /\b(public\.)?log_movimiento\s*\(/i },
  { label: 'pg_sleep', pattern: /\bpg_sleep\s*\(/i },
  { label: 'pg_read_file', pattern: /\bpg_read_file\s*\(/i },
  { label: 'pg_read_binary_file', pattern: /\bpg_read_binary_file\s*\(/i },
  { label: 'nextval', pattern: /\bnextval\s*\(/i },
  { label: 'setval', pattern: /\bsetval\s*\(/i },
  { label: 'pg_advisory_lock', pattern: /\bpg_advisory(_xact)?_lock\s*\(/i },
  { label: 'pg_terminate_backend', pattern: /\bpg_terminate_backend\s*\(/i },
  { label: 'lo_import', pattern: /\blo_import\s*\(/i },
  { label: 'lo_export', pattern: /\blo_export\s*\(/i },
]

export function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .trim()
}

function explicitLimitOverMax(sql: string): number | null {
  const matches = sql.matchAll(/\blimit\s+(\d+)\b/gi)
  for (const match of matches) {
    const value = Number(match[1])
    if (Number.isFinite(value) && value > MAX_REPORT_SQL_ROWS) return value
  }
  return null
}

export function validateReportSql(sql: unknown): SqlValidationResult {
  if (typeof sql !== 'string') {
    return { ok: false, error: 'La consulta SQL debe ser texto.' }
  }

  const clean = stripSqlComments(sql)
  if (!clean) return { ok: false, error: 'La consulta SQL esta vacia.' }
  if (clean.length > MAX_SQL_LENGTH) {
    return {
      ok: false,
      error: `La consulta es demasiado larga. Maximo: ${MAX_SQL_LENGTH} caracteres.`,
    }
  }
  if (clean.includes(';')) {
    return { ok: false, error: 'La consulta no puede incluir punto y coma.' }
  }
  if (!/^(select|with)\b/i.test(clean)) {
    return { ok: false, error: 'Solo se permiten consultas SELECT o WITH readonly.' }
  }

  const forbidden = FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(clean))
  if (forbidden) {
    return {
      ok: false,
      error: `La consulta usa una operacion no permitida para reportes: ${forbidden.label}.`,
    }
  }

  const limit = explicitLimitOverMax(clean)
  if (limit !== null) {
    return {
      ok: false,
      error: `El LIMIT maximo permitido es ${MAX_REPORT_SQL_ROWS}; recibido: ${limit}.`,
    }
  }

  return { ok: true, sql: clean }
}
