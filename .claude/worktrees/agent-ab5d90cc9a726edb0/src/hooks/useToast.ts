'use client'

import { useState, useCallback } from 'react'
import { ToastVariant } from '@/components/ui/toast'

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  open: boolean
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(
    ({ title, description, variant = 'default' }: { title?: string; description?: string; variant?: ToastVariant }) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, title, description, variant, open: true }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    []
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
