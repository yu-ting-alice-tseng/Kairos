export type CalendarProvider = 'GOOGLE' | 'OUTLOOK' | 'APPLE' | 'NOTION' | 'LOCAL'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'RESCHEDULED' | 'CANCELLED'
export type HabitFrequency = 'DAILY' | 'WEEKLY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM'
export type Language = 'fr' | 'en'

export interface Task {
  id: string
  userId: string
  calendarAccountId?: string | null
  title: string
  description?: string | null
  importance: number
  urgency: number
  priority: number
  status: TaskStatus
  estimatedMinutes?: number | null
  actualMinutes?: number | null
  scheduledStart?: Date | string | null
  scheduledEnd?: Date | string | null
  deadline?: Date | string | null
  completedAt?: Date | string | null
  isRecurring: boolean
  parentTaskId?: string | null
  calendarEventId?: string | null
  tags?: string | null
  notes?: string | null
  aiSuggested: boolean
  createdAt: Date | string
  updatedAt: Date | string
  subTasks?: Task[]
  calendarAccount?: CalendarAccount | null
}

export interface Habit {
  id: string
  userId: string
  title: string
  description?: string | null
  color: string
  icon?: string | null
  frequency: HabitFrequency
  targetDays?: string | null
  scheduledTime?: string | null
  durationMinutes?: number | null
  calendarEventId?: string | null
  isActive: boolean
  streak: number
  longestStreak: number
  createdAt: Date | string
  updatedAt: Date | string
  completions?: HabitCompletion[]
}

export interface HabitCompletion {
  id: string
  habitId: string
  completedAt: Date | string
  notes?: string | null
}

export interface CalendarAccount {
  id: string
  userId: string
  provider: CalendarProvider
  name: string
  color: string
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: Date | string | null
  calendarId?: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  subCalendars?: SubCalendar[]
}

export interface SubCalendar {
  id: string
  calendarAccountId: string
  externalId: string
  name: string
  color: string
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export interface DailyRecap {
  id: string
  userId: string
  date: Date | string
  summary: string
  tasksTotal: number
  tasksDone: number
  tasksMissed: number
  createdAt: Date | string
}

export interface EisenhowerQuadrant {
  id: 'do-first' | 'schedule' | 'delegate' | 'eliminate'
  label: string
  labelFr: string
  importance: 'high' | 'low'
  urgency: 'high' | 'low'
  color: string
  bgColor: string
}

export const EISENHOWER_QUADRANTS: EisenhowerQuadrant[] = [
  {
    id: 'do-first',
    label: 'Do First',
    labelFr: 'À faire maintenant',
    importance: 'high',
    urgency: 'high',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    labelFr: 'Planifier',
    importance: 'high',
    urgency: 'low',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'delegate',
    label: 'Delegate',
    labelFr: 'Déléguer',
    importance: 'low',
    urgency: 'high',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  {
    id: 'eliminate',
    label: 'Eliminate',
    labelFr: 'Éliminer',
    importance: 'low',
    urgency: 'low',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
  },
]

export interface Goal {
  id: string
  userId: string
  text: string
  type: 'LONG_TERM' | 'SHORT_TERM'
  order: number
  createdAt: Date | string
  updatedAt: Date | string
}

export interface RetroStage {
  name: string
  daysBeforeDeadline: number
}

export interface RetroTemplate {
  id: string
  userId: string
  name: string
  calendarAccountId?: string | null
  keywords: string[]
  stages: RetroStage[]
  createdAt: Date | string
  updatedAt: Date | string
}

export interface AIBreakdownResult {
  subTasks: {
    title: string
    description: string
    estimatedMinutes: number
    scheduledDate?: string
    importance: number
    urgency: number
  }[]
  totalEstimatedMinutes: number
  suggestions: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date | string
  end: Date | string
  calendarAccountId?: string
  calendarId?: string   // sub-calendar ID (e.g. Google calendar ID, Notion DB ID)
  color?: string
  taskId?: string
  habitId?: string
  allDay?: boolean
  description?: string
  editable?: boolean    // false for read-only calendars
}

export interface TimeSlotSuggestion {
  start: Date
  end: Date
  score: number
  reason: string
  reasonFr: string
}
