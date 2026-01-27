/**
 * 微博发布 Store
 * 管理草稿、发布博文、AI 扩展
 *
 * 重构说明：
 * - 发布时使用新的 UniversalPost.primaryType 和 media 字段
 * - 同时保持 payload 中的兼容字段，确保向后兼容
 * - Phase 5: 草稿存储从 localStorage 迁移到 ScopedStorage
 */

import { tryUseAppRuntime } from '@/services/appRuntime'
import type { ScopedStorage } from '@/services/appRuntime/types'
import { db } from '@/services/database'
import { writeQueue } from '@/services/database/writeQueue'
import { PromptService } from '@/services/prompt/promptService'
import { useAccountStore } from '@/stores/accountStore'
import { useAIStore } from '@/stores/aiStore'
import type {
  ContentFlags,
  MediaAsset,
  PostPayload,
  PrimaryContentType,
  UniversalPost,
} from '@/types/social'
import { createDefaultContentFlags, createDefaultStats } from '@/types/social'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref, shallowRef } from 'vue'
import type { ComposePostData, WeiboDraft } from '../types'
import { useFeedStore } from './feedStore'
import { getCurrentSourceTracking } from './llm/sourceTracking'

// ScopedStorage 键名
const STORAGE_KEYS = {
  DRAFTS: 'compose_drafts',
  MIGRATED: 'drafts_migrated_v1',
}

// 旧版 localStorage 键名（用于迁移）
const LEGACY_DRAFTS_KEY = 'weibo_drafts'

export const useComposeStore = defineStore('weiboCompose', () => {
  // ==================== 状态 ====================

  /** 草稿列表 */
  const drafts = ref<WeiboDraft[]>([])

  /** 是否正在发布 */
  const isPublishing = ref(false)

  /** 是否正在扩展 */
  const isExpanding = ref(false)

  /** 是否已初始化 */
  const isInitialized = ref(false)

  /** 缓存的 storage 引用 */
  const cachedStorage = shallowRef<ScopedStorage | null>(null)

  // ==================== 私有方法 ====================

  /**
   * 获取 ScopedStorage
   */
  function getStorage(): ScopedStorage | null {
    if (cachedStorage.value) {
      return cachedStorage.value
    }

    const runtime = tryUseAppRuntime()
    if (runtime) {
      cachedStorage.value = runtime.storage
      return runtime.storage
    }

    return null
  }

  /**
   * 从 localStorage 迁移旧数据
   */
  async function migrateFromLocalStorage(storage: ScopedStorage): Promise<void> {
    const migrated = await storage.get<boolean>(STORAGE_KEYS.MIGRATED)
    if (migrated) {
      return
    }

    console.log('[ComposeStore] 开始迁移草稿数据...')

    try {
      const legacyData = localStorage.getItem(LEGACY_DRAFTS_KEY)
      if (legacyData) {
        const parsedDrafts = JSON.parse(legacyData) as WeiboDraft[]
        if (parsedDrafts.length > 0) {
          await storage.set(STORAGE_KEYS.DRAFTS, parsedDrafts)
          console.log(`[ComposeStore] 迁移 ${parsedDrafts.length} 条草稿`)
        }
      }

      await storage.set(STORAGE_KEYS.MIGRATED, true)
      console.log('[ComposeStore] 草稿迁移完成')
    } catch (error) {
      console.error('[ComposeStore] 草稿迁移失败:', error)
    }
  }

  // ==================== 草稿管理 ====================

  /**
   * 从 ScopedStorage 加载草稿
   */
  async function loadDrafts(): Promise<WeiboDraft[]> {
    const storage = getStorage()
    if (!storage) {
      console.warn('[ComposeStore] ScopedStorage 不可用，使用空草稿列表')
      return drafts.value
    }

    try {
      // 先尝试迁移旧数据
      await migrateFromLocalStorage(storage)

      const stored = await storage.get<WeiboDraft[]>(STORAGE_KEYS.DRAFTS)
      if (stored) {
        drafts.value = stored
      }

      isInitialized.value = true
      console.log(`[ComposeStore] 加载 ${drafts.value.length} 条草稿`)
    } catch (e) {
      console.error('[ComposeStore] Failed to load drafts:', e)
    }
    return drafts.value
  }

  /**
   * 保存草稿到 ScopedStorage
   */
  async function persistDrafts(): Promise<void> {
    const storage = getStorage()
    if (!storage) {
      console.warn('[ComposeStore] ScopedStorage 不可用，草稿未保存')
      return
    }

    try {
      await storage.set(STORAGE_KEYS.DRAFTS, drafts.value)
    } catch (e) {
      console.error('[ComposeStore] Failed to persist drafts:', e)
    }
  }

  /**
   * 保存草稿（新建或更新）
   */
  async function saveDraft(
    draftData: Omit<WeiboDraft, 'id' | 'createdAt' | 'updatedAt'>,
    draftId?: string
  ): Promise<WeiboDraft> {
    const now = Date.now()

    if (draftId) {
      // 更新现有草稿
      const index = drafts.value.findIndex((d) => d.id === draftId)
      if (index !== -1) {
        drafts.value[index] = {
          ...drafts.value[index],
          ...draftData,
          updatedAt: now,
        }
        await persistDrafts()
        console.log(`[ComposeStore] 更新草稿: ${draftId}`)
        return drafts.value[index]
      }
    }

    // 创建新草稿
    const newDraft: WeiboDraft = {
      id: uuidv4(),
      ...draftData,
      createdAt: now,
      updatedAt: now,
    }

    drafts.value.unshift(newDraft)
    await persistDrafts()
    console.log(`[ComposeStore] 保存新草稿: ${newDraft.id}`)
    return newDraft
  }

  /**
   * 获取草稿
   */
  function getDraftById(draftId: string): WeiboDraft | undefined {
    return drafts.value.find((d) => d.id === draftId)
  }

  /**
   * 删除草稿
   */
  async function deleteDraft(draftId: string): Promise<boolean> {
    const index = drafts.value.findIndex((d) => d.id === draftId)
    if (index !== -1) {
      drafts.value.splice(index, 1)
      await persistDrafts()
      console.log(`[ComposeStore] 删除草稿: ${draftId}`)
      return true
    }
    return false
  }

  /**
   * 清空所有草稿
   */
  async function clearAllDrafts(): Promise<number> {
    const count = drafts.value.length
    drafts.value = []
    await persistDrafts()
    console.log(`[ComposeStore] 清空 ${count} 条草稿`)
    return count
  }

  /**
   * 获取草稿数量
   */
  function getDraftCount(): number {
    return drafts.value.length
  }

  // ==================== AI 扩展 ====================

  /**
   * AI 扩展博文内容
   */
  async function expandPostContent(userContent: string): Promise<{
    success: boolean
    expandedText?: string
    suggestedTopics?: string[]
    error?: string
  }> {
    isExpanding.value = true
    try {
      const aiStore = useAIStore()
      const prompt = PromptService.getPromptByScene('social.post.expand.weibo')

      if (!prompt) {
        return { success: false, error: '未找到扩展提示词' }
      }

      const filledTemplate = prompt.template
        .replace('{{userContent}}', userContent)
        .replace('{{authorIdentity}}', '普通用户')
        .replace('{{desiredTone}}', '轻松随意')

      const generateResult = await aiStore.generate({
        messages: [
          { role: 'system', content: prompt.systemPrompt || '' },
          { role: 'user', content: filledTemplate },
        ],
      })
      const result = generateResult.text

      if (!result) {
        return { success: false, error: 'AI 响应为空' }
      }

      // 解析 JSON 响应
      let parsed: any
      try {
        let cleanJson = result.trim()
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7)
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3)
        }
        parsed = JSON.parse(cleanJson.trim())
      } catch (e) {
        return { success: true, expandedText: result }
      }

      return {
        success: true,
        expandedText: parsed.text || result,
        suggestedTopics: parsed.suggestedTopics || [],
      }
    } catch (error: any) {
      console.error('[ComposeStore] Failed to expand content:', error)
      return { success: false, error: error.message || 'AI 扩展失败' }
    } finally {
      isExpanding.value = false
    }
  }

  /**
   * AI 扩展图片描述
   */
  async function expandImageDescription(imageDescription: string): Promise<{
    success: boolean
    expandedDescription?: string
    error?: string
  }> {
    isExpanding.value = true
    try {
      const aiStore = useAIStore()
      const prompt = PromptService.getPromptByScene('social.image.expand.weibo')

      if (!prompt) {
        return { success: false, error: '未找到图片扩展提示词' }
      }

      const filledTemplate = prompt.template
        .replace('{{imageDescription}}', imageDescription)
        .replace('{{purpose}}', '微博配图')

      const generateResult = await aiStore.generate({
        messages: [
          { role: 'system', content: prompt.systemPrompt || '' },
          { role: 'user', content: filledTemplate },
        ],
      })
      const result = generateResult.text

      if (!result) {
        return { success: false, error: 'AI 响应为空' }
      }

      let parsed: any
      try {
        let cleanJson = result.trim()
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7)
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3)
        }
        parsed = JSON.parse(cleanJson.trim())
      } catch (e) {
        return { success: true, expandedDescription: result }
      }

      return {
        success: true,
        expandedDescription: parsed.expandedDescription || result,
      }
    } catch (error: any) {
      console.error('[ComposeStore] Failed to expand image description:', error)
      return { success: false, error: error.message || '图片描述扩展失败' }
    } finally {
      isExpanding.value = false
    }
  }

  /**
   * AI 扩展视频描述
   */
  async function expandVideoDescription(videoDescription: string): Promise<{
    success: boolean
    expandedDescription?: string
    coverDescription?: string
    suggestedDuration?: number
    error?: string
  }> {
    isExpanding.value = true
    try {
      const aiStore = useAIStore()
      const prompt = PromptService.getPromptByScene('social.video.expand.weibo')

      if (!prompt) {
        return { success: false, error: '未找到视频扩展提示词' }
      }

      const filledTemplate = prompt.template
        .replace('{{videoDescription}}', videoDescription)
        .replace('{{videoType}}', 'vlog')

      const generateResult = await aiStore.generate({
        messages: [
          { role: 'system', content: prompt.systemPrompt || '' },
          { role: 'user', content: filledTemplate },
        ],
      })
      const result = generateResult.text

      if (!result) {
        return { success: false, error: 'AI 响应为空' }
      }

      let parsed: any
      try {
        let cleanJson = result.trim()
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7)
        } else if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3)
        }
        parsed = JSON.parse(cleanJson.trim())
      } catch (e) {
        return { success: true, expandedDescription: result }
      }

      return {
        success: true,
        expandedDescription: parsed.expandedDescription || result,
        coverDescription: parsed.coverDescription,
        suggestedDuration: parsed.suggestedDuration
          ? parseInt(parsed.suggestedDuration)
          : undefined,
      }
    } catch (error: any) {
      console.error('[ComposeStore] Failed to expand video description:', error)
      return { success: false, error: error.message || '视频描述扩展失败' }
    } finally {
      isExpanding.value = false
    }
  }

  // ==================== 发布博文 ====================

  /**
   * 发布微博
   * @param postData 博文数据
   * @param options 发布选项
   */
  async function publishPost(
    postData: ComposePostData,
    options?: {
      /** 是否自动生成互动数据（评论、点赞等） */
      autoGenerateEngagement?: boolean
    }
  ): Promise<{
    success: boolean
    postId?: string
    error?: string
  }> {
    // 通过 AppRuntime 获取当前微博实例的命名空间，用于数据隔离
    const runtime = tryUseAppRuntime()
    const namespace = runtime?.identity.dataNamespace

    const { autoGenerateEngagement = true } = options || {}
    isPublishing.value = true

    try {
      const accountStore = useAccountStore()
      const feedStore = useFeedStore()

      // 确保账号系统已初始化
      if (!accountStore.isInitialized) {
        await accountStore.initialize('玩家')
      }

      // 获取当前用户的微博账号
      const playerAccounts = await accountStore.getPlayerAllAccounts()
      let currentAccount = playerAccounts.find((a) => a.platformId === 'weibo')

      // 如果没有微博账号，尝试创建一个
      if (!currentAccount) {
        console.log('[ComposeStore] 玩家没有微博账号，尝试创建...')
        const player = accountStore.currentPlayer
        if (!player) {
          return { success: false, error: '请先初始化账号系统' }
        }

        currentAccount = await accountStore.createPlatformAccount(player.id, 'weibo', {
          handle: `user_${Date.now()}`,
          nickname: player.displayName || '微博用户',
          scope: 'global',
        })
        console.log('[ComposeStore] 已为玩家创建微博账号:', currentAccount.id)
      }

      const now = Date.now()
      const postId = uuidv4()

      // 构建正文内容
      let finalContent = postData.content

      // 添加话题标签
      if (postData.topics && postData.topics.length > 0) {
        const topicTags = postData.topics.map((t) => `#${t}#`).join(' ')
        finalContent = `${topicTags} ${finalContent}`
      }

      // === 使用新的类型系统 ===

      // 1. 确定主类型
      const primaryType: PrimaryContentType =
        postData.type === 'poll'
          ? 'poll'
          : postData.type === 'video'
            ? 'video'
            : postData.images.length >= 4
              ? 'gallery'
              : 'text'

      // 2. 构建媒体资源数组
      const media: MediaAsset[] = postData.images.map((img, index) => ({
        id: uuidv4(),
        type: 'image' as const,
        description: img.description,
        expandedDescription: img.expandedDescription,
        order: index,
      }))

      // 如果是视频帖，添加视频到 media
      if (postData.type === 'video' && postData.video) {
        media.push({
          id: uuidv4(),
          type: 'video' as const,
          description: postData.video.description,
          expandedDescription: postData.video.expandedDescription,
          coverDescription: postData.video.coverDescription,
          duration: postData.video.duration,
          order: 0,
        })
      }

      // 3. 构建 contentFlags
      const contentFlags: ContentFlags = {
        ...createDefaultContentFlags(),
        hasText: !!finalContent.trim(),
        hasImages: postData.images.length > 0,
        hasVideo: postData.type === 'video',
        hasPoll: postData.type === 'poll',
      }

      // 4. 构建 payload（使用新的 PostPayload 类型）
      const payload: PostPayload = {
        text: finalContent,
        // 兼容旧格式，同时保留
        images: postData.images.map((img) => ({
          description: img.description,
          expandedDescription: img.expandedDescription,
        })),
      }

      // 添加投票数据
      if (postData.type === 'poll' && postData.poll) {
        payload.poll = {
          question: postData.poll.question,
          options: postData.poll.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            votes: opt.votes,
          })),
          duration: postData.poll.duration,
          multiSelect: postData.poll.multiSelect,
          endTime: postData.poll.endTime || now + postData.poll.duration * 3600000,
        }
      }

      // 添加视频数据
      if (postData.type === 'video' && postData.video) {
        payload.video = {
          description: postData.video.expandedDescription || postData.video.description,
          duration: postData.video.duration,
          coverDescription: postData.video.coverDescription,
        }
      }

      // 获取来源追踪（用户发布时也可能在特定会话上下文中）
      const sourceTracking = getCurrentSourceTracking()

      // 5. 创建 UniversalPost（使用新结构）
      const universalPost: UniversalPost = {
        id: postId,
        platformId: 'weibo',
        // 按安全设计增加命名空间字段，确保微博数据隔离
        namespace,
        authorId: currentAccount.id,
        timestamp: now,

        // 新字段
        primaryType,
        contentFlags,
        media,

        topicTags: [...(postData.topics || [])],
        stats: createDefaultStats(),
        payload: JSON.parse(JSON.stringify(payload)),

        // 元信息
        meta: {
          source: postData.source || '微博网页版',
          visibility: 'public',
        },

        // 来源追踪（用于会话/楼层/Swipe 绑定）
        source: sourceTracking,
      }

      console.log('[ComposeStore] universalPost to save:', JSON.stringify(universalPost, null, 2))

      // 保存到数据库（通过写入队列，按 App + 命名空间串行化写入）
      await writeQueue.enqueue('app', namespace || 'weibo', async () => {
        await db.socialPosts.add(universalPost)
      })

      console.log(`[ComposeStore] 发布博文成功: ${postId}`)

      // 刷新首页信息流
      await feedStore.refreshFeed()

      // 自动生成互动数据
      if (autoGenerateEngagement) {
        const authorEntity = accountStore.currentPlayer
        const authorInfo = {
          name: currentAccount.nickname || authorEntity?.displayName || '用户',
          bio: authorEntity?.bio || '',
          followerCount: (currentAccount.platformData as any)?.followers || 100,
          accountType: (currentAccount.platformData as any)?.verified ? '认证用户' : '普通用户',
        }

        feedStore.generatePostEngagement(postId, finalContent, authorInfo).catch((err) => {
          console.warn('[ComposeStore] 自动生成互动失败:', err)
        })
      }

      return { success: true, postId }
    } catch (error: any) {
      console.error('[ComposeStore] Failed to publish post:', error)
      return { success: false, error: error.message || '发布失败' }
    } finally {
      isPublishing.value = false
    }
  }

  // 注意：不再在定义时自动加载，而是在 WeiboApp.vue 挂载后调用 loadDrafts()
  // 因为 ScopedStorage 需要 AppRuntime 上下文

  return {
    // 状态
    drafts,
    isInitialized,
    isPublishing,
    isExpanding,

    // 草稿管理
    loadDrafts,
    saveDraft,
    getDraftById,
    deleteDraft,
    clearAllDrafts,
    getDraftCount,

    // AI 扩展
    expandPostContent,
    expandImageDescription,
    expandVideoDescription,

    // 发布博文
    publishPost,
  }
})
