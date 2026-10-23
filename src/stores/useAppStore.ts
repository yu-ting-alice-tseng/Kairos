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
  /** Title keywords that turn a task or all-day event into a reminder on Today (birthdays…) */
  todayReminderPatterns: string[]
  keywordRules: KeywordRule[]
  hideHabitsViews: string[]
  primaryTimezone: string | null   // null = browser local
  secondaryTimezone: string | null // null = not shown
  hasCompletedOnboarding: boolean
  onboardingOpen: boolean
  /**
   * True once a page has handed the store its server-rendered tasks/habits.
   * Until then a page renders from its own props, so the first paint matches
   * the HTML the server sent instead of an empty store.
   */
  dataSeeded: boolean
  /** True once tasks / habits have been read from the server this session, so a
   *  page can show them right away and refresh in the background instead of
   *  putting up a loader on every visit. */
  tasksLoaded: boolean
  habitsLoaded: boolean
  /** When the last local task/habit edit happened (ms). A server snapshot
   *  taken before it must not overwrite it. */
  lastMutationAt: number
  /** When Today started showing cached data while the server read a fresh copy. */
  navigationStartedAt: number
  markNavigationStart: () => void

  seedServerData: (tasks: Task[], habits: Habit[]) => void
  setLanguage: (lang: Language) => void
  setOnboardingOpen: (open: boolean) => void
  completeOnboarding: () => void
  setPrimaryTimezone: (tz: string | null) => void
  setSecondaryTimezone: (tz: string | null) => void
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  /** Swap a placeholder shown while saving for the row the server returned. */
  replaceTask: (id: string, task: Task) => void
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
  setTodayReminderPatterns: (patterns: string[]) => void
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
      todayReminderPatterns: ['生日', 'Birthday', 'Anniversaire'],
      keywordRules: [],
      hideHabitsViews: [],
      primaryTimezone: null,
      secondaryTimezone: null,
      hasCompletedOnboarding: false,
      onboardingOpen: false,
      dataSeeded: false,
      tasksLoaded: false,
      habitsLoaded: false,
      lastMutationAt: 0,
      navigationStartedAt: 0,
      markNavigationStart: () => set({ navigationStartedAt: Date.now() }),

      // A copy read before an edit made while it was on its way would undo that
      // edit on screen, so it is dropped; the next refresh brings it in.
      seedServerData: (tasks, habits) => set((state) =>
        state.lastMutationAt > state.navigationStartedAt && state.navigationStartedAt > 0
          ? { dataSeeded: true }
          : { tasks, habits, dataSeeded: true, tasksLoaded: true, habitsLoaded: true }),
      setLanguage: (lang) => set({ language: lang }),
      setOnboardingOpen: (open) => set({ onboardingOpen: open }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true, onboardingOpen: false }),
      setPrimaryTimezone: (tz) => set({ primaryTimezone: tz }),
      setSecondaryTimezone: (tz) => set({ secondaryTimezone: tz }),
      setTasks: (tasks) => set({ tasks, tasksLoaded: true }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task], lastMutationAt: Date.now() })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          lastMutationAt: Date.now(),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id), lastMutationAt: Date.now() })),
      replaceTask: (id, task) =>
        set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)), lastMutationAt: Date.now() })),
      setHabits: (habits) => set({ habits, habitsLoaded: true }),
      addHabit: (habit) => set((state) => ({ habits: [...state.habits, habit], lastMutationAt: Date.now() })),
      updateHabit: (id, updates) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
          lastMutationAt: Date.now(),
        })),
      removeHabit: (id) =>
        set((state) => ({ habits: state.habits.filter((h) => h.id !== id), lastMutationAt: Date.now() })),
      setCalendarAccounts: (accounts) => set({ calendarAccounts: accounts }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setActiveView: (view) => set({ activeView: view }),
      setMatrixExcludePatterns: (patterns) => set({ matrixExcludePatterns: patterns }),
      setTodayExcludePatterns: (patterns) => set({ todayExcludePatterns: patterns }),
      setTodayReminderPatterns: (patterns) => set({ todayReminderPatterns: patterns }),
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
        todayReminderPatterns: state.todayReminderPatterns,
        hideHabitsViews: state.hideHabitsViews,
        primaryTimezone: state.primaryTimezone,
        secondaryTimezone: state.secondaryTimezone,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        // keywordRules loaded from DB on login — not persisted in localStorage
      }),
    }
  )
)
