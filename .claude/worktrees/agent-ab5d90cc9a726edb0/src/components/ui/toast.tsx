'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitive.Provider
const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn('fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col-reverse gap-2', className)}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = {
  default: 'bg-white border-gray-200',
  success: 'bg-emerald-50 border-emerald-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
}

type ToastVariant = keyof typeof toastVariants

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  title?: string
  description?: string
}

const Toast = React.forwardRef<React.ComponentRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = 'default', title, description, children, ...props }, ref) => {
    const icons: Record<ToastVariant, React.ReactNode> = {
      default: <Info className="h-4 w-4 text-gray-500" />,
      success: <CheckCircle className="h-4 w-4 text-emerald-600" />,
      error: <AlertCircle className="h-4 w-4 text-red-600" />,
      info: <Info className="h-4 w-4 text-blue-600" />,
    }
    return (
      <ToastPrimitive.Root
        ref={ref}
        className={cn(
          'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
          toastVariants[variant],
          className
        )}
        {...props}
      >
        <span className="mt-0.5 shrink-0">{icons[variant]}</span>
        <div className="flex-1 gap-1">
          {title && <ToastPrimitive.Title className="text-sm font-semibold text-gray-900">{title}</ToastPrimitive.Title>}
          {description && <ToastPrimitive.Description className="text-xs text-gray-600">{description}</ToastPrimitive.Description>}
          {children}
        </div>
        <ToastPrimitive.Close className="absolute right-2 top-2 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X className="h-3.5 w-3.5" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    )
  }
)
Toast.displayName = ToastPrimitive.Root.displayName

export { ToastProvider, ToastViewport, Toast }
export type { ToastVariant }
