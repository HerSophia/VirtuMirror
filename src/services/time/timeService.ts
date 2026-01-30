import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatStore } from '@/stores/chatStore'
import { loggerService } from '@/services/logger'

const logger = loggerService.child('service:time')

// Time Modes as defined in documentation
export type TimeMode = 'system' | 'offset' | 'virtual' | 'frozen' | 'simulated' // added simulated for chat-sync

export interface Alarm {
  id: string
  enabled: boolean
  time: { hour: number; minute: number }
  repeat: number[]
  label: string
  soundId: string
  vibrate: boolean
  snoozeCount: number
  nextTriggerTime: number
}

// Helper: Convert Chinese numbers to integer
function cnToInt(str: string): number {
  const map: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '两': 2
  }
  
  // Handle Year case "二零二四" -> 2024
  if (str.length === 4 && (str.includes('二') || str.includes('零'))) {
    return parseInt(str.split('').map(c => map[c]).join(''))
  }

  // Handle 0-99
  let val = 0
  if (str.startsWith('十')) {
    val += 10
    if (str.length > 1) val += map[str[1]]
  } else if (str.length === 2 && str[1] === '十') {
    val += map[str[0]] * 10
  } else if (str.length === 3 && str[1] === '十') {
    val += map[str[0]] * 10 + map[str[2]]
  } else {
    val = map[str] || 0
  }
  return val
}

class TimeService {
  private static instance: TimeService
  private _currentTime = ref<Date>(new Date())
  private _mode = ref<TimeMode>('system')
  private _offset = ref<number>(0)
  private _virtualBaseTime = ref<number>(Date.now())
  private _realBaseTime = ref<number>(Date.now())
  private _timeMultiplier = ref<number>(1)
  private _is24Hour = ref<boolean>(true)
  
  // Tick loop management
  private _tickInterval: any = null
  private _listeners: Array<(date: Date) => void> = []

  private constructor() {
    this.startTicking()
  }

  public static getInstance(): TimeService {
    if (!TimeService.instance) {
      TimeService.instance = new TimeService()
    }
    return TimeService.instance
  }

  public init() {
    // Load settings from storage if needed (usually handled by store persistence)
    // Setup chat listener for simulated mode
    const chatStore = useChatStore()
    
    // Watch for chat changes to update time in simulated mode
    watch(() => chatStore.history, () => {
      if (this._mode.value === 'simulated') {
        this.syncTimeFromChatStore()
      }
    }, { deep: true })
  }

  public startTicking() {
    if (this._tickInterval) return
    
    // Using setInterval for simplicity, can be optimized to requestAnimationFrame
    this._tickInterval = setInterval(() => {
      this.updateTime()
    }, 1000)
  }

  public stopTicking() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval)
      this._tickInterval = null
    }
  }

  private updateTime() {
    const now = Date.now()
    
    switch (this._mode.value) {
      case 'system':
        this._currentTime.value = new Date(now)
        break
      case 'offset':
        this._currentTime.value = new Date(now + this._offset.value)
        break
      case 'virtual':
      case 'simulated':
        // Calculate elapsed real time since baseline, multiply by speed, add to virtual baseline
        const elapsed = now - this._realBaseTime.value
        const virtualElapsed = elapsed * this._timeMultiplier.value
        this._currentTime.value = new Date(this._virtualBaseTime.value + virtualElapsed)
        break
      case 'frozen':
        // Time doesn't update automatically
        break
    }

    // Notify listeners
    this._listeners.forEach(l => l(this._currentTime.value))
  }

  public getCurrentTime(): Date {
    return this._currentTime.value
  }

  public get mode() {
    return this._mode
  }

  public get is24Hour() {
    return this._is24Hour
  }

  public setMode(mode: TimeMode) {
    this._mode.value = mode
    
    if (mode === 'system') {
      this._offset.value = 0
    } else if (mode === 'simulated') {
      // Try to sync immediately from store if possible, 
      // but also rely on incoming message events
      this.syncTimeFromChatStore()
    } else if (mode === 'virtual') {
      // Reset baseline when switching to virtual
      this._realBaseTime.value = Date.now()
      this._virtualBaseTime.value = this._currentTime.value.getTime()
    }
    
    this.updateTime()
  }
  
  public set24Hour(value: boolean) {
    this._is24Hour.value = value
  }

  public formatTime(date: Date, options: { includeSeconds?: boolean } = {}): string {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const seconds = date.getSeconds()
    
    const pad = (n: number) => n.toString().padStart(2, '0')
    
    if (this._is24Hour.value) {
      return `${pad(hours)}:${pad(minutes)}${options.includeSeconds ? ':' + pad(seconds) : ''}`
    } else {
      const period = hours >= 12 ? 'PM' : 'AM'
      const h = hours % 12 || 12
      return `${h}:${pad(minutes)}${options.includeSeconds ? ':' + pad(seconds) : ''} ${period}`
    }
  }

  public addTickListener(callback: (date: Date) => void) {
    this._listeners.push(callback)
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback)
    }
  }
  
  // Deprecated: Internal sync from ChatStore, kept for fallback
  private syncTimeFromChatStore() {
    const chatStore = useChatStore()
    // Get all conversations
    const conversations = chatStore.getConversationsSortedByTime()
    if (conversations.length === 0) return

    // Get latest message from latest conversation
    const latestContactId = conversations[0]
    const lastMessage = chatStore.getLastMessage(latestContactId)
    
    if (!lastMessage || lastMessage.type !== 'text') return

    const content = (lastMessage as any).content
    if (!content) return

    this.syncFromContent(content)
  }

  /**
   * Public API to sync time from a message content string
   * Can be called by Adapters directly
   */
  public syncFromContent(content: string) {
    if (this._mode.value !== 'simulated') return

    const parsedDate = this.parseContentToDate(content, this._currentTime.value)
    
    if (parsedDate) {
      // Reset baselines
      this._virtualBaseTime.value = parsedDate.getTime()
      this._realBaseTime.value = Date.now()
      this.updateTime()
      logger.info(`Time Synced to: ${this.formatTime(parsedDate)} (${parsedDate.toLocaleDateString()})`)
    }
  }

  /**
   * Parse content string to Date object
   * Supports:
   * 1. Mixed/Full: 2028年6月5日 星期一 09:30, 2028/06/05 09:30
   * 2. Chinese: 二零二四年五月一日, 六月五日, 上午九点
   * 3. English: YYYY/MM/DD, etc.
   * 4. Time only: 14:30
   */
  private parseContentToDate(content: string, baseDate: Date): Date | null {
    let resultDate = new Date(baseDate)
    let matched = false
    
    // Only log if we find something interesting to avoid spamming on every message
    // Or we can keep it for debugging
    const shouldLog = import.meta.env.DEV
    
    if (shouldLog) {
        logger.debug('Parsing Message Content', { content: content.length > 50 ? content.substring(0, 50) + '...' : content })
    }

    // 1. Try match full Date + Time (Numeric)
    // Matches: 2024-05-01 12:00, 2024年5月1日 12:00
    const fullDateTimeRegex = /(\d{4})[年\/\-\.]\s?(\d{1,2})[月\/\-\.]\s?(\d{1,2})[日号]?\s+(?:星期[一二三四五六日]\s+)?(\d{1,2})[:：](\d{1,2})/
    const fullMatch = content.match(fullDateTimeRegex)
    if (fullMatch) {
      if (shouldLog) logger.debug('Matched: Full Date Time (Numeric)', { match: fullMatch[0] })
      resultDate.setFullYear(parseInt(fullMatch[1]))
      resultDate.setMonth(parseInt(fullMatch[2]) - 1)
      resultDate.setDate(parseInt(fullMatch[3]))
      resultDate.setHours(parseInt(fullMatch[4]))
      resultDate.setMinutes(parseInt(fullMatch[5]))
      resultDate.setSeconds(0)
      if (shouldLog) {
          logger.debug('Result:', { result: resultDate.toLocaleString() })
      }
      return resultDate
    }

    // 2. Try match Date only (Numeric)
    const dateRegex = /(\d{4})[年\/\-\.]\s?(\d{1,2})[月\/\-\.]\s?(\d{1,2})[日号]?/
    const dateMatch = content.match(dateRegex)
    if (dateMatch) {
      if (shouldLog) logger.debug('Matched: Date Only (Numeric)', { match: dateMatch[0] })
      resultDate.setFullYear(parseInt(dateMatch[1]))
      resultDate.setMonth(parseInt(dateMatch[2]) - 1)
      resultDate.setDate(parseInt(dateMatch[3]))
      matched = true
    }

    // 3. Try match Chinese Date
    // Matches: 二零二四年五月一日, 二零二四年5月1日
    const cnDateRegex = /([零一二三四五六七八九十]{2,4})年([零一二三四五六七八九十]{1,2})月([零一二三四五六七八九十]{1,3})日/
    const cnDateMatch = content.match(cnDateRegex)
    if (cnDateMatch) {
      if (shouldLog) logger.debug('Matched: Chinese Date', { match: cnDateMatch[0] })
      resultDate.setFullYear(cnToInt(cnDateMatch[1]))
      resultDate.setMonth(cnToInt(cnDateMatch[2]) - 1)
      resultDate.setDate(cnToInt(cnDateMatch[3]))
      matched = true
    }

    // 4. Try match Time (Numeric)
    // Matches: 09:30, 9:30
    const timeRegex = /\b([0-1]?[0-9]|2[0-3])[:：]([0-5][0-9])\b/
    const timeMatch = content.match(timeRegex)
    if (timeMatch) {
      if (shouldLog) logger.debug('Matched: Time Only (Numeric)', { match: timeMatch[0] })
      resultDate.setHours(parseInt(timeMatch[1]))
      resultDate.setMinutes(parseInt(timeMatch[2]))
      resultDate.setSeconds(0)
      
      // If we matched date earlier, return combined result
      if (matched) {
          if (shouldLog) {
              logger.debug('Result (Date + Time):', { result: resultDate.toLocaleString() })
          }
          return resultDate
      }
      
      if (shouldLog) {
          logger.debug('Result (Time Only update):', { result: resultDate.toLocaleString() })
      }
      return resultDate // If explicit time found, return immediately
    }

    // 5. Try match Chinese Time (Fuzzy)
    // Matches: 上午九点, 下午3点半
    const cnTimeRegex = /(凌晨|早上|上午|中午|下午|晚上)?\s?([零一二三四五六七八九十两\d]{1,2})点(半|[零一二三四五六七八九十\d]{1,2}分?)?/
    const cnTimeMatch = content.match(cnTimeRegex)
    if (cnTimeMatch) {
      if (shouldLog) logger.debug('Matched: Chinese Time', { match: cnTimeMatch[0] })
      const period = cnTimeMatch[1]
      let hourStr = cnTimeMatch[2]
      let minuteStr = cnTimeMatch[3]

      // Convert hour
      let hour = /\d/.test(hourStr) ? parseInt(hourStr) : cnToInt(hourStr)
      
      // Handle period
      if (period) {
        if (['下午', '晚上'].includes(period) && hour < 12) {
          hour += 12
        } else if (period === '凌晨' && hour === 12) {
          hour = 0
        }
      }

      // Convert minute
      let minute = 0
      if (minuteStr) {
        if (minuteStr === '半') {
          minute = 30
        } else {
          minuteStr = minuteStr.replace('分', '')
          minute = /\d/.test(minuteStr) ? parseInt(minuteStr) : cnToInt(minuteStr)
        }
      }

      if (shouldLog) logger.debug(`Parsed Time: ${period || ''} ${hour}:${minute}`)
      resultDate.setHours(hour)
      resultDate.setMinutes(minute)
      resultDate.setSeconds(0)
      if (shouldLog) {
          logger.debug('Result:', { result: resultDate.toLocaleString() })
      }
      return resultDate
    }

    // 6. English Formats (Fallback)
    // Try to parse if it looks like a date string
    // e.g. "June 5, 2028" or "2028/06/05"
    if (!matched && /[\d]{4}|[a-zA-Z]{3,}/.test(content)) {
        // Simple attempt for English dates
        // Extract potential date substring (simple heuristic)
        // Matches "YYYY/MM/DD" or "Month DD, YYYY"
        const enDateRegex = /(\d{4}\/\d{1,2}\/\d{1,2})|([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/
        const enMatch = content.match(enDateRegex)
        if (enMatch) {
            const dateStr = enMatch[0]
            if (shouldLog) logger.debug('Matched: English Date', { dateStr })
            const timestamp = Date.parse(dateStr)
            if (!isNaN(timestamp)) {
                const enDate = new Date(timestamp)
                resultDate.setFullYear(enDate.getFullYear())
                resultDate.setMonth(enDate.getMonth())
                resultDate.setDate(enDate.getDate())
                matched = true
            }
        }
    }

    if (shouldLog) {
        if (matched) {
            logger.debug('Result (Date Only update):', { result: resultDate.toLocaleString() })
        } else {
            logger.debug('No time information found.')
        }
    }

    return matched ? resultDate : null
  }
}

export const timeService = TimeService.getInstance()
