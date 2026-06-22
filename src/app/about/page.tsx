'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Lang = 'zh' | 'en' | 'fr'

const LANG_LABELS: Record<Lang, string> = { zh: '中文', en: 'EN', fr: 'FR' }

const features = {
  zh: [
    { title: '任務矩陣（Matrix）', body: '運用艾森豪矩陣，以毛筆觸感流暢拖曳，在「重要」與「緊急」之間精準定奪落筆的先後順序。' },
    { title: '縱橫日曆（Calendar）', body: '完美同步 Google Calendar、Outlook 與 Notion，週視圖時間軸將事件與習慣等比例並排呈現，讓繁雜的行程如行雲流水般清晰。' },
    { title: '習慣年輪（Habits）', body: '自由設定每日或工作日頻率，在日曆與矩陣中同步勾勒完成狀態，以連續天數統計（Streak）凝聚你的持之以恆。' },
    { title: '逆向流光（Retroplanning）', body: '智能偵測關鍵字，一鍵自動套用專案與考試範本，逆向生成前置任務鏈條，未來進度一目了然。' },
  ],
  en: [
    { title: 'The Task Matrix', body: 'Visualize your priorities using the Eisenhower Matrix. Seamlessly drag and drop tasks to balance the urgent and the important with the fluid grace of a brushstroke.' },
    { title: 'Unified Calendar', body: 'Sync Google Calendar, Outlook, and Notion. The weekly timeline displays events, tasks, and habits proportionally, automatically aligning overlapping schedules.' },
    { title: 'Habit Tracker', body: 'Define flexible routines (daily, weekdays, weekends). Your streak statistics and completion states sync flawlessly across the calendar and matrix.' },
    { title: 'Retroplanning Chains', body: 'Detect keywords automatically to generate a backward-planned timeline from custom or built-in templates (exams, projects), tracking progress through an intuitive chain view.' },
  ],
  fr: [
    { title: 'Matrice des Tâches', body: "Priorisez vos objectifs grâce à la matrice d'Eisenhower. Glissez-déposez vos tâches avec la fluidité d'un pinceau pour distinguer l'important de l'urgent." },
    { title: 'Calendrier Intégré', body: 'Synchronisez Google Calendar, Outlook et Notion. Le calendrier hebdomadaire affiche proportionnellement vos événements, tâches et habitudes, avec un alignement automatique.' },
    { title: 'Suivi des Habitudes', body: 'Configurez vos routines (quotidiennes, jours ouvrés, week-ends). Vos statistiques de régularité et statuts se synchronisent instantanément sur la matrice et le calendrier.' },
    { title: 'Rétroplanning Automatique', body: "Détectez les mots-clés pour générer instantanément une chaîne de sous-tâches à partir de modèles personnalisés ou intégrés (examens, projets), offrant une vue d'ensemble sur votre progression." },
  ],
}

const hero = {
  zh: {
    sub: '潑墨成時，掌握生命中的關鍵時刻',
    philosophy: `在古希臘語中，時間有兩種面貌：不斷流逝的秒針（Chronos），與代表「關鍵與契機」的決定性瞬間（Kairos）。「墨時」，則是將無形的時間落墨於宣紙之上。\n\n我們將傳統東方水墨的硃紅、赭金與墨色融入視覺，以「鑿壁偷光」的專注精神，將現代高效工具轉化為一幅流暢的生活畫卷。`,
    aiLabel: '🤖 AI 智能輔助', aiBody: '內建可選的 AI 助手，為你智能拆解複雜專案並提供排程建議。',
    triLabel: '🌐 三語無界', triBody: '側邊欄支援法文、英文、繁體中文一鍵切換。',
    visitorLabel: '👁 訪客模式', visitorBody: '無需繁瑣註冊，開啟「訪客模式」即可立刻體驗完整功能。',
    cta: '開始使用', featureTitle: '四大核心墨章',
  },
  en: {
    sub: 'Capture the Meaningful Moments, Shape Your Legacy in Ink',
    philosophy: `Ancient Greeks defined time in two ways: Chronos, the sequential clock, and Kairos, the opportune moment that demands action. "MoShi" (墨時) means "Inking Time."\n\nBlending eastern ink-wash aesthetics with professional productivity, this app transforms time management into an art form. Inspired by the spirit of "boring a hole in the wall to catch the light" (鑿壁偷光), we help you carve out focus from a chaotic world.`,
    aiLabel: '🤖 AI Companion', aiBody: 'Leverage AI-powered task deconstruction, morning summaries, and smart rescheduling.',
    triLabel: '🌐 Trilingual Flow', triBody: 'Instantly switch between French, English, and Traditional Chinese with one click.',
    visitorLabel: '👁 Visitor Mode', visitorBody: 'Explore the complete experience immediately with our Visitor Mode — no registration required.',
    cta: 'Get Started', featureTitle: 'Core Capabilities',
  },
  fr: {
    sub: "Maîtrisez l'Instant Décisif, Peignez le Temps à l'Encre",
    philosophy: `Dans la Grèce antique, le temps possédait deux visages : Chronos, le temps linéaire, et Kairos, l'instant opportun, le moment décisif. « MoShi » (墨時) signifie « Mettre le temps en encre ».\n\nEn unissant l'esthétique du lavis oriental (nuances d'encre, vermillon et or ocre) aux outils de productivité modernes, Kairos transforme la gestion du temps en un art de vivre fluide, guidé par la philosophie de « percer le mur pour y dérober la lumière » (鑿壁偷光).`,
    aiLabel: '🤖 Assistance IA', aiBody: "Bénéficiez d'une IA optionnelle pour décomposer vos projets complexes et optimiser votre emploi du temps.",
    triLabel: '🌐 Interface Trilingue', triBody: "Basculez instantanément entre le français, l'anglais et le chinois traditionnel.",
    visitorLabel: '👁 Mode Invité', visitorBody: "Découvrez l'intégralité de l'application sans inscription grâce au Mode Invité.",
    cta: 'Commencer', featureTitle: 'Fonctionnalités Clés',
  },
}

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>('zh')
  const h = hero[lang]
  const feats = features[lang]

  return (
    <div className="relative min-h-screen bg-[#fbeacb] text-[#2a1f12]"
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.022 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    >
      {/* Ambient warm blooms */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[500px] w-[500px] rounded-full bg-[#ef8a32]/[0.06] blur-[120px]" />
        <div className="absolute top-[30%] -right-40 h-[400px] w-[400px] rounded-full bg-[#a87f3e]/[0.07] blur-[100px]" />
        <div className="absolute bottom-0 -left-20 h-[300px] w-[300px] rounded-full bg-[#ab3326]/[0.04] blur-[80px]" />
      </div>

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[#e7c894]/60">
        <Link
          href="/auth/signin"
          className="flex items-center gap-2 text-[#8a6b3e] hover:text-[#ab3326] transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{lang === 'zh' ? '登入' : lang === 'fr' ? 'Connexion' : 'Sign in'}</span>
        </Link>

        <div className="flex items-center gap-1 rounded-full border border-[#e7c894] px-1 py-1 bg-[#f3dcb2]/60">
          {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
                lang === l
                  ? 'bg-[#ab3326] text-[#f3ecdd] shadow-sm'
                  : 'text-[#8a6b3e] hover:text-[#2a1f12]'
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* ── Hero: Banner + Philosophy two-column ── */}
        <section className="space-y-10">
          {/* Banner */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/Banner.png"
            alt="Kairos 墨時"
            className="w-full rounded-2xl shadow-[0_6px_32px_rgba(42,31,18,0.10)]"
          />

          <p className="text-center text-[#6b5840] text-base leading-relaxed max-w-xl mx-auto">
            {h.sub}
          </p>

          {/* Philosophy — text left, 借光 image right */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 relative">
              <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#ab3326]/50 via-[#a87f3e]/30 to-transparent rounded-full" />
              <div className="text-[#5c4a32] text-sm leading-[2.1] pl-4 space-y-4">
                {h.philosophy.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
            {/* 借光 illustration */}
            <div className="md:w-[220px] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo_v5/About us Page.png"
                alt="鑿壁偷光"
                className="w-full rounded-xl shadow-[0_4px_20px_rgba(42,31,18,0.10)]"
              />
            </div>
          </div>
        </section>

        {/* ── Separator ── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c9aa72]/50 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_v5/Waterprint_Social Media.png" alt="" className="h-8 w-auto opacity-45" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c9aa72]/50 to-transparent" />
        </div>

        {/* ── Feature cards ── */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="font-brush text-2xl text-[#2a1f12] tracking-wider">{h.featureTitle}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_v5/Icon of features.png" alt="" className="h-12 w-auto opacity-80" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {feats.map((f, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-[#e7c894] bg-[#f3dcb2]/60 p-5 hover:border-[#ab3326]/40 hover:bg-[#f3dcb2]/80 transition-all shadow-[0_2px_12px_rgba(42,31,18,0.05)]"
              >
                <div className="absolute top-4 right-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo_v5/Waterprint_Social Media.png" alt="" className="h-5 w-auto opacity-10 group-hover:opacity-20 transition-opacity" />
                </div>
                <h3 className="font-semibold text-[#2a1f12] text-sm mb-2">{f.title}</h3>
                <p className="text-[#6b5840] text-xs leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Separator ── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c9aa72]/50 to-transparent" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_v5/Waterprint_Social Media.png" alt="" className="h-8 w-auto opacity-45" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c9aa72]/50 to-transparent" />
        </div>

        {/* ── Pills: AI + Trilingual + Visitor ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: h.aiLabel, body: h.aiBody },
            { label: h.triLabel, body: h.triBody },
            { label: h.visitorLabel, body: h.visitorBody },
          ].map((pill, i) => (
            <div key={i} className="rounded-2xl border border-[#e7c894] bg-[#f3dcb2]/60 p-5 text-center space-y-2 shadow-[0_2px_8px_rgba(42,31,18,0.05)]">
              <p className="text-[#ab3326] text-sm font-semibold">{pill.label}</p>
              <p className="text-[#6b5840] text-xs leading-relaxed">{pill.body}</p>
            </div>
          ))}
        </section>

        {/* ── CTA ── */}
        <div className="text-center">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#ab3326] to-[#861f17] text-[#f3ecdd] text-sm font-semibold tracking-wide shadow-lg shadow-[#ab3326]/20 hover:shadow-[#ab3326]/35 hover:scale-[1.02] transition-all"
          >
            {h.cta}
          </Link>
        </div>

        {/* ── Footer stamp ── */}
        <footer className="flex flex-col items-center gap-3 pb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_v5/Waterprint_Social Media.png" alt="墨時" className="h-16 w-auto opacity-70" />
          <p className="text-[#a87f3e] text-xs tracking-widest uppercase">Kairos · Time, Inked.</p>
        </footer>

      </main>
    </div>
  )
}
