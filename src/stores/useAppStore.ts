'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Task, Habit, CalendarAccount, Language } from '@/types'

export interface KeywordRule {
  id: string
  keyword: string
  importance: number
  urgence: number
}

export interface AppState {
  language: Language
  tasks: Task[]
  habits: Habit[]
  calendarAccounts: CalendarAccount[]
  selectedDate: string
  isLoading: boolean
  activeView: 'today' | 'matrix' | 'calendar' | 'habits' | 'settings'
  matrixExcludePatterns: string[]
  todayExcludePatterns: string[]
  keywordRules: KeywordRule[]
  hideHabitsViews: string[]

  setLanguage: (lang: Language) => void
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  setHabits: (habits: Habit[]) => void
  addHabit: (habit: Habit) => void
  updateHabit: (id: string, updates: Partial<Habit>) => void
  removeHabit: (id: string) => void
  setCalendarAccounts: (accounts: CalendarAccount[]) => void
  setSelectedDate: (date: string) => void
  setIsLoading: (loading: boolean) => void
  setActiveView: (view: AppState['activeView']) => void
  setMatrixExcludePatterns: (patterns: string[]) => void
  setTodayExcludePatterns: (patterns: string[]) => void
  setKeywordRules: (rules: KeywordRule[]) => void
  addKeywordRule: (rule: KeywordRule) => void
  updateKeywordRule: (id: string, updates: Partial<KeywordRule>) => void
  removeKeywordRule: (id: string) => void
  toggleHabitsView: (view: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'fr',
      tasks: [],
      habits: [],
      calendarAccounts: [],
      selectedDate: new Date().toISOString().split('T')[0],
      isLoading: false,
      activeView: 'today',
      matrixExcludePatterns: [],
      todayExcludePatterns: [],
      keywordRules: [],
      hideHabitsViews: [],

      setLanguage: (lang) => set({ language: lang }),
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      setHabits: (habits) => set({ habits }),
      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit] })),
      updateHabit: (id, updates) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        })),
      removeHabit: (id) =>
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id) })),
      setCalendarAccounts: (accounts) => set({ calendarAccounts: accounts }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setActiveView: (view) => set({ activeView: view }),
      setMatrixExcludePatterns: (patterns) => set({ matrixExcludePatterns: patterns }),
      setTodayExcludePatterns: (patterns) => set({ todayExcludePatterns: patterns }),
      setKeywordRules: (rules) => set({ keywordRules: rules }),
      addKeywordRule: (rule) => set((state) => ({ keywordRules: [...state.keywordRules, rule] })),
      updateKeywordRule: (id, updates) =>
        set((state) => ({
          keywordRules: state.keywordRules.map((r) => r.id === id ? { ...r, ...updates } : r),
        })),
      removeKeywordRule: (id) =>
        set((state) => ({ keywordRules: state.keywordRules.filter((r) => r.id !== id) })),
      toggleHabitsView: (view) =>
        set((state) => ({
          hideHabitsViews: state.hideHabitsViews.includes(view)
            ? state.hideHabitsViews.filter((v) => v !== view)
            : [...state.hideHabitsViews, view],
        })),
    }),
    {
      name: 'flowplan-store',
      partialize: (state) => ({
        language: state.language,
        activeView: state.activeView,
        matrixExcludePatterns: state.matrixExcludePatterns,
        todayExcludePatterns: state.todayExcludePatterns,
        hideHabitsViews: state.hideHabitsViews,
        // keywordRules loaded from DB on login — not persisted in localStorage
      }),
    }
  )
)
