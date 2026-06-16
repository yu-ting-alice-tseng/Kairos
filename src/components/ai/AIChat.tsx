'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/i18n'
import { Sparkles, Send, Loader2, X } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AIChatProps {
  lang?: 'fr' | 'en' | 'zh'
  onClose?: () => void
}

export function AIChat({ lang = 'fr', onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: lang === 'fr'
        ? 'Bonjour ! Je suis FlowPlan, votre assistant de planification. Comment puis-je vous aider à organiser vos tâches ?'
        : lang === 'zh'
        ? '你好！我是流光計劃的規劃助手，有什麼可以幫你安排任務的嗎？'
        : "Hello! I'm FlowPlan, your planning assistant. How can I help you organize your tasks?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages, lang }),
      })
      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: lang === 'fr' ? 'Désolé, une erreur est survenue.' : lang === 'zh' ? '抱歉，發生錯誤。' : 'Sorry, an error occurred.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#fbf7ee] rounded-2xl border border-[#ece2cb] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ece2cb] bg-gradient-to-r from-red-50 to-amber-50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-[#2a2420]">{t('aiAssistant', lang)}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}
            <div
              className={`rounded-2xl px-3.5 py-2.5 max-w-[80%] text-sm ${
                msg.role === 'user'
                  ? 'bg-red-800 text-white rounded-tr-sm'
                  : 'bg-[#ece2cb] text-[#3a3326] rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <div className="bg-[#ece2cb] rounded-2xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a99873] animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a99873] animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#a99873] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#ece2cb]">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t('askAI', lang)}
            disabled={loading}
            className="text-sm"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
