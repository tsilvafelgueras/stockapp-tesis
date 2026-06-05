import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_REPORT_SQL_ROWS,
  validateReportSql,
} from '@/lib/reportes-agent/sqlSafety'
import {
  buildReportesAgentSystemPrompt,
  type ReportesAgentContext,
} from '@/lib/reportes-agent/prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODEL = 'gemini-3.1-flash-lite'
const TOOL_NAME = 'run_report_sql'
const MAX_MESSAGES = 16
const MAX_MESSAGE_CHARS = 4000
const MAX_TOOL_ROUNDS = 3

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AgentRequestBody = {
  messages?: unknown
  context?: ReportesAgentContext
}

const runReportSqlDeclaration: FunctionDeclaration = {
  name: TOOL_NAME,
  description:
    'Ejecuta una consulta SQL SELECT/WITH de solo lectura para reportes. La consulta corre bajo RLS del usuario logueado y devuelve como maximo 100 filas.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sql: {
        type: Type.STRING,
        description:
          'Consulta SQL readonly. Debe empezar con SELECT o WITH, sin punto y coma y sin operaciones de escritura.',
      },
      purpose: {
        type: Type.STRING,
        description: 'Motivo breve por el que esta consulta ayuda a responder.',
      },
    },
    required: ['sql', 'purpose'],
  },
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== 'object') return false
      const m = message as Partial<ChatMessage>
      return (
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
      )
    })
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
}

function toGeminiContents(messages: ChatMessage[]): Content[] {
  const firstUserIndex = messages.findIndex((message) => message.role === 'user')
  const conversation =
    firstUserIndex === -1 ? messages : messages.slice(firstUserIndex)

  return conversation.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
}

function responseText(response: { text?: string }): string {
  return response.text?.trim() ?? ''
}

function modelContentFromResponse(response: {
  candidates?: { content?: Content }[]
  text?: string
}): Content {
  const content = response.candidates?.[0]?.content
  if (content?.parts?.length) return { role: 'model', parts: content.parts }
  return { role: 'model', parts: [{ text: responseText(response) }] }
}

function normalizeRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

async function executeReportSqlTool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  call: FunctionCall
): Promise<Record<string, unknown>> {
  if (call.name !== TOOL_NAME) {
    return { error: `Tool no soportada: ${call.name ?? 'sin nombre'}` }
  }

  const sql = call.args?.sql
  const purpose = typeof call.args?.purpose === 'string' ? call.args.purpose : ''
  const validation = validateReportSql(sql)
  if (!validation.ok) return { error: validation.error }

  const { data, error } = await supabase.rpc('ejecutar_sql_reportes', {
    p_sql: validation.sql,
  })

  if (error) return { error: error.message }

  const rows = normalizeRows(data)
  return {
    rows,
    rowCount: rows.length,
    maxRows: MAX_REPORT_SQL_ROWS,
    purpose,
  }
}

function functionResponsePart(
  call: FunctionCall,
  response: Record<string, unknown>
): Part {
  const functionResponse: {
    id?: string
    name: string
    response: Record<string, unknown>
  } = {
    name: TOOL_NAME,
    response,
  }

  if (call.id) functionResponse.id = call.id

  return { functionResponse }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return json({ error: 'Falta GEMINI_API_KEY en las variables de entorno.' }, 500)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return json({ error: 'No autenticado.' }, 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return json({ error: 'Solo admins pueden usar el agente de reportes.' }, 403)
  }

  let body: AgentRequestBody
  try {
    body = (await request.json()) as AgentRequestBody
  } catch {
    return json({ error: 'Body JSON invalido.' }, 400)
  }

  const messages = sanitizeMessages(body.messages)
  if (!messages.some((message) => message.role === 'user')) {
    return json({ error: 'Falta al menos un mensaje del usuario.' }, 400)
  }

  const ai = new GoogleGenAI({ apiKey })
  const systemInstruction = buildReportesAgentSystemPrompt(body.context ?? {})
  const config = {
    systemInstruction,
    temperature: 0.2,
    maxOutputTokens: 2000,
    tools: [{ functionDeclarations: [runReportSqlDeclaration] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  }

  let contents = toGeminiContents(messages)

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config,
      })

      const calls = response.functionCalls?.filter(
        (call) => call.name === TOOL_NAME
      )

      if (!calls?.length) {
        const text = responseText(response)
        return json({
          message:
            text ||
            'No pude generar una respuesta con los datos disponibles. Proba reformular la pregunta.',
        })
      }

      contents = [...contents, modelContentFromResponse(response)]

      const toolParts = []
      for (const call of calls.slice(0, 3)) {
        const toolResult = await executeReportSqlTool(supabase, call)
        toolParts.push(functionResponsePart(call, toolResult))
      }

      contents = [...contents, { role: 'user', parts: toolParts }]
    }

    return json({
      message:
        'Pude consultar datos, pero no logre cerrar una respuesta final. Proba hacer una pregunta mas puntual.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[reportes-agent] error:', message)
    return json({ error: `Error consultando Gemini: ${message}` }, 500)
  }
}
