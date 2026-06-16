import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isPast, addMinutes } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
export { EISENHOWER_QUADRANTS } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLocale(lang: string) {
  return lang === 'fr' ? fr : lang === 'zh' ? zhTW : enUS
}

export function formatDate(date: Date | string, lang = 'fr') {
  const d = new Date(date)
  const locale = getLocale(lang)
  if (isToday(d)) return lang === 'fr' ? "Aujourd'hui" : lang === 'zh' ? '今天' : 'Today'
  if (isTomorrow(d)) return lang === 'fr' ? 'Demain' : lang === 'zh' ? '明天' : 'Tomorrow'
  return format(d, 'PPP', { locale })
}

export function formatTime(date: Date | string, lang = 'fr') {
  const d = new Date(date)
  return format(d, 'HH:mm', { locale: getLocale(lang) })
}

export function formatDuration(minutes: number, lang = 'fr') {
  if (minutes < 60) {
    return lang === 'fr' ? `${minutes} min` : lang === 'zh' ? `${minutes} 分鐘` : `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return lang === 'fr' ? `${hours}h` : lang === 'zh' ? `${hours} 小時` : `${hours}h`
  }
  return lang === 'fr' ? `${hours}h${mins}` : lang === 'zh' ? `${hours} 小時 ${mins} 分鐘` : `${hours}h ${mins}m`
}

export function calculatePriority(importance: number, urgency: number): number {
  return importance * 10 + urgency
}

export function getQuadrant(importance: number, urgency: number) {
  const highImportance = importance >= 6
  const highUrgency = urgency >= 6
  if (highImportance && highUrgency) return 'do-first'
  if (highImportance && !highUrgency) return 'schedule'
  if (!highImportance && highUrgency) return 'delegate'
  return 'eliminate'
}

export function isOverdue(scheduledEnd?: Date | string | null): boolean {
  if (!scheduledEnd) return false
  return isPast(new Date(scheduledEnd))
}

export function suggestTimeSlots(
  durationMinutes: number,
  existingEvents: { start: Date; end: Date }[],
  workHoursStart = 9,
  workHoursEnd = 18
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = []
  const today = new Date()
  today.setHours(workHoursStart, 0, 0, 0)

  let current = new Date(today)
  const endOfDay = new Date(today)
  endOfDay.setHours(workHoursEnd, 0, 0, 0)

  while (current < endOfDay && slots.length < 3) {
    const slotEnd = addMinutes(current, durationMinutes)
    if (slotEnd > endOfDay) break

    const conflicts = existingEvents.some(
      (ev) => current < ev.end && slotEnd > ev.start
    )

    if (!conflicts) {
      slots.push({ start: new Date(current), end: new Date(slotEnd) })
      current = addMinutes(current, durationMinutes + 15)
    } else {
      current = addMinutes(current, 15)
    }
  }

  return slots
}

export function generatePriorityList<T extends { id: string; importance: number; urgency: number; deadline?: Date | string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const scoreA = a.importance * 10 + a.urgency + (a.deadline && isPast(new Date(a.deadline as string)) ? 20 : 0)
    const scoreB = b.importance * 10 + b.urgency + (b.deadline && isPast(new Date(b.deadline as string)) ? 20 : 0)
    return scoreB - scoreA
  })
}
