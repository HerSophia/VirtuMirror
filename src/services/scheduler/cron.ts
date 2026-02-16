import type { CronSchedule } from './types'

const CRON_PART_COUNT = 5
const MINUTES_PER_YEAR = 366 * 24 * 60
const MAX_LOOKAHEAD_MINUTES = MINUTES_PER_YEAR * 5

interface ParsedCronExpression {
  minute: Set<number>
  hour: Set<number>
  dayOfMonth: Set<number>
  month: Set<number>
  dayOfWeek: Set<number>
}

const expressionCache = new Map<string, ParsedCronExpression>()

function createRange(min: number, max: number): number[] {
  const values: number[] = []
  for (let value = min; value <= max; value += 1) {
    values.push(value)
  }
  return values
}

function parseNumber(value: string, fieldName: string): number {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid ${fieldName} value: ${value}`)
  }
  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${fieldName} value: ${normalized}`)
  }
  return parsed
}

function parseFieldSegment(
  segment: string,
  min: number,
  max: number,
  fieldName: string,
  normalize: (value: number) => number
): number[] {
  const [rangePart, stepPart] = segment.split('/')

  let step = 1
  if (stepPart !== undefined) {
    step = parseNumber(stepPart, fieldName)
    if (step <= 0) {
      throw new Error(`Invalid ${fieldName} step: ${segment}`)
    }
  }

  let rangeStart = min
  let rangeEnd = max

  if (rangePart !== '*') {
    if (rangePart.includes('-')) {
      const [startRaw, endRaw] = rangePart.split('-')
      rangeStart = parseNumber(startRaw, fieldName)
      rangeEnd = parseNumber(endRaw, fieldName)
      if (rangeStart > rangeEnd) {
        throw new Error(`Invalid ${fieldName} range: ${segment}`)
      }
    } else {
      rangeStart = parseNumber(rangePart, fieldName)
      rangeEnd = rangeStart
    }
  }

  if (rangeStart < min || rangeEnd > max) {
    throw new Error(`Out of range ${fieldName}: ${segment}`)
  }

  const values: number[] = []
  for (let value = rangeStart; value <= rangeEnd; value += step) {
    values.push(normalize(value))
  }

  return values
}

function parseField(
  rawField: string,
  min: number,
  max: number,
  fieldName: string,
  normalize: (value: number) => number = (value) => value
): Set<number> {
  const field = rawField.trim()
  if (field.length === 0) {
    throw new Error(`Empty ${fieldName} field`)
  }

  const result = new Set<number>()
  const segments = field.split(',')

  for (const rawSegment of segments) {
    const segment = rawSegment.trim()
    if (!segment) {
      throw new Error(`Invalid ${fieldName} list: ${rawField}`)
    }

    const values = parseFieldSegment(segment, min, max, fieldName, normalize)
    for (const value of values) {
      result.add(value)
    }
  }

  if (result.size === 0) {
    throw new Error(`Invalid ${fieldName} field: ${rawField}`)
  }

  return result
}

function parseCronExpression(expression: string): ParsedCronExpression {
  const normalized = expression.trim().replace(/\s+/g, ' ')
  const cached = expressionCache.get(normalized)
  if (cached) {
    return cached
  }

  const fields = normalized.split(' ')
  if (fields.length !== CRON_PART_COUNT) {
    throw new Error(`Invalid cron expression: ${expression}`)
  }

  const parsed: ParsedCronExpression = {
    minute: parseField(fields[0], 0, 59, 'minute'),
    hour: parseField(fields[1], 0, 23, 'hour'),
    dayOfMonth: parseField(fields[2], 1, 31, 'dayOfMonth'),
    month: parseField(fields[3], 1, 12, 'month'),
    dayOfWeek: parseField(fields[4], 0, 7, 'dayOfWeek', (value) => (value === 7 ? 0 : value)),
  }

  expressionCache.set(normalized, parsed)
  return parsed
}

function matchesParsedCron(parsed: ParsedCronExpression, date: Date): boolean {
  return (
    parsed.minute.has(date.getMinutes()) &&
    parsed.hour.has(date.getHours()) &&
    parsed.dayOfMonth.has(date.getDate()) &&
    parsed.month.has(date.getMonth() + 1) &&
    parsed.dayOfWeek.has(date.getDay())
  )
}

export function isValidCronExpression(expression: string): boolean {
  try {
    parseCronExpression(expression)
    return true
  } catch {
    return false
  }
}

export function getNextCronRun(expression: CronSchedule['expression'], fromTimestamp: number): number | undefined {
  const parsed = parseCronExpression(expression)

  const cursor = new Date(fromTimestamp)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  for (let index = 0; index < MAX_LOOKAHEAD_MINUTES; index += 1) {
    if (matchesParsedCron(parsed, cursor)) {
      return cursor.getTime()
    }

    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return undefined
}

export function matchesCronExpression(expression: CronSchedule['expression'], timestamp: number): boolean {
  const parsed = parseCronExpression(expression)
  const date = new Date(timestamp)
  return matchesParsedCron(parsed, date)
}

export function clearCronExpressionCache(): void {
  expressionCache.clear()
}

export const CRON_FIELD_RANGES = {
  minute: createRange(0, 59),
  hour: createRange(0, 23),
  dayOfMonth: createRange(1, 31),
  month: createRange(1, 12),
  dayOfWeek: createRange(0, 6),
}
