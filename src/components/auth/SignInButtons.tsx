'use client'

import { signIn } from 'next-auth/react'

export function GoogleSignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl: '/today' })}
      className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-[#fbf7ee] px-4 py-3.5 text-sm font-semibold text-[#3a3326] shadow-lg shadow-black/20 hover:bg-[#f3ecdd] transition-all duration-200 hover:scale-[1.015] active:scale-[0.99]"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continuer avec Google
    </button>
  )
}

export function NotionSignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn('notion', { callbackUrl: '/today' })}
      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#fbf7ee]/[0.06] border border-[rgba(225,200,150,0.14)] px-4 py-3.5 text-sm font-semibold text-[#e8d9b8] shadow-lg shadow-black/20 hover:bg-[#fbf7ee]/[0.10] transition-all duration-200 hover:scale-[1.015] active:scale-[0.99]"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
      Continuer avec Notion
    </button>
  )
}
