import { addDays } from 'date-fns'

export const DEMO_USER_ID = 'demo-user-flowplan'

export function isDemoUser(userId: string) {
  return userId === DEMO_USER_ID
}

export function getDemoTasks() {
  const now = new Date()
  return [
    { id: 'demo-t1', userId: DEMO_USER_ID, title: 'Corriger bug #247 en production', description: 'Erreur 500 sur la page paiement', importance: 10, urgency: 10, priority: 110, estimatedMinutes: 90, status: 'IN_PROGRESS', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t2', userId: DEMO_USER_ID, title: 'Préparer la présentation trimestrielle', description: 'Slides + chiffres Q4', importance: 9, urgency: 8, priority: 98, estimatedMinutes: 120, status: 'PENDING', aiSuggested: false, deadline: addDays(now, 3), scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t3', userId: DEMO_USER_ID, title: 'Réviser le budget marketing', description: null, importance: 8, urgency: 5, priority: 85, estimatedMinutes: 60, status: 'PENDING', aiSuggested: false, deadline: addDays(now, 7), scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t4', userId: DEMO_USER_ID, title: 'Répondre aux emails clients', description: 'Priorité haute : 3 emails en attente', importance: 6, urgency: 9, priority: 69, estimatedMinutes: 30, status: 'PENDING', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t5', userId: DEMO_USER_ID, title: 'Planifier la réunion d\'équipe', description: 'Calendrier de mars', importance: 7, urgency: 6, priority: 76, estimatedMinutes: 15, status: 'PENDING', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t6', userId: DEMO_USER_ID, title: 'Lire le rapport annuel', description: "Rapport 2024 de l'équipe produit", importance: 7, urgency: 3, priority: 73, estimatedMinutes: 60, status: 'PENDING', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t7', userId: DEMO_USER_ID, title: 'Mettre à jour la documentation', description: 'API v2 endpoints', importance: 5, urgency: 2, priority: 52, estimatedMinutes: 45, status: 'PENDING', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
    { id: 'demo-t8', userId: DEMO_USER_ID, title: 'Nettoyer la boîte mail', description: 'Archiver et désabonner', importance: 2, urgency: 2, priority: 22, estimatedMinutes: 20, status: 'PENDING', aiSuggested: false, deadline: null, scheduledStart: null, scheduledEnd: null, completedAt: null, actualMinutes: null, isRecurring: false, parentTaskId: null, calendarEventId: null, calendarAccountId: null, tags: null, notes: null, createdAt: now, updatedAt: now, subTasks: [], calendarAccount: null },
  ]
}

export function getDemoHabits() {
  const now = new Date()
  return [
    { id: 'demo-h1', userId: DEMO_USER_ID, title: 'Méditation', icon: '🧘', color: '#8B5CF6', frequency: 'DAILY', scheduledTime: '07:00', durationMinutes: 10, importance: 8, urgency: 7, streak: 5, longestStreak: 12, isActive: true, description: null, targetDays: null, createdAt: now, updatedAt: now, completions: [] },
    { id: 'demo-h2', userId: DEMO_USER_ID, title: 'Sport', icon: '💪', color: '#EF4444', frequency: 'WEEKDAYS', scheduledTime: '07:30', durationMinutes: 30, importance: 9, urgency: 6, streak: 3, longestStreak: 21, isActive: true, description: null, targetDays: null, createdAt: now, updatedAt: now, completions: [] },
    { id: 'demo-h3', userId: DEMO_USER_ID, title: 'Lecture', icon: '📚', color: '#F59E0B', frequency: 'DAILY', scheduledTime: '21:00', durationMinutes: 20, importance: 7, urgency: 4, streak: 8, longestStreak: 30, isActive: true, description: null, targetDays: null, createdAt: now, updatedAt: now, completions: [] },
    { id: 'demo-h4', userId: DEMO_USER_ID, title: 'Eau (2L)', icon: '💧', color: '#06B6D4', frequency: 'DAILY', scheduledTime: null, durationMinutes: 1, importance: 8, urgency: 8, streak: 2, longestStreak: 7, isActive: true, description: null, targetDays: null, createdAt: now, updatedAt: now, completions: [] },
  ]
}
