'use client'

import {
  Fragment,
  type ReactNode,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AgentResponse = {
  message?: string
  error?: string
}

const initialMessages: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Hola, soy el agente de reportes. Puedo ayudarte a leer stock, demanda, tintorerías, calidad y eficiencia usando los filtros actuales de esta pantalla.',
  },
]

const CONTEXT_KEYS = [
  'tab',
  'anio',
  'mes',
  'tintoreria',
  'articulo',
  'desde',
  'hasta',
] as const

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${match.index}-strong`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      )
    } else {
      parts.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function parseTable(lines: string[], start: number) {
  const rows: string[][] = []
  let cursor = start

  while (cursor < lines.length && /^\s*\|.*\|\s*$/.test(lines[cursor])) {
    const cells = lines[cursor]
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    rows.push(cells)
    cursor += 1
  }

  if (rows.length < 2) return null
  const separator = rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))
  if (!separator) return null

  return {
    headers: rows[0],
    body: rows.slice(2),
    next: cursor,
  }
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let cursor = 0

  while (cursor < lines.length) {
    const line = lines[cursor]
    const trimmed = line.trim()

    if (!trimmed) {
      cursor += 1
      continue
    }

    const table = parseTable(lines, cursor)
    if (table) {
      blocks.push(
        <div key={`table-${cursor}`} className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-[12px]">
            <thead>
              <tr>
                {table.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="border-b border-border bg-muted/60 px-2 py-1.5 font-semibold text-foreground"
                  >
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/70 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-2 py-1.5">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      cursor = table.next
      continue
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      blocks.push(
        <h3 key={`heading-${cursor}`} className="mt-2 text-sm font-semibold first:mt-0">
          {renderInline(heading[2])}
        </h3>
      )
      cursor += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (cursor < lines.length && /^[-*]\s+/.test(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^[-*]\s+/, ''))
        cursor += 1
      }
      blocks.push(
        <ul key={`list-${cursor}`} className="list-disc space-y-1 pl-4">
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    const paragraph: string[] = []
    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !/^\s*\|.*\|\s*$/.test(lines[cursor]) &&
      !/^(#{2,4})\s+/.test(lines[cursor].trim()) &&
      !/^[-*]\s+/.test(lines[cursor].trim())
    ) {
      paragraph.push(lines[cursor].trim())
      cursor += 1
    }

    blocks.push(
      <p key={`paragraph-${cursor}`} className="leading-5">
        {renderInline(paragraph.join(' '))}
      </p>
    )
  }

  return (
    <div className="space-y-2 text-sm leading-5">
      {blocks.map((block, index) => (
        <Fragment key={index}>{block}</Fragment>
      ))}
    </div>
  )
}

export default function ReportesAgentWidget() {
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, loading, open])

  function currentContext() {
    const context: Record<string, string> = {}
    for (const key of CONTEXT_KEYS) {
      const value = searchParams.get(key)
      if (value) context[key] = value
    }
    return context
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const content = input.trim()
    if (!content || loading) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/reportes/agent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context: currentContext(),
        }),
      })

      const payload = (await response.json()) as AgentResponse
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? 'No se pudo consultar el agente.')
      }

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content:
            payload.message ??
            'No pude generar una respuesta. Probá reformular la pregunta.',
        },
      ])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo consultar el agente.'
      setError(message)
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `No pude responder esta consulta: ${message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  function resetChat() {
    setMessages(initialMessages)
    setInput('')
    setError(null)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-5 sm:right-5">
      {open && (
        <section
          className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border bg-white shadow-2xl"
          aria-label="Agente de reportes"
        >
          <header className="flex items-center gap-3 border-b bg-sidebar px-3 py-2.5 text-white">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/12">
              <Bot className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">
                Agente de reportes
              </h2>
              {/* <p className="truncate text-[11px] text-white/62">
                Consulta datos con RLS y SQL solo lectura
              </p> */}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={resetChat}
              title="Limpiar chat"
              aria-label="Limpiar chat"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              title="Cerrar"
              aria-label="Cerrar agente"
            >
              <X className="size-4" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/30 p-3">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-lg border px-3 py-2 text-sm leading-5 shadow-sm ${
                    message.role === 'user'
                      ? 'border-action/30 bg-action text-action-foreground'
                      : 'border-border bg-white text-foreground'
                    }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownContent content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm text-white">
                      {message.content}
                    </p>
                  )}
                </div>
              </article>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground shadow-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Analizando datos...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {error && (
            <p className="border-t bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <form onSubmit={sendMessage} className="border-t bg-white p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={loading}
                placeholder="Ej: Comparame merma por tintorería este año"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-md border border-input px-3 py-2 text-sm"
              />
              <Button
                type="submit"
                size="icon-lg"
                disabled={loading || input.trim().length === 0}
                aria-label="Enviar mensaje"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </form>
        </section>
      )}

      <Button
        type="button"
        size="lg"
        onClick={() => setOpen((value) => !value)}
        className="h-12 rounded-full px-4 shadow-lg"
        aria-expanded={open}
        aria-label={open ? 'Cerrar agente de reportes' : 'Abrir agente de reportes'}
      >
        <MessageCircle className="size-5" />
        <span className="hidden sm:inline">Agente</span>
      </Button>
    </div>
  )
}
