'use client'

import { ToastProvider as RadixToastProvider, ToastViewport } from '@radix-ui/react-toast'
import { Toast } from '@/components/ui/toast'
import { useToast } from '@/hooks/useToast'
import React, { createContext, useContext } from 'react'
import { ToastVariant } from '@/components/ui/toast'

interface ToastContextValue {
  toast: (opts: { title?: string; description?: string; variant?: ToastVariant }) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useGlobalToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, dismiss } = useToast()

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToastProvider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            open={t.open}
            onOpenChange={(open) => !open && dismiss(t.id)}
            title={t.title}
            description={t.description}
            variant={t.variant}
          />
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  )
}
