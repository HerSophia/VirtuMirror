/**
 * Mock服务入口
 * 在开发环境中模拟SillyTavern的API
 */

import { createMockTavernHelper } from './tavernHelper'
import { createMockSillyTavern } from './sillyTavern'
import { createMockEventEmitter } from './eventEmitter'
import { mockChatData } from './data/chatData'
import { mockContactData } from './data/contactData'

export interface MockServices {
  tavernHelper: ReturnType<typeof createMockTavernHelper>
  sillyTavern: ReturnType<typeof createMockSillyTavern>
  eventEmitter: ReturnType<typeof createMockEventEmitter>
}

let mockServices: MockServices | null = null

/**
 * 初始化Mock服务
 */
export function initMockServices(): MockServices {
  if (mockServices) {
    return mockServices
  }

  console.log('[Mock] Initializing mock services...')

  // 创建事件发射器
  const eventEmitter = createMockEventEmitter()

  // 创建Mock TavernHelper
  const tavernHelper = createMockTavernHelper({
    initialChatMessages: mockChatData,
  })

  // 创建Mock SillyTavern
  const sillyTavern = createMockSillyTavern({
    eventEmitter,
    chatMessages: mockChatData,
  })

  // 注入到全局window对象
  if (typeof window !== 'undefined') {
    (window as Window).TavernHelper = tavernHelper
    ;(window as Window).SillyTavern = {
      getContext: () => sillyTavern.getContext(),
    }
    
    // Mock toastr
    ;(window as Window).toastr = {
      info: (message: string, title?: string) => {
        console.log(`[Toast Info] ${title || ''}: ${message}`)
      },
      success: (message: string, title?: string) => {
        console.log(`[Toast Success] ${title || ''}: ${message}`)
      },
      warning: (message: string, title?: string) => {
        console.warn(`[Toast Warning] ${title || ''}: ${message}`)
      },
      error: (message: string, title?: string) => {
        console.error(`[Toast Error] ${title || ''}: ${message}`)
      },
    }

    // Mock jQuery (简化版)
    ;(window as unknown as { jQuery: MockJQueryStatic }).jQuery = createMockJQuery()
  }

  mockServices = {
    tavernHelper,
    sillyTavern,
    eventEmitter,
  }

  console.log('[Mock] Mock services initialized successfully')

  return mockServices
}

/**
 * 获取Mock服务实例
 */
export function getMockServices(): MockServices | null {
  return mockServices
}

/**
 * Mock jQuery 类型定义
 */
interface MockJQueryResult {
  length: number
  [Symbol.iterator]: () => Generator<Element, void, unknown>
  get: (index: number) => Element | undefined
  eq: (index: number) => MockJQueryResult
  find: (sel: string) => MockJQueryResult
  append: (content: string | Element) => MockJQueryResult
  prepend: (content: string | Element) => MockJQueryResult
  html: (content?: string) => string | MockJQueryResult
  text: (content?: string) => string | MockJQueryResult
  val: (value?: string) => string | MockJQueryResult
  attr: (name: string, value?: string) => string | MockJQueryResult
  data: (key: string, value?: unknown) => unknown | MockJQueryResult
  addClass: (className: string) => MockJQueryResult
  removeClass: (className: string) => MockJQueryResult
  toggleClass: (className: string) => MockJQueryResult
  hasClass: (className: string) => boolean
  css: (prop: string | Record<string, string>, value?: string) => string | MockJQueryResult | undefined
  show: () => MockJQueryResult
  hide: () => MockJQueryResult
  is: (selector: string) => boolean
  on: (event: string, handler: EventListener) => MockJQueryResult
  off: (event: string, handler?: EventListener) => MockJQueryResult
  one: (event: string, handler: EventListener) => MockJQueryResult
  trigger: (event: string) => MockJQueryResult
  click: (handler?: EventListener) => MockJQueryResult
  focus: () => MockJQueryResult
  blur: () => MockJQueryResult
  prop: (name: string, value?: boolean) => unknown | MockJQueryResult
  remove: () => MockJQueryResult
  empty: () => MockJQueryResult
  parent: () => MockJQueryResult
  children: (selector?: string) => MockJQueryResult
  first: () => MockJQueryResult
  last: () => MockJQueryResult
  filter: (selector: string) => MockJQueryResult
  each: (callback: (index: number, element: Element) => void) => MockJQueryResult
  map: <T>(callback: (index: number, element: Element) => T) => T[]
  scrollTop: (value?: number) => number | MockJQueryResult
  scrollLeft: (value?: number) => number | MockJQueryResult
  offset: () => { top: number; left: number }
  width: () => number
  height: () => number
}

interface MockJQueryStatic {
  (selector: string | Element | Document): MockJQueryResult
  fn: unknown
  extend: typeof Object.assign
  ajax: () => Promise<object>
  get: () => Promise<object>
  post: () => Promise<object>
}

/**
 * 创建简化版Mock jQuery
 */
function createMockJQuery(): MockJQueryStatic {
  const jq = function(selector: string | Element | Document) {
    const elements: Element[] = []
    
    if (typeof selector === 'string') {
      const found = document.querySelectorAll(selector)
      found.forEach(el => elements.push(el))
    } else if (selector instanceof Element) {
      elements.push(selector)
    } else if (selector === document) {
      elements.push(document.documentElement)
    }

    const result = {
      length: elements.length,
      [Symbol.iterator]: function* () {
        for (const el of elements) {
          yield el
        }
      },
      get: (index: number) => elements[index],
      eq: (index: number) => jq(elements[index]),
      find: (sel: string) => {
        const found: Element[] = []
        elements.forEach(el => {
          el.querySelectorAll(sel).forEach(child => found.push(child))
        })
        return jq(found as unknown as string)
      },
      append: (content: string | Element) => {
        elements.forEach(el => {
          if (typeof content === 'string') {
            el.insertAdjacentHTML('beforeend', content)
          } else {
            el.appendChild(content)
          }
        })
        return result
      },
      prepend: (content: string | Element) => {
        elements.forEach(el => {
          if (typeof content === 'string') {
            el.insertAdjacentHTML('afterbegin', content)
          } else {
            el.insertBefore(content, el.firstChild)
          }
        })
        return result
      },
      html: (content?: string) => {
        if (content === undefined) {
          return elements[0]?.innerHTML || ''
        }
        elements.forEach(el => {
          el.innerHTML = content
        })
        return result
      },
      text: (content?: string) => {
        if (content === undefined) {
          return elements[0]?.textContent || ''
        }
        elements.forEach(el => {
          el.textContent = content
        })
        return result
      },
      val: (value?: string) => {
        const input = elements[0] as HTMLInputElement
        if (value === undefined) {
          return input?.value || ''
        }
        elements.forEach(el => {
          (el as HTMLInputElement).value = value
        })
        return result
      },
      attr: (name: string, value?: string) => {
        if (value === undefined) {
          return elements[0]?.getAttribute(name) || ''
        }
        elements.forEach(el => {
          el.setAttribute(name, value)
        })
        return result
      },
      data: (key: string, value?: unknown) => {
        const el = elements[0] as HTMLElement
        if (value === undefined) {
          return el?.dataset?.[key]
        }
        elements.forEach(elem => {
          (elem as HTMLElement).dataset[key] = String(value)
        })
        return result
      },
      addClass: (className: string) => {
        elements.forEach(el => el.classList.add(className))
        return result
      },
      removeClass: (className: string) => {
        elements.forEach(el => el.classList.remove(className))
        return result
      },
      toggleClass: (className: string) => {
        elements.forEach(el => el.classList.toggle(className))
        return result
      },
      hasClass: (className: string) => {
        return elements[0]?.classList.contains(className) || false
      },
      css: (prop: string | Record<string, string>, value?: string) => {
        if (typeof prop === 'object') {
          elements.forEach(el => {
            Object.assign((el as HTMLElement).style, prop)
          })
        } else if (value !== undefined) {
          elements.forEach(el => {
            (el as HTMLElement).style.setProperty(prop, value)
          })
        } else {
          return getComputedStyle(elements[0] as HTMLElement).getPropertyValue(prop)
        }
        return result
      },
      show: () => {
        elements.forEach(el => {
          (el as HTMLElement).style.display = ''
        })
        return result
      },
      hide: () => {
        elements.forEach(el => {
          (el as HTMLElement).style.display = 'none'
        })
        return result
      },
      is: (selector: string) => {
        if (selector === ':hidden') {
          const el = elements[0] as HTMLElement
          return el?.style.display === 'none' || el?.offsetParent === null
        }
        if (selector === ':visible') {
          const el = elements[0] as HTMLElement
          return el?.style.display !== 'none' && el?.offsetParent !== null
        }
        return elements[0]?.matches(selector) || false
      },
      on: (event: string, handler: EventListener) => {
        elements.forEach(el => {
          el.addEventListener(event, handler)
        })
        return result
      },
      off: (event: string, handler?: EventListener) => {
        elements.forEach(el => {
          if (handler) {
            el.removeEventListener(event, handler)
          }
        })
        return result
      },
      one: (event: string, handler: EventListener) => {
        elements.forEach(el => {
          el.addEventListener(event, handler, { once: true })
        })
        return result
      },
      trigger: (event: string) => {
        elements.forEach(el => {
          el.dispatchEvent(new Event(event, { bubbles: true }))
        })
        return result
      },
      click: (handler?: EventListener) => {
        if (handler) {
          return result.on('click', handler)
        }
        return result.trigger('click')
      },
      focus: () => {
        (elements[0] as HTMLElement)?.focus()
        return result
      },
      blur: () => {
        (elements[0] as HTMLElement)?.blur()
        return result
      },
      prop: (name: string, value?: boolean) => {
        if (value === undefined) {
          return (elements[0] as HTMLInputElement)?.[name as keyof HTMLInputElement]
        }
        elements.forEach(el => {
          (el as HTMLInputElement)[name as keyof HTMLInputElement] = value as never
        })
        return result
      },
      remove: () => {
        elements.forEach(el => el.remove())
        return result
      },
      empty: () => {
        elements.forEach(el => {
          el.innerHTML = ''
        })
        return result
      },
      parent: () => {
        const parents = elements.map(el => el.parentElement).filter(Boolean) as Element[]
        return jq(parents as unknown as string)
      },
      children: (selector?: string) => {
        const children: Element[] = []
        elements.forEach(el => {
          const kids = selector ? el.querySelectorAll(`:scope > ${selector}`) : el.children
          Array.from(kids).forEach(kid => children.push(kid))
        })
        return jq(children as unknown as string)
      },
      first: () => jq(elements[0]),
      last: () => jq(elements[elements.length - 1]),
      filter: (selector: string) => {
        const filtered = elements.filter(el => el.matches(selector))
        return jq(filtered as unknown as string)
      },
      each: (callback: (index: number, element: Element) => void) => {
        elements.forEach((el, i) => callback(i, el))
        return result
      },
      map: <T>(callback: (index: number, element: Element) => T) => {
        return elements.map((el, i) => callback(i, el))
      },
      scrollTop: (value?: number) => {
        if (value === undefined) {
          return (elements[0] as HTMLElement)?.scrollTop || 0
        }
        elements.forEach(el => {
          (el as HTMLElement).scrollTop = value
        })
        return result
      },
      scrollLeft: (value?: number) => {
        if (value === undefined) {
          return (elements[0] as HTMLElement)?.scrollLeft || 0
        }
        elements.forEach(el => {
          (el as HTMLElement).scrollLeft = value
        })
        return result
      },
      offset: () => {
        const el = elements[0]
        if (!el) return { top: 0, left: 0 }
        const rect = el.getBoundingClientRect()
        return {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
        }
      },
      width: () => (elements[0] as HTMLElement)?.offsetWidth || 0,
      height: () => (elements[0] as HTMLElement)?.offsetHeight || 0,
    }

    return result as MockJQueryResult
  }

  // 添加静态方法
  const jqStatic = jq as unknown as MockJQueryStatic
  jqStatic.fn = jq.prototype
  jqStatic.extend = Object.assign
  jqStatic.ajax = async () => ({})
  jqStatic.get = async () => ({})
  jqStatic.post = async () => ({})

  return jqStatic
}

// 导出Mock数据
export { mockChatData } from './data/chatData'
export { mockContactData } from './data/contactData'
export { createMockTavernHelper } from './tavernHelper'
export { createMockSillyTavern } from './sillyTavern'
export { createMockEventEmitter } from './eventEmitter'

// 导出 AI Provider
export {
  createMockProvider,
  getMockModel,
  generateText,
  streamText,
} from './aiProvider'