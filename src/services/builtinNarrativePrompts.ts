/**
 * 内置叙事理解系统提示词
 *
 * 这些提示词用于帮助 LLM 理解来自酒馆等平台的叙事内容。
 * 用户可以在 Prompts App 中查看、修改或禁用这些提示词。
 *
 * 设计原则：
 * 1. 默认开启，开箱即用
 * 2. 提供通用指导，不过度约束
 * 3. 按 App 细分，便于针对性调优
 * 4. 用户/开发者可覆盖或扩展
 */

import type { SystemPromptDefinition } from './prompt/systemPromptService'
import { SystemPromptService } from './prompt/systemPromptService'

// ========== 内置提示词定义 ==========

/**
 * 全局叙事理解提示词
 * 适用于所有需要理解叙事内容的场景
 */
const GLOBAL_NARRATIVE_PROMPT: SystemPromptDefinition = {
  name: '叙事内容理解（全局）',
  description: '帮助 AI 理解来自角色扮演/互动小说的叙事内容',
  content: `你正在处理一段来自角色扮演/互动小说的叙事内容。请注意：

1. 这些内容描述的是虚构故事中的事件，需要从故事视角去理解
2. 对于以下叙事内容仅做参考，需结合实际情境和过往内容去分析并给出合理结果
3. 提取信息时要保持与故事风格和角色设定一致
4. 如果叙事中没有明确提及某些信息，应基于合理推断而非凭空捏造`,
  scope: 'global',
  applicableScenes: ['social.*', 'chat.*', 'email.*', 'live.*'],
  priority: 10, // 较低优先级，让更具体的指令可以覆盖
}

/**
 * 微博 App 叙事理解提示词
 */
const WEIBO_NARRATIVE_PROMPT: SystemPromptDefinition = {
  name: '叙事内容理解（微博）',
  description: '帮助 AI 从叙事内容中提取社交媒体相关信息',
  content: `在处理叙事内容时，请特别关注以下社交媒体相关的信息：

1. 角色是否发布了微博/动态/帖子
2. 发布的内容、配图描述、发布时间
3. 角色的情绪状态和发帖动机
4. 与其他角色的互动（评论、转发、点赞）

提取信息时：
- 保持角色的说话风格和人设
- 如果叙事中提到"发了微博"但没有具体内容，需要根据情境合理推断
- 注意区分角色的公开发言和私下想法`,
  scope: 'app',
  appId: 'weibo',
  mode: 'append',
  applicableScenes: ['social.weibo.*'],
  priority: 20,
}

/**
 * 聊天 App 叙事理解提示词
 */
const CHAT_NARRATIVE_PROMPT: SystemPromptDefinition = {
  name: '叙事内容理解（聊天）',
  description: '帮助 AI 从叙事内容中提取私聊/群聊相关信息',
  content: `在处理叙事内容时，请特别关注以下聊天相关的信息：

1. 角色之间的对话内容
2. 消息的发送者、接收者、时间
3. 对话的语气和情感色彩
4. 是否有未读消息或等待回复的情况

生成聊天内容时：
- 保持角色的说话习惯和口癖
- 聊天消息应该简短、口语化
- 注意上下文的连贯性`,
  scope: 'app',
  appId: 'chat',
  mode: 'append',
  applicableScenes: ['chat.*'],
  priority: 20,
}

/**
 * 邮件 App 叙事理解提示词
 */
const EMAIL_NARRATIVE_PROMPT: SystemPromptDefinition = {
  name: '叙事内容理解（邮件）',
  description: '帮助 AI 从叙事内容中提取邮件相关信息',
  content: `在处理叙事内容时，请特别关注以下邮件相关的信息：

1. 是否提到收发邮件
2. 邮件的发件人、收件人、主题
3. 邮件的正式程度和语气
4. 是否有附件或需要回复的事项

生成邮件内容时：
- 根据发件人身份调整正式程度
- 邮件格式应规范（称呼、正文、落款）
- 注意邮件与叙事时间线的一致性`,
  scope: 'app',
  appId: 'email',
  mode: 'append',
  applicableScenes: ['email.*'],
  priority: 20,
}

/**
 * 直播 App 叙事理解提示词
 */
const LIVE_NARRATIVE_PROMPT: SystemPromptDefinition = {
  name: '叙事内容理解（直播）',
  description: '帮助 AI 从叙事内容中提取直播相关信息',
  content: `在处理叙事内容时，请特别关注以下直播相关的信息：

1. 是否提到直播活动
2. 直播的内容、主播、观众互动
3. 弹幕和礼物的情况
4. 直播间的氛围和热度

生成直播相关内容时：
- 弹幕应该简短、即时
- 保持直播间的热闹氛围
- 注意不同观众的发言风格差异`,
  scope: 'app',
  appId: 'live',
  mode: 'append',
  applicableScenes: ['live.*'],
  priority: 20,
}

// ========== 所有内置提示词 ==========

const BUILTIN_NARRATIVE_PROMPTS: SystemPromptDefinition[] = [
  GLOBAL_NARRATIVE_PROMPT,
  WEIBO_NARRATIVE_PROMPT,
  CHAT_NARRATIVE_PROMPT,
  EMAIL_NARRATIVE_PROMPT,
  LIVE_NARRATIVE_PROMPT,
]

// 用于追踪已注册的内置提示词 ID
const registeredPromptIds = new Set<string>()

/**
 * 注册内置叙事理解提示词
 *
 * 应在应用初始化时调用一次。
 * 如果提示词已存在（用户可能已修改），则不会覆盖。
 */
export function registerBuiltinNarrativePrompts(): void {
  console.log('[BuiltinNarrativePrompts] 开始注册内置叙事理解提示词...')

  for (const definition of BUILTIN_NARRATIVE_PROMPTS) {
    // 检查是否已存在同名的系统提示词
    const existing = SystemPromptService.getAllSystemPrompts().find(
      (p) => p.name === definition.name
    )

    if (existing) {
      // 已存在，跳过（保留用户的修改）
      registeredPromptIds.add(existing.id)
      console.log(`[BuiltinNarrativePrompts] 跳过已存在的: ${definition.name}`)
      continue
    }

    // 创建新的系统提示词
    const created = SystemPromptService.create(definition)
    registeredPromptIds.add(created.id)
    console.log(`[BuiltinNarrativePrompts] 已创建: ${definition.name}`)
  }

  console.log(`[BuiltinNarrativePrompts] 注册完成，共 ${registeredPromptIds.size} 个提示词`)
}

/**
 * 获取所有内置叙事理解提示词的 ID
 */
export function getBuiltinNarrativePromptIds(): string[] {
  return Array.from(registeredPromptIds)
}

/**
 * 检查指定 ID 是否是内置叙事理解提示词
 */
export function isBuiltinNarrativePrompt(id: string): boolean {
  return registeredPromptIds.has(id)
}

/**
 * 重置所有内置叙事理解提示词为默认值
 *
 * 注意：这会删除用户对内置提示词的修改
 */
export function resetBuiltinNarrativePrompts(): void {
  console.log('[BuiltinNarrativePrompts] 重置所有内置提示词...')

  // 删除现有的内置提示词
  for (const id of registeredPromptIds) {
    SystemPromptService.delete(id)
  }
  registeredPromptIds.clear()

  // 重新注册
  for (const definition of BUILTIN_NARRATIVE_PROMPTS) {
    const created = SystemPromptService.create(definition)
    registeredPromptIds.add(created.id)
  }

  console.log('[BuiltinNarrativePrompts] 重置完成')
}

/**
 * 获取内置提示词定义（用于 UI 显示默认值）
 */
export function getBuiltinNarrativePromptDefinitions(): SystemPromptDefinition[] {
  return [...BUILTIN_NARRATIVE_PROMPTS]
}
