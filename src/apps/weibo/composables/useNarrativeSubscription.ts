/**
 * 微博叙事订阅 Composable
 * 
 * 负责订阅来自酒馆的叙事内容，分析是否需要生成微博相关内容
 * 
 * 使用方式：
 * 1. 在 WeiboApp.vue 的 onMounted 中调用 startSubscription()
 * 2. 在 onUnmounted 中调用 stopSubscription()
 */

import { ref, onUnmounted } from 'vue'
import {
  narrativeService,
  createNarrativeVariables,
  type NarrativeEvent,
} from '@/services/narrativeService'
import { AIGenerateService } from '@/services/aiGenerateService'
import { useWeiboStore } from '@/stores/weiboStore'
import { useLLMTaskStore } from '../stores'
import { db } from '@/services/database'
import { writeQueue } from '@/services/database/writeQueue'
import { tryUseAppRuntime } from '@/services/appRuntime'
import { v4 as uuidv4 } from 'uuid'
import type { ContentSourceTracking } from '@/types/social'

/**
 * 叙事分析结果
 */
interface NarrativeAnalysisResult {
  shouldPost: boolean
  reason: string
  extractedContent: {
    text: string
    author: string
    images?: string[]
    topic?: string
  } | null
}

// 使用标准的 ContentSourceTracking 类型替代自定义 SourceTracking

/**
 * 微博叙事订阅 Hook
 */
export function useNarrativeSubscription() {
  const weiboStore = useWeiboStore()
  const llmTaskStore = useLLMTaskStore()

  // 订阅状态
  const isSubscribed = ref(false)
  const isProcessing = ref(false)
  const lastProcessedEvent = ref<NarrativeEvent | null>(null)
  const processedSwipes = ref<Set<string>>(new Set())

  // 取消订阅函数
  let unsubscribe: (() => void) | null = null

  /**
   * 生成 Swipe 唯一键
   */
  function getSwipeKey(event: NarrativeEvent): string {
    return `${event.sessionId}:${event.messageId}:${event.swipeId}`
  }

  /**
   * 检查是否已处理过该 Swipe
   */
  function hasProcessedSwipe(event: NarrativeEvent): boolean {
    return processedSwipes.value.has(getSwipeKey(event))
  }

  /**
   * 标记 Swipe 为已处理
   */
  function markSwipeProcessed(event: NarrativeEvent): void {
    processedSwipes.value.add(getSwipeKey(event))
  }

  /**
   * 处理叙事事件
   */
  async function handleNarrativeEvent(event: NarrativeEvent) {
    // 避免重复处理
    if (isProcessing.value) {
      console.log('[Weibo] 正在处理中，跳过此事件')
      return
    }

    // Swipe 切换时的处理逻辑
    if (event.isSwipeChange) {
      // 如果已经处理过这个 Swipe，不再重复处理
      if (hasProcessedSwipe(event)) {
        console.log('[Weibo] Swipe 已处理过，跳过:', getSwipeKey(event))
        return
      }
    }

    isProcessing.value = true
    lastProcessedEvent.value = event

    try {
      console.log('[Weibo] 收到叙事内容:', {
        messageId: event.messageId,
        swipeId: event.swipeId,
        isSwipeChange: event.isSwipeChange,
        contentLength: event.content.length,
      })

      // 分析叙事内容
      const result = await analyzeNarrative(event)

      if (result.shouldPost) {
        console.log('[Weibo] 需要生成微博内容:', result.reason)

        // 记录来源追踪
        const sourceTracking: ContentSourceTracking = {
          sessionId: event.sessionId,
          sourceMessageId: event.messageId,
          sourceSwipeId: event.swipeId,
          generatedAt: Date.now(),
        }

        // 根据分析结果生成或提取微博内容
        if (result.extractedContent) {
          // 有明确的微博内容，直接使用
          await createWeiboPost(result.extractedContent, sourceTracking)
        } else {
          // 没有明确内容，触发 LLM 生成任务
          await triggerPostGeneration(event.content, sourceTracking)
        }
      } else {
        console.log('[Weibo] 无需生成微博:', result.reason)
      }

      // 标记为已处理
      markSwipeProcessed(event)
    } catch (error) {
      console.error('[Weibo] 处理叙事内容失败:', error)
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * 分析叙事内容
   */
  async function analyzeNarrative(
    event: NarrativeEvent
  ): Promise<NarrativeAnalysisResult> {
    try {
      // 转换为标准变量并展开为 Record<string, unknown>
      const narrativeVars = createNarrativeVariables(event)
      const variables: Record<string, unknown> = {
        narrative: narrativeVars.narrative,
        narrativeMessageId: narrativeVars.narrativeMessageId,
        narrativeSwipeId: narrativeVars.narrativeSwipeId,
        narrativeTimestamp: narrativeVars.narrativeTimestamp,
        isSwipeChange: narrativeVars.isSwipeChange,
        narrativeSessionId: narrativeVars.narrativeSessionId,
      }

      // 调用 LLM 分析
      const result = await AIGenerateService.generateWithPrompt(
        'social.weibo.analyze.narrative',
        variables,
        {
          appId: 'weibo',
          scene: 'social.weibo.analyze.narrative',
        }
      )

      // 解析结果
      const parsed = parseAnalysisResult(result.text)
      return parsed
    } catch (error) {
      console.error('[Weibo] 分析叙事内容失败:', error)
      // 出错时返回不需要发布
      return {
        shouldPost: false,
        reason: '分析失败',
        extractedContent: null,
      }
    }
  }

  /**
   * 解析分析结果 JSON
   */
  function parseAnalysisResult(text: string): NarrativeAnalysisResult {
    try {
      // 移除可能的 Markdown 代码块
      let cleanJson = text.trim()
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7)
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3)
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3)
      }
      cleanJson = cleanJson.trim()

      const parsed = JSON.parse(cleanJson)

      return {
        shouldPost: Boolean(parsed.shouldPost),
        reason: parsed.reason || '未知原因',
        extractedContent: parsed.extractedContent || null,
      }
    } catch (error) {
      console.error('[Weibo] 解析分析结果失败:', error)
      return {
        shouldPost: false,
        reason: '解析失败',
        extractedContent: null,
      }
    }
  }

  /**
   * 创建微博帖子（从叙事中提取的内容）
   */
  async function createWeiboPost(
    content: NonNullable<NarrativeAnalysisResult['extractedContent']>,
    source: ContentSourceTracking
  ) {
    try {
      // 获取命名空间用于数据隔离
      const runtime = tryUseAppRuntime()
      const namespace = runtime?.identity.dataNamespace

      // 创建帖子到数据库
      const postId = uuidv4()
      const authorId = uuidv4() // TODO: 根据 author 匹配或创建影子账号

      const post = {
        id: postId,
        platformId: 'weibo',
        namespace,
        authorId,
        timestamp: Date.now(),
        topicTags: content.topic ? [content.topic] : [],
        payload: {
          text: content.text,
          images: content.images || [],
          topic: content.topic,
        },
        stats: {
          views: Math.floor(Math.random() * 5000),
          likes: Math.floor(Math.random() * 1000),
          comments: Math.floor(Math.random() * 100),
          shares: Math.floor(Math.random() * 50),
        },
        // 来源追踪（使用标准的 source 字段）
        source,
      }

      // 通过写入队列串行化写入，确保数据一致性
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.add(post)
      })
      console.log('[Weibo] 已创建微博帖子:', postId)

      // 刷新信息流
      await weiboStore.refreshFeed()
    } catch (error) {
      console.error('[Weibo] 创建微博帖子失败:', error)
    }
  }

  /**
   * 触发帖子生成任务
   */
  async function triggerPostGeneration(
    narrativeContent: string,
    source: ContentSourceTracking
  ) {
    try {
      // 使用内置任务生成微博
      const task = llmTaskStore.createTask({
        name: '叙事驱动 - 生成微博',
        description: `根据叙事内容自动生成微博 (来自楼层 ${source.sourceMessageId})`,
        type: 'manual',
        executionMode: 'once',
        manualPrompt: `根据以下叙事内容，生成一条相关的微博帖子：

<叙事内容>
${narrativeContent}
</叙事内容>

要求：
1. 从叙事中提取关键信息或事件
2. 以微博风格重新表达
3. 包含适当的话题标签和 Emoji
4. 字数控制在 140 字以内

请以 JSON 格式返回：
{"text": "微博正文", "hasImage": false}`,
        systemPrompt:
          '你是一个微博用户，擅长将生活中的事件转化为有趣的微博内容。请输出纯 JSON，不要包含 markdown 代码块。',
        config: {
          source: 'custom',
          temperature: 0.9,
          maxTokens: 300,
        },
        sourceApp: 'weibo',
      })

      // 立即执行
      await llmTaskStore.executeTask(task.id)
      console.log('[Weibo] 已触发帖子生成任务:', task.id)
    } catch (error) {
      console.error('[Weibo] 触发帖子生成失败:', error)
    }
  }

  /**
   * 开始订阅
   */
  function startSubscription() {
    if (isSubscribed.value) {
      console.log('[Weibo] 已经在订阅中')
      return
    }

    unsubscribe = narrativeService.subscribe(handleNarrativeEvent)
    isSubscribed.value = true
    console.log('[Weibo] 开始订阅叙事内容')
  }

  /**
   * 停止订阅
   */
  function stopSubscription() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    isSubscribed.value = false
    console.log('[Weibo] 停止订阅叙事内容')
  }

  /**
   * 清除已处理记录（切换会话时调用）
   */
  function clearProcessedSwipes() {
    processedSwipes.value.clear()
  }

  // 组件卸载时自动停止订阅
  onUnmounted(() => {
    stopSubscription()
  })

  return {
    // 状态
    isSubscribed,
    isProcessing,
    lastProcessedEvent,

    // 方法
    startSubscription,
    stopSubscription,
    clearProcessedSwipes,

    // 手动触发分析（用于测试）
    analyzeNarrative,
  }
}
