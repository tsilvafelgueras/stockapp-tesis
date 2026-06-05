'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
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
      'Hola, soy el agente de reportes. Puedo ayudarte a leer stock, demanda, tintorerias, calidad y eficiencia usando los filtros actuales de esta pantalla.',
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
            'No pude generar una respuesta. Proba reformular la pregunta.',
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
              <p className="truncate text-[11px] text-white/62">
                Consulta datos con RLS y SQL solo lectura
              </p>
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
                  <pre
                    className={`whitespace-pre-wrap break-words font-mono text-[12px] leading-5 ${
                      message.role === 'user' ? 'text-white' : ''
                    }`}
                  >
                    {message.content}
                  </pre>
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
                placeholder="Ej: comparame merma por tintoreria este anio"
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

