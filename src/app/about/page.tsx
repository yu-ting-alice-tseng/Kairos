'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InkMountains } from '@/components/ui/InkMountains'

type Lang = 'zh' | 'en' | 'fr'

const LANG_LABELS: Record<Lang, string> = { zh: '中文', en: 'EN', fr: 'FR' }

const features = {
  zh: [
    {
      icon: '📋',
      title: '任務矩陣（Matrix）',
      body: '運用艾森豪矩陣，以毛筆觸感流暢拖曳，在「重要」與「緊急」之間精準定奪落筆的先後順序。',
    },
    {
      icon: '📅',
      title: '縱橫日曆（Calendar）',
      body: '完美同步 Google Calendar、Outlook 與 Notion，週視圖時間軸將事件與習慣等比例並排呈現，讓繁雜的行程如行雲流水般清晰。',
    },
    {
      icon: '🔁',
      title: '習慣年輪（Habits）',
      body: '自由設定每日或工作日頻率，在日曆與矩陣中同步勾勒完成狀態，以連續天數統計（Streak）凝聚你的持之以恆。',
    },
    {
      icon: '🔗',
      title: '逆向流光（Retroplanning）',
      body: '智能偵測關鍵字，一鍵自動套用專案與考試範本，逆向生成前置任務鏈條，未來進度一目了然。',
    },
  ],
  en: [
    {
      icon: '📋',
      title: 'The Task Matrix',
      body: 'Visualize your priorities using the Eisenhower Matrix. Seamlessly drag and drop tasks to balance the urgent and the important with the fluid grace of a brushstroke.',
    },
    {
      icon: '📅',
      title: 'Unified Calendar',
      body: 'Sync Google Calendar, Outlook, and Notion. The weekly timeline displays events, tasks, and habits proportionally, automatically aligning overlapping schedules.',
    },
    {
      icon: '🔁',
      title: 'Habit Tracker',
      body: 'Define flexible routines (daily, weekdays, weekends). Your streak statistics and completion states sync flawlessly across the calendar and matrix.',
    },
    {
      icon: '🔗',
      title: 'Retroplanning Chains',
      body: 'Detect keywords automatically to generate a backward-planned timeline from custom or built-in templates (exams, projects), tracking progress through an intuitive chain view.',
    },
  ],
  fr: [
    {
      icon: '📋',
      title: 'Matrice des Tâches',
      body: "Priorisez vos objectifs grâce à la matrice d’Eisenhower. Glissez-déposez vos tâches avec la fluidité d’un pinceau pour distinguer l’important de l’urgent.",
    },
    {
      icon: '📅',
      title: 'Calendrier Intégré',
      body: 'Synchronisez Google Calendar, Outlook et Notion. Le calendrier hebdomadaire affiche proportionnellement vos événements, tâches et habitudes, avec un alignement automatique.',
    },
    {
      icon: '🔁',
      title: 'Suivi des Habitudes',
      body: 'Configurez vos routines (quotidiennes, jours ouvrés, week-ends). Vos statistiques de régularité et statuts se synchronisent instantanément sur la matrice et le calendrier.',
    },
    {
      icon: '🔗',
      title: 'Rétroplanning Automatique',
      body: "Détectez les mots-clés pour générer instantanément une chaîne de sous-tâches à partir de modèles personnalisés ou intégrés (examens, projets), offrant une vue d'ensemble sur votre progression.",
    },
  ],
}

const hero = {
  zh: {
    headline: 'Kairos 墨時',
    sub: '潑墨成時，掌握生命中的關鍵時刻',
    philosophy: `在古希臘語中，時間有兩種面貌：不斷流逝的秒針（Chronos），與代表「關鍵與契機」的決定性瞬間（Kairos）。「墨時」，則是將無形的時間落墨於宣紙之上。\n\n我們將傳統東方水墨的硃紅、赭金與墨色融入視覺，以「鑿壁偷光」的專注精神，將現代高效工具轉化為一幅流暢的生活畫卷。`,
    aiLabel: '🤖 AI 智能輔助',
    aiBody: '內建可選的 AI 助手，為你智能拆解複雜專案並提供排程建議。',
    triLabel: '🌐 三語無界',
    triBody: '側邊欄支援法文、英文、繁體中文一鍵切換。',
    visitorLabel: '👁 訪客模式',
    visitorBody: '無需繁瑣註冊，開啟「訪客模式」即可立刻體驗完整功能。',
    cta: '開始使用',
    featureTitle: '四大核心墨章',
  },
  en: {
    headline: 'Kairos / 墨時',
    sub: 'Capture the Meaningful Moments, Shape Your Legacy in Ink',
    philosophy: `Ancient Greeks defined time in two ways: Chronos, the sequential clock, and Kairos, the opportune moment that demands action. "MoShi" (墨時) means "Inking Time."\n\nBlending eastern ink-wash aesthetics with professional productivity, this app transforms time management into an art form. Inspired by the spirit of "boring a hole in the wall to catch the light" (鑿壁偷光), we help you carve out focus from a chaotic world.`,
    aiLabel: '🤖 AI Companion',
    aiBody: 'Leverage AI-powered task deconstruction, morning summaries, and smart rescheduling.',
    triLabel: '🌐 Trilingual Flow',
    triBody: 'Instantly switch between French, English, and Traditional Chinese with one click.',
    visitorLabel: '👁 Visitor Mode',
    visitorBody: 'Explore the complete experience immediately with our Visitor Mode — no registration required.',
    cta: 'Get Started',
    featureTitle: 'Core Capabilities',
  },
  fr: {
    headline: 'Kairos / 墨時',
    sub: "Maîtrisez l'Instant Décisif, Peignez le Temps à l'Encre",
    philosophy: `Dans la Grèce antique, le temps possédait deux visages : Chronos, le temps linéaire, et Kairos, l'instant opportun, le moment décisif. « MoShi » (墨時) signifie « Mettre le temps en encre ».\n\nEn unissant l'esthétique du lavis oriental (nuances d'encre, vermillon et or ocre) aux outils de productivité modernes, Kairos transforme la gestion du temps en un art de vivre fluide, guidé par la philosophie de « percer le mur pour y dérober la lumière » (鑿壁偷光).`,
    aiLabel: '🤖 Assistance IA',
    aiBody: "Bénéficiez d'une IA optionnelle pour décomposer vos projets complexes et optimiser votre emploi du temps.",
    triLabel: '🌐 Interface Trilingue',
    triBody: "Basculez instantanément entre le français, l'anglais et le chinois traditionnel.",
    visitorLabel: '👁 Mode Invité',
    visitorBody: "Découvrez l'intégralité de l'application sans inscription grâce au Mode Invité.",
    cta: 'Commencer',
    featureTitle: 'Fonctionnalités Clés',
  },
}

export default function AboutPage() {
  const [lang, setLang] = useState<Lang>('zh')
  const h = hero[lang]
  const feats = features[lang]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1b1612] text-[#e8d9b8]">

      {/* Ink-wash background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 15% 0%, rgba(171,51,38,0.15), transparent), radial-gradient(ellipse 55% 40% at 88% 10%, rgba(176,137,72,0.12), transparent), radial-gradient(ellipse 40% 40% at 50% 80%, rgba(171,51,38,0.08), transparent), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0">
          <InkMountains className="opacity-40" />
        </div>
        <div className="absolute -top-60 -left-40 h-[540px] w-[540px] rounded-full bg-[#ab3326]/[0.08] blur-[100px]" />
        <div className="absolute top-[40%] -right-48 h-[480px] w-[480px] rounded-full bg-[#b08948]/[0.08] blur-[100px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-[rgba(225,200,150,0.08)]">
        <Link
          href="/today"
          className="flex items-center gap-2 text-[#7a6c54] hover:text-[#d9c79f] transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>App</span>
        </Link>

        {/* Language switcher */}
        <div className="flex items-center gap-1 rounded-full border border-[rgba(225,200,150,0.14)] px-1 py-1 bg-[#241d17]/60 backdrop-blur-sm">
          {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
                lang === l
                  ? 'bg-[#ab3326] text-[#f3ecdd] shadow-sm'
                  : 'text-[#7a6c54] hover:text-[#d9c79f]'
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16 space-y-20">

        {/* Hero */}
        <section className="text-center space-y-6">
          {/* Seal-like divider line */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#b08948]/40" />
            <span className="text-[#b08948]/70 text-xs tracking-[0.3em] uppercase">鑿壁偷光 · 篤志而行</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#b08948]/40" />
          </div>

          <h1 className="font-brush text-5xl md:text-6xl text-[#e2a08f] leading-tight">
            {h.headline}
          </h1>
          <p className="text-[#c9b68a] text-lg md:text-xl leading-relaxed max-w-xl mx-auto">
            {h.sub}
          </p>

          {/* Philosophy text */}
          <div className="relative mt-8">
            <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#ab3326]/60 via-[#b08948]/40 to-transparent rounded-full" />
            <div className="text-[#a99873] text-sm leading-[2] text-left space-y-4 pl-4">
              {h.philosophy.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="pt-4">
            <Link
              href="/today"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#ab3326] to-[#861f17] text-[#f3ecdd] text-sm font-semibold tracking-wide shadow-lg shadow-[#ab3326]/25 hover:shadow-[#ab3326]/40 hover:scale-[1.02] transition-all"
            >
              {h.cta}
            </Link>
          </div>
        </section>

        {/* Brush divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#b08948]/30 to-transparent" />
          <span className="text-[#b08948]/50 text-lg">⊕</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#b08948]/30 to-transparent" />
        </div>

        {/* Feature cards */}
        <section className="space-y-6">
          <h2 className="text-center font-brush text-2xl text-[#c9b68a] tracking-wider">
            {h.featureTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {feats.map((f, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-[rgba(225,200,150,0.10)] bg-[#241d17]/70 backdrop-blur-sm p-5 hover:border-[rgba(171,51,38,0.30)] hover:bg-[#2a1f18]/80 transition-all"
              >
                {/* Subtle inner glow on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[#ab3326]/[0.04] to-transparent pointer-events-none" />
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-[#e8d9b8] text-sm mb-2">{f.title}</h3>
                <p className="text-[#8a7a5e] text-xs leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Brush divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#b08948]/30 to-transparent" />
          <span className="text-[#b08948]/50 text-lg">⊕</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#b08948]/30 to-transparent" />
        </div>

        {/* AI + Trilingual + Visitor pills */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: h.aiLabel, body: h.aiBody },
            { label: h.triLabel, body: h.triBody },
            { label: h.visitorLabel, body: h.visitorBody },
          ].map((pill, i) => (
            <div key={i} className="rounded-2xl border border-[rgba(225,200,150,0.10)] bg-[#241d17]/70 p-5 text-center space-y-2">
              <p className="text-[#e2a08f] text-sm font-semibold">{pill.label}</p>
              <p className="text-[#7a6c54] text-xs leading-relaxed">{pill.body}</p>
            </div>
          ))}
        </section>

        {/* Footer stamp */}
        <footer className="text-center pb-8 space-y-2">
          <p className="font-brush text-3xl text-[#ab3326]/50">墨時</p>
          <p className="text-[#4a3f32] text-xs tracking-widest uppercase">Kairos · Time, Inked.</p>
        </footer>

      </main>
    </div>
  )
}
