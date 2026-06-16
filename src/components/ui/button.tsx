'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-[#ab3326] text-[#f3ecdd] shadow hover:bg-[#861f17]',
        destructive: 'bg-red-700 text-white shadow hover:bg-red-800',
        outline: 'border border-[#e2d6bc] bg-[#fbf7ee] shadow-sm hover:bg-[#f3ecdd] text-[#2a2420]',
        secondary: 'bg-[#ece2cb] text-[#2a2420] shadow-sm hover:bg-[#e0d3ad]',
        ghost: 'hover:bg-[#ece2cb]/60 text-[#5c5347]',
        link: 'text-[#ab3326] underline-offset-4 hover:underline',
        success: 'bg-[#4f6f5e] text-white shadow hover:bg-[#3d5a4b]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-6',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
