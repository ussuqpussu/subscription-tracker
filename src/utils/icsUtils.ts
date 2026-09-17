import { MAX_YEAR } from '../constants'
import type { Schedule, Subscription } from '../types'
import {
  addDays,
  compareDates,
  daysInMonth,
  getMonthsPerPeriod,
  getPaymentDate,
  getPaymentIndexOnOrAfter,
  makeDate,
  normalizeCustomDays,
  parseISODate,
} from './dateUtils'
import { formatMoney, formatPeriod } from './format'
import { isActive } from './subscriptionUtils'

const CRLF = '\r\n'
const MAX_LINE_OCTETS = 75
const PRODID = '-//Subscription Tracker//Podpiski 1.0//RU'
const UID_DOMAIN = 'subscription-tracker'

const encoder = new TextEncoder()

/** Экранирование TEXT-значений по RFC 5545 (3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Перенос длинной строки: не больше 75 октетов в строке, продолжение начинается с пробела.
 * Считаются байты UTF-8, символ никогда не разрезается.
 */
export function foldLine(line: string): string {
  let result = ''
  let current = ''
  let currentOctets = 0
  let limit = MAX_LINE_OCTETS
  for (const char of line) {
    const octets = encoder.encode(char).length
    if (currentOctets + octets > limit) {
      result += `${current}${CRLF} `
      current = ''
      currentOctets = 0
      limit = MAX_LINE_OCTETS - 1 // пробел в начале строки тоже октет
    }
    current += char
    currentOctets += octets
  }
  return result + current
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function formatICSDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

export function formatICSDateTimeUTC(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

const FEBRUARY = 1
const LAST_DAY_OF_FEBRUARY_RULE = 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1'

/** Серия повторений одного VEVENT. У подписки на 29-е или 30-е их может быть две. */
export interface RecurrenceSeries {
  uidSuffix: string
  start: Date
  rrule: string
  exdates: Date[]
}

function isLeapYear(year: number): boolean {
  return daysInMonth(year, FEBRUARY) === 29
}

/**
 * Правила повторения по периодичности (weekly → FREQ=WEEKLY, quarterly → FREQ=MONTHLY;INTERVAL=3 и т. д.).
 *
 * Приложение переносит платёж с 29–31 числа на последний день короткого месяца, а по RFC 5545
 * такие месяцы просто пропускаются. Поэтому используются только широко поддерживаемые правила:
 * - 31-е → BYMONTHDAY=-1 (последний день месяца);
 * - 29-е и 30-е → основная серия BYMONTHDAY=D и отдельная ежегодная серия «последний день февраля»;
 *   для 29-го високосные 29 февраля исключаются из основной серии через EXDATE, чтобы не было дублей;
 * - 29 февраля раз в год → BYMONTH=2;BYMONTHDAY=-1.
 * BYSETPOS не используется: часть календарей разворачивает его с ошибками.
 */
export function buildRecurrence(schedule: Schedule, today: Date): RecurrenceSeries[] {
  const first = parseISODate(schedule.startDate)
  const day = first.getDate()
  const nextIndex = getPaymentIndexOnOrAfter(schedule, today)
  const single = (rrule: string): RecurrenceSeries[] => [
    { uidSuffix: '', start: getPaymentDate(schedule, nextIndex), rrule, exdates: [] },
  ]

  if (schedule.billingPeriod === 'weekly') return single('FREQ=WEEKLY')
  if (schedule.billingPeriod === 'custom') {
    return single(`FREQ=DAILY;INTERVAL=${normalizeCustomDays(schedule.customDays)}`)
  }
  if (schedule.billingPeriod === 'yearly') {
    return single(first.getMonth() === FEBRUARY && day === 29 ? LAST_DAY_OF_FEBRUARY_RULE : 'FREQ=YEARLY')
  }

  const interval = getMonthsPerPeriod(schedule.billingPeriod) ?? 1
  const base = interval === 1 ? 'FREQ=MONTHLY' : `FREQ=MONTHLY;INTERVAL=${interval}`
  if (day <= 28) return single(base)
  if (day === 31) return single(`${base};BYMONTHDAY=-1`)

  let mainIndex = nextIndex
  while (getPaymentDate(schedule, mainIndex).getMonth() === FEBRUARY) mainIndex += 1
  const main: RecurrenceSeries = {
    uidSuffix: '',
    start: getPaymentDate(schedule, mainIndex),
    rrule: `${base};BYMONTHDAY=${day}`,
    exdates: [],
  }

  const februaryInCycle = (((FEBRUARY - first.getMonth()) % interval) + interval) % interval === 0
  if (!februaryInCycle) return [main]

  let februaryIndex = nextIndex
  while (getPaymentDate(schedule, februaryIndex).getMonth() !== FEBRUARY) februaryIndex += 1
  const february: RecurrenceSeries = {
    uidSuffix: '-feb',
    start: getPaymentDate(schedule, februaryIndex),
    rrule: LAST_DAY_OF_FEBRUARY_RULE,
    exdates: [],
  }

  if (day === 29) {
    for (let year = main.start.getFullYear(); year <= MAX_YEAR; year += 1) {
      const leapDay = makeDate(year, FEBRUARY, 29)
      if (isLeapYear(year) && compareDates(leapDay, main.start) > 0) main.exdates.push(leapDay)
    }
  }
  return [main, february]
}

function buildDescription(subscription: Subscription): string {
  const lines = [
    `${formatMoney(subscription.price, subscription.currency)}, ${formatPeriod(subscription).toLowerCase()}`,
  ]
  if (subscription.category) lines.push(`Категория: ${subscription.category}`)
  if (subscription.notes) lines.push(subscription.notes)
  return lines.join('\n')
}

export interface IcsOptions {
  /** Момент создания файла (DTSTAMP). */
  now?: Date
  /** «Сегодня» для расчёта даты начала серии. */
  today?: Date
}

/**
 * Строки VEVENT подписки (без переноса и CRLF).
 * DTSTART — дата следующего платежа, событие на весь день.
 */
export function buildEventLines(subscription: Subscription, options: IcsOptions = {}): string[] {
  const now = options.now ?? new Date()
  const price = formatMoney(subscription.price, subscription.currency)
  const summary = escapeText(`${subscription.name} — ${price}`)
  const description = escapeText(buildDescription(subscription))
  const alarmText = escapeText(`Скоро платёж: ${subscription.name} — ${price}`)

  return buildRecurrence(subscription, options.today ?? now).flatMap((series) => {
    const lines = [
      'BEGIN:VEVENT',
      `UID:${subscription.id}${series.uidSuffix}@${UID_DOMAIN}`,
      `DTSTAMP:${formatICSDateTimeUTC(now)}`,
      `DTSTART;VALUE=DATE:${formatICSDate(series.start)}`,
      `DTEND;VALUE=DATE:${formatICSDate(addDays(series.start, 1))}`,
      `RRULE:${series.rrule}`,
    ]
    if (series.exdates.length > 0) {
      lines.push(`EXDATE;VALUE=DATE:${series.exdates.map(formatICSDate).join(',')}`)
    }
    lines.push(`SUMMARY:${summary}`, `DESCRIPTION:${description}`, 'TRANSP:TRANSPARENT')
    if (subscription.category) lines.push(`CATEGORIES:${escapeText(subscription.category)}`)

    for (const days of subscription.reminders) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${alarmText}`, `TRIGGER:-P${days}D`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
    return lines
  })
}

function buildCalendar(eventLines: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('Подписки')}`,
    ...eventLines,
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}

/** Файл .ics для одной подписки. */
export function createSubscriptionIcs(subscription: Subscription, options: IcsOptions = {}): string {
  return buildCalendar(buildEventLines(subscription, options))
}

/** Один .ics со всеми активными подписками. */
export function createAllSubscriptionsIcs(
  subscriptions: readonly Subscription[],
  options: IcsOptions = {},
): string {
  return buildCalendar(subscriptions.filter(isActive).flatMap((item) => buildEventLines(item, options)))
}

/** Имя файла без запрещённых символов. */
export function icsFileName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>| -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
  return `${safe || 'Подписка'}.ics`
}
