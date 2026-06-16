import Anthropic from '@anthropic-ai/sdk'
import { AIBreakdownResult, Task } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function breakdownTask(
  title: string,
  description: string,
  deadline: string,
  estimatedTotalHours: number,
  lang: 'fr' | 'en' | 'zh' = 'fr'
): Promise<AIBreakdownResult> {
  const systemPrompt = lang === 'fr'
    ? `Tu es un assistant de planification expert. Tu dois décomposer les tâches complexes en sous-tâches gérables avec une estimation de temps réaliste et un rétroplanification intelligente. Réponds toujours en JSON valide.`
    : lang === 'zh'
    ? `你是一位專業的規劃助手。你需要將複雜的任務拆解成可管理的子任務，並提供合理的時間估算與聰明的回溯排程建議。請務必以有效的 JSON 格式回覆。`
    : `You are an expert planning assistant. Break down complex tasks into manageable subtasks with realistic time estimates and smart retroplanning. Always respond in valid JSON.`

  const userPrompt = lang === 'fr'
    ? `Décompose cette tâche en sous-tâches:
Titre: ${title}
Description: ${description}
Deadline: ${deadline}
Temps estimé total: ${estimatedTotalHours}h

Retourne un JSON avec ce format:
{
  "subTasks": [
    {
      "title": "string",
      "description": "string",
      "estimatedMinutes": number,
      "scheduledDate": "YYYY-MM-DD (optionnel)",
      "importance": 1-10,
      "urgency": 1-10
    }
  ],
  "totalEstimatedMinutes": number,
  "suggestions": "conseils et remarques"
}`
    : lang === 'zh'
    ? `將這項任務拆解成子任務：
標題：${title}
描述：${description}
截止日期：${deadline}
預估總時長：${estimatedTotalHours} 小時

請以以下格式回傳 JSON：
{
  "subTasks": [
    {
      "title": "string",
      "description": "string",
      "estimatedMinutes": number,
      "scheduledDate": "YYYY-MM-DD（選填）",
      "importance": 1-10,
      "urgency": 1-10
    }
  ],
  "totalEstimatedMinutes": number,
  "suggestions": "建議與備註"
}`
    : `Break down this task into subtasks:
Title: ${title}
Description: ${description}
Deadline: ${deadline}
Total estimated time: ${estimatedTotalHours}h

Return JSON in this format:
{
  "subTasks": [
    {
      "title": "string",
      "description": "string",
      "estimatedMinutes": number,
      "scheduledDate": "YYYY-MM-DD (optional)",
      "importance": 1-10,
      "urgency": 1-10
    }
  ],
  "totalEstimatedMinutes": number,
  "suggestions": "advice and notes"
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid AI response')

  return JSON.parse(jsonMatch[0]) as AIBreakdownResult
}

export async function generateDailyRecap(
  tasks: Task[],
  completedToday: Task[],
  missedToday: Task[],
  lang: 'fr' | 'en' | 'zh' = 'fr'
): Promise<string> {
  const systemPrompt = lang === 'fr'
    ? 'Tu es un assistant de productivité bienveillant. Génère un récapitulatif matinal motivant et concis en français.'
    : lang === 'zh'
    ? '你是一位貼心的生產力助手。請用繁體中文產生一段簡潔且充滿動力的早晨總結。'
    : 'You are a supportive productivity assistant. Generate a motivating and concise morning summary.'

  const userPrompt = lang === 'fr'
    ? `Génère un récapitulatif pour aujourd'hui:
Tâches à faire: ${tasks.map(t => `- ${t.title} (importance: ${t.importance}/10, urgence: ${t.urgency}/10)`).join('\n')}
${completedToday.length > 0 ? `Tâches complétées hier: ${completedToday.map(t => t.title).join(', ')}` : ''}
${missedToday.length > 0 ? `Tâches manquées hier: ${missedToday.map(t => t.title).join(', ')}` : ''}

Inclus: une salutation motivante, les 3 priorités du jour, et un conseil court.`
    : lang === 'zh'
    ? `為今天產生一份總結：
待辦任務：${tasks.map(t => `- ${t.title}（重要性：${t.importance}/10，緊急性：${t.urgency}/10）`).join('\n')}
${completedToday.length > 0 ? `昨天完成的任務：${completedToday.map(t => t.title).join('、')}` : ''}
${missedToday.length > 0 ? `昨天錯過的任務：${missedToday.map(t => t.title).join('、')}` : ''}

請包含：一句激勵人心的問候、今天的三個優先事項，以及一個簡短的建議。`
    : `Generate a summary for today:
Tasks to do: ${tasks.map(t => `- ${t.title} (importance: ${t.importance}/10, urgency: ${t.urgency}/10)`).join('\n')}
${completedToday.length > 0 ? `Tasks completed yesterday: ${completedToday.map(t => t.title).join(', ')}` : ''}
${missedToday.length > 0 ? `Tasks missed yesterday: ${missedToday.map(t => t.title).join(', ')}` : ''}

Include: a motivating greeting, the 3 priorities for today, and a short tip.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

export async function suggestReschedule(
  missedTask: Task,
  availableSlots: { start: string; end: string }[],
  lang: 'fr' | 'en' | 'zh' = 'fr'
): Promise<{ suggestedSlot: { start: string; end: string }; reason: string }> {
  const systemPrompt = lang === 'fr'
    ? 'Tu es un assistant de planification. Suggère le meilleur créneau pour reprogrammer une tâche manquée. Réponds en JSON.'
    : lang === 'zh'
    ? '你是一位排程助手。請為錯過的任務建議最佳的重新安排時段，並以 JSON 格式回覆。'
    : 'You are a scheduling assistant. Suggest the best time slot to reschedule a missed task. Respond in JSON.'

  const userPrompt = lang === 'fr'
    ? `Tâche manquée: ${missedTask.title} (${missedTask.estimatedMinutes || 60} min, importance: ${missedTask.importance}/10)
Créneaux disponibles: ${availableSlots.map(s => `${s.start} - ${s.end}`).join('\n')}

Retourne: { "suggestedSlot": { "start": "ISO", "end": "ISO" }, "reason": "explication" }`
    : lang === 'zh'
    ? `錯過的任務：${missedTask.title}（${missedTask.estimatedMinutes || 60} 分鐘，重要性：${missedTask.importance}/10）
可用時段：${availableSlots.map(s => `${s.start} - ${s.end}`).join('\n')}

請回傳：{ "suggestedSlot": { "start": "ISO", "end": "ISO" }, "reason": "原因說明" }`
    : `Missed task: ${missedTask.title} (${missedTask.estimatedMinutes || 60} min, importance: ${missedTask.importance}/10)
Available slots: ${availableSlots.map(s => `${s.start} - ${s.end}`).join('\n')}

Return: { "suggestedSlot": { "start": "ISO", "end": "ISO" }, "reason": "explanation" }`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid AI response')

  return JSON.parse(jsonMatch[0])
}

export async function askForTaskDetails(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  lang: 'fr' | 'en' | 'zh' = 'fr'
): Promise<string> {
  const systemPrompt = lang === 'fr'
    ? `Tu es FlowPlan, un assistant de planification intelligent. Tu aides les utilisateurs à clarifier leurs tâches pour mieux les planifier. Pose des questions précises pour comprendre: la complexité, les ressources nécessaires, les contraintes, et le contexte. Sois concis et bienveillant.`
    : lang === 'zh'
    ? `你是流光計劃（FlowPlan），一位聰明的規劃助手。你協助使用者釐清任務內容以便更好地安排計畫。請提出精準的問題，了解任務的複雜度、所需資源、限制條件與背景脈絡。保持簡潔且友善。`
    : `You are FlowPlan, an intelligent planning assistant. You help users clarify their tasks for better planning. Ask precise questions to understand: complexity, required resources, constraints, and context. Be concise and supportive.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
