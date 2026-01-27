/**
 * 内容工厂 (Content Factory)
 *
 * 负责与 LLM 交互，生成结构化内容（博文、评论）
 *
 * Phase 2 重构：
 * - 使用新账号系统 (account.ts) 的类型
 * - 通过 accountService 管理账号
 * - 移除对旧 socialAccounts 表的依赖
 */

import JSON5 from 'json5'
import type { PlatformAccount } from '../../types/account'
import type { TrendingTopic } from '../../types/social'
import { accountService } from '../account/accountService'
import { UserPool } from '../account/userPool'
import AIGenerateService from '../aiGenerateService'
import { PromptService } from '../prompt/promptService'
import { PlatformRegistry } from './registry'

interface GenerationTask {
  id: string
  type: 'post' | 'comment'
  platformId: string
  context: Record<string, any>
}

export class ContentFactory {
  private static instance: ContentFactory

  private constructor() {}

  public static getInstance(): ContentFactory {
    if (!ContentFactory.instance) {
      ContentFactory.instance = new ContentFactory()
    }
    return ContentFactory.instance
  }

  /**
   * 生成博文
   */
  public async generatePost(
    platformId: string,
    topic: TrendingTopic,
    account?: PlatformAccount
  ): Promise<any> {
    const platform = PlatformRegistry.getInstance().getPlatform(platformId)
    if (!platform) throw new Error(`Platform ${platformId} not found`)

    // 如果没有指定账号，生成一个随机人设
    let persona = '一个关注时事的普通网友'
    if (account) {
      // 从账号获取人设信息
      const entity = await accountService.getEntity(account.entityId)
      if (entity) {
        persona = entity.bio || entity.displayName || '普通用户'
      }
    }

    // 尝试从 PromptService 获取提示词
    // 优先使用平台特定的提示词 (如 social.post.generate.weibo)
    // 如果未找到，回退到通用提示词 (social.post.generate)
    let prompt = platform.aiSetting.promptTemplate
      ? PromptService.getPromptByScene(platform.aiSetting.promptTemplate)
      : null

    if (!prompt) {
      prompt = PromptService.getPromptByScene('social.post.generate')
    }

    let systemPrompt = ''
    let userPrompt = ''

    if (prompt) {
      const rendered = PromptService.renderPrompt(prompt, {
        platformName: platform.name,
        platformCulture: `${platform.aiSetting.tone}. 常用语: ${platform.aiSetting.slang.join(', ')}`,
        topic: `${topic.keyword} (${topic.summary})`,
        authorIdentity: persona,
        length: platform.content.maxLength,
      })
      systemPrompt = rendered.systemPrompt || ''
      userPrompt = rendered.userPrompt
    } else {
      // Fallback (保留原有逻辑作为后备)
      console.warn('Prompt social.post.generate not found, using fallback.')
      systemPrompt = `
你是一个专业的社交媒体内容生成引擎。
当前平台: ${platform.name}
平台风格: ${platform.aiSetting.tone}
黑话/术语: ${platform.aiSetting.slang.join(', ')}

你的任务是基于给定的话题生成一条博文。
请严格输出 JSON 格式，不要包含 Markdown 代码块标记。
`.trim()

      userPrompt = `
话题: ${topic.keyword}
背景: ${topic.summary}
发布者人设: ${persona}
字数限制: ${platform.content.maxLength}

请生成符合该平台风格的博文。
如果是微博，不需要标题。如果是B站/知乎/小红书，需要标题。
payload 结构如下:
{
  "text": "博文内容",
  "title": "标题(可选)", 
  "images": ["image_desc_1", "image_desc_2"] (可选，描述图片内容)
}

JSON Output:
`.trim()
    }

    const result = await AIGenerateService.generate(
      {
        systemPrompt,
        userPrompt,
      },
      {
        temperature: 0.8,
      }
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    return this.parseAndRepairJSON(result.text)
  }

  /**
   * 生成评论
   *
   * Phase 2 变更：
   * - 评论者信息通过 accountService 创建/查询
   * - 不再使用旧的 UserPool.captureShadowAccount()
   */
  public async generateComments(
    platformId: string,
    postContent: string,
    count: number = 5
  ): Promise<any[]> {
    const platform = PlatformRegistry.getInstance().getPlatform(platformId)
    if (!platform) throw new Error(`Platform ${platformId} not found`)

    // 尝试从 PromptService 获取提示词
    // 优先查找特定平台的评论生成提示词
    let prompt = PromptService.getPromptByScene(`social.comment.batch.${platformId}`)

    if (!prompt) {
      prompt = PromptService.getPromptByScene('social.comment.batch')
    }

    let systemPrompt = ''
    let userPrompt = ''

    if (prompt) {
      const rendered = PromptService.renderPrompt(prompt, {
        platformName: platform.name,
        postContent: postContent.slice(0, 500), // 截断防止过长
        count: count,
        // 添加额外上下文，虽然 template 可能没显式用到，但便于后续扩展
        platformCulture: platform.aiSetting.tone,
      })
      systemPrompt = rendered.systemPrompt || ''
      userPrompt = rendered.userPrompt
    } else {
      // Fallback
      console.warn('Prompt social.comment.batch not found, using fallback.')
      systemPrompt = `
你是一个社交媒体评论区模拟器。
当前平台: ${platform.name}
平台风格: ${platform.aiSetting.tone}

请为下方的博文生成 ${count} 条评论。
模拟真实的用户生态，包括：粉丝、杠精、路人、广告哥等。
请严格输出 JSON 数组，不要包含 Markdown 代码块标记。
`.trim()

      userPrompt = `
博文内容: "${postContent.slice(0, 200)}..."

请生成 ${count} 条评论。
每条评论包含:
- content: 评论内容
- userType: "fan" | "hater" | "passerby" | "ad"
- nickname: 用户昵称 (随机生成)
- likes: 初始点赞数 (0-100)

JSON Array Output:
`.trim()
    }

    const result = await AIGenerateService.generate(
      {
        systemPrompt,
        userPrompt,
      },
      {
        temperature: 1.0, // 评论需要多样性
      }
    )

    if (!result.success) {
      throw new Error(result.error)
    }

    const comments = await this.parseAndRepairJSON(result.text)

    // 为评论者创建账号（使用新账号系统）
    if (Array.isArray(comments)) {
      for (const comment of comments) {
        if (comment.nickname) {
          // 异步创建账号，不阻塞返回
          this.ensureCommentAuthorAccount(
            platformId,
            comment.nickname,
            comment.userType || 'passerby'
          ).catch((err) => {
            console.warn('[ContentFactory] Failed to create commenter account:', err)
          })
        }
      }
    }

    return Array.isArray(comments) ? comments : []
  }

  /**
   * 确保评论作者账号存在
   * 使用新的账号系统创建 NPC 账号
   */
  private async ensureCommentAuthorAccount(
    platformId: string,
    nickname: string,
    userType: string
  ): Promise<string> {
    // 尝试查找已存在的账号（通过昵称）
    const existingAccounts = await accountService.getAccountsByPlatform(platformId)
    const existing = existingAccounts.find((acc) => acc.nickname === nickname)

    if (existing) {
      return existing.id
    }

    // 使用新的 UserPool 生成随机档案
    const userPool = UserPool.getInstance()
    const profile = userPool.generateByRole(userType, { platform: platformId })

    // 创建 NPC 实体
    const entity = await accountService.createEntity({
      type: 'npc',
      displayName: nickname,
      avatar: profile.avatar,
      bio: profile.bio,
      gender: profile.gender,
      source: 'social',
      scope: 'session', // 评论者默认 session 作用域
    })

    // 创建平台账号
    const handle = `user_${Math.random().toString(36).substr(2, 9)}`
    const account = await accountService.createPlatformAccount(entity.id, platformId, {
      handle,
      nickname,
      scope: 'session',
    })

    console.log(`[ContentFactory] Created commenter account: ${nickname} (${account.id})`)
    return account.id
  }

  /**
   * 解析并尝试修复 JSON
   */
  private async parseAndRepairJSON(text: string): Promise<any> {
    // 1. 清洗 markdown 标记
    let cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    // 2. 尝试解析
    try {
      return JSON5.parse(cleanText)
    } catch (e) {
      console.warn('JSON parse failed, attempting repair...', e)

      // 简单修复: 尝试找到第一个 { 或 [ 和 最后一个 } 或 ]
      const firstBrace = cleanText.indexOf('{')
      const firstBracket = cleanText.indexOf('[')
      const lastBrace = cleanText.lastIndexOf('}')
      const lastBracket = cleanText.lastIndexOf(']')

      let start = -1
      let end = -1

      // 判断是对象还是数组
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace
        end = lastBrace
      } else if (firstBracket !== -1) {
        start = firstBracket
        end = lastBracket
      }

      if (start !== -1 && end !== -1 && end > start) {
        cleanText = cleanText.substring(start, end + 1)
        try {
          return JSON5.parse(cleanText)
        } catch (e2) {
          console.error('JSON repair failed', e2)
          // 如果还是失败，且在生产环境，可能需要再次调用 LLM 进行修复 (Reflection)
          // 暂时返回 null 或抛出
          throw new Error('Failed to parse JSON content')
        }
      } else {
        throw new Error('No JSON object or array found')
      }
    }
  }
}
