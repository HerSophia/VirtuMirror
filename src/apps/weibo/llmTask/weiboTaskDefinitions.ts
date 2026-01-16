/**
 * 微博 App LLM 任务定义
 *
 * 将微博内置任务转换为系统服务的 LLMTaskDefinition 格式
 * @see docs/systems/llm-task-service.md
 */

import { RequestPriority } from '@/services/ai/types';
import type { LLMTaskDefinition, LLMTaskTemplate } from '@/services/llmTask/types';

/**
 * 微博 App ID
 */
export const WEIBO_APP_ID = 'weibo';

/**
 * 微博任务定义列表
 *
 * 注意：
 * - id 格式为 "appId:taskId"
 * - outputHandlerId 格式为 "appId:handlerId"
 * - contextProviders 格式为 "appId:providerId" 或 "system:providerId"
 */
export const weiboTaskDefinitions: LLMTaskDefinition[] = [
  // ========== 核心任务：生成微博博文 ==========
  {
    id: 'weibo:generate-post',
    appId: WEIBO_APP_ID,
    name: '🔥 生成微博博文',
    description: '根据热门话题自动生成一条微博内容（支持文字/图集/投票/视频等类型）',
    icon: 'fa-pen-fancy',
    category: 'content',

    type: 'prompt',
    executionMode: 'repeatable',
    promptId: 'social.post.generate.weibo',

    inputSchema: [
      {
        name: 'topic',
        label: '话题',
        type: 'string',
        required: true,
        placeholder: '输入话题关键词',
        defaultValue: '今日热点',
      },
      {
        name: 'postType',
        label: '博文类型',
        type: 'select',
        required: true,
        defaultValue: 'text',
        options: [
          { value: 'text', label: '📝 纯文字/图文' },
          { value: 'gallery', label: '🖼️ 图集帖' },
          { value: 'poll', label: '📊 投票帖' },
          { value: 'video', label: '🎬 视频帖' },
        ],
      },
      {
        name: 'authorIdentity',
        label: '作者身份',
        type: 'select',
        required: false,
        defaultValue: '普通网友',
        options: [
          { value: '普通网友', label: '普通网友' },
          { value: '娱乐博主', label: '娱乐博主' },
          { value: '科技达人', label: '科技达人' },
          { value: '美食博主', label: '美食博主' },
          { value: '情感博主', label: '情感博主' },
          { value: '营销号', label: '营销号' },
        ],
      },
      {
        name: 'platformCulture',
        label: '语气风格',
        type: 'select',
        required: false,
        defaultValue: '吃瓜围观',
        options: [
          { value: '吃瓜围观', label: '吃瓜围观' },
          { value: '深度八卦', label: '深度八卦' },
          { value: '正经讨论', label: '正经讨论' },
          { value: '玩梗调侃', label: '玩梗调侃' },
          { value: '标题党', label: '标题党' },
        ],
      },
    ],

    defaultInput: {
      topic: '今日热点',
      postType: 'text',
      authorIdentity: '普通网友',
      platformCulture: '吃瓜围观',
    },

    config: {
      source: 'custom',
      temperature: 0.9,
      maxTokens: 500,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:post-handler',
    contextProviders: ['system:time', 'weibo:narrative', 'weibo:existing-content'],

    showByDefault: true,
    tags: ['content', 'post', 'generate'],
  },

  // ========== 核心任务：更新热榜 ==========
  {
    id: 'weibo:update-trending',
    appId: WEIBO_APP_ID,
    name: '📊 更新热榜',
    description: '根据故事情节生成相关的微博热搜话题',
    icon: 'fa-fire-alt',
    category: 'trending',

    type: 'manual',
    executionMode: 'auto',
    autoConfig: {
      enabled: false,
      intervalMinutes: 30,
      maxExecutions: 0,
      executionCount: 0,
    },

    promptTemplate: `请根据以下故事情节，生成 {{count}} 个与情节相关的微博热搜话题。

<当前故事情节>
{{narrative}}
</当前故事情节>

当前时间背景：{{timeContext}}
话题类型偏好：{{category}}

{{#if existingHotSearches}}
<当前已有热搜（请避免重复）>
{{existingHotSearches}}
</当前已有热搜>
{{/if}}

要求：
1. 热搜话题要与故事情节中的人物、事件、情感相关联
2. 每个话题使用 #话题# 格式
3. 话题要有话题性和讨论度
4. 包含热度值（1-100）和分类
5. 模拟真实微博热搜的风格，但内容要呼应故事
6. 【重要】不要生成与已有热搜相同或相似的话题

请以 JSON 数组格式返回：
[
  {
    "keyword": "#话题内容#",
    "heat": 95,
    "category": "娱乐",
    "summary": "话题简介",
    "isNew": true,
    "isHot": false,
    "isExplosive": false
  }
]`,

    systemPrompt: `你是微博热搜运营专家，擅长根据故事情节创造相关的热门话题。
请生成与故事人物、事件、情感相关的热搜话题，让微博世界与故事世界产生联动。
话题应该像是故事世界中的网友在讨论故事中发生的事情。
生成时请注意避免与已有热搜重复。
请输出纯 JSON 数组，不要包含 markdown 代码块。`,

    inputSchema: [
      {
        name: 'count',
        label: '生成数量',
        type: 'number',
        required: false,
        defaultValue: 5,
      },
      {
        name: 'timeContext',
        label: '时间背景',
        type: 'string',
        required: false,
        placeholder: '如：周末下午、工作日早晨',
        defaultValue: '当前时间',
      },
      {
        name: 'category',
        label: '话题类型',
        type: 'select',
        required: false,
        defaultValue: '综合',
        options: [
          { value: '综合', label: '综合热搜' },
          { value: '娱乐', label: '娱乐明星' },
          { value: '社会', label: '社会民生' },
          { value: '体育', label: '体育赛事' },
          { value: '科技', label: '科技数码' },
          { value: '游戏', label: '游戏动漫' },
        ],
      },
    ],

    defaultInput: {
      count: 5,
      timeContext: '当前时间',
      category: '综合',
      narrative: '',
    },

    config: {
      source: 'custom',
      temperature: 0.85,
      maxTokens: 1000,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:hot-list-handler',
    contextProviders: ['system:time', 'weibo:narrative', 'weibo:existing-content'],

    showByDefault: true,
    tags: ['trending', 'hot-search', 'generate'],
  },

  // ========== 生成评论 ==========
  {
    id: 'weibo:generate-comments',
    appId: WEIBO_APP_ID,
    name: '💬 生成评论',
    description: '为微博内容生成多条风格各异的评论',
    icon: 'fa-comments',
    category: 'content',

    type: 'prompt',
    executionMode: 'repeatable',
    promptId: 'social.comment.batch.weibo',

    inputSchema: [
      {
        name: 'postContent',
        label: '微博内容',
        type: 'textarea',
        required: true,
        placeholder: '输入要评论的微博内容',
      },
      {
        name: 'count',
        label: '评论数量',
        type: 'number',
        required: false,
        defaultValue: 5,
      },
    ],

    defaultInput: {
      postContent: '',
      count: 5,
    },

    config: {
      source: 'custom',
      temperature: 1.0,
      maxTokens: 800,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:comments-handler',
    contextProviders: ['system:time'],

    showByDefault: true,
    tags: ['content', 'comments', 'generate'],
  },

  // ========== 批量生成博文 ==========
  {
    id: 'weibo:batch-posts',
    appId: WEIBO_APP_ID,
    name: '📝 批量生成博文',
    description: '一次性生成多条微博（支持文字/图集/投票/视频混合类型）',
    icon: 'fa-layer-group',
    category: 'content',

    type: 'manual',
    executionMode: 'repeatable',

    promptTemplate: `请生成 {{count}} 条微博内容，围绕话题：{{topic}}
博文类型偏好：{{postTypes}}

{{#if existingPosts}}
<已存在的博文（请避免重复相似内容）>
{{existingPosts}}
</已存在的博文>
{{/if}}

{{#if existingHotSearches}}
<当前热搜榜（可以结合热搜话题创作）>
{{existingHotSearches}}
</当前热搜榜>
{{/if}}

要求：
1. 每条微博风格不同，模拟不同用户
2. 包含话题标签 #话题#
3. 使用 emoji 和网络用语
4. 【重要】每条微博的内容、观点、角度都必须与已存在的博文不同
5. 生成的多条微博之间也要有明显差异
6. 根据博文类型偏好，合理分配不同类型的博文

请以 JSON 数组格式返回，使用 UniversalPost 格式。`,

    systemPrompt:
      '你是微博内容生成器，需要模拟多个不同风格的用户发帖。使用 primaryType + payload + media 格式输出。请输出纯 JSON 数组，不要包含 markdown 代码块。',

    inputSchema: [
      {
        name: 'topic',
        label: '话题',
        type: 'string',
        required: true,
        placeholder: '输入话题关键词',
        defaultValue: '今日热点',
      },
      {
        name: 'count',
        label: '生成数量',
        type: 'number',
        required: false,
        defaultValue: 3,
      },
      {
        name: 'postTypes',
        label: '博文类型',
        type: 'select',
        required: false,
        defaultValue: '混合（文字为主）',
        options: [
          { value: '混合（文字为主）', label: '🎲 混合（文字为主）' },
          { value: '纯文字/图文', label: '📝 纯文字/图文' },
          { value: '包含图集', label: '🖼️ 包含图集帖' },
          { value: '包含投票', label: '📊 包含投票帖' },
          { value: '包含视频', label: '🎬 包含视频帖' },
          { value: '多样化混合', label: '🌈 多样化混合' },
        ],
      },
    ],

    defaultInput: {
      topic: '今日热点',
      count: 3,
      postTypes: '混合（文字为主）',
    },

    config: {
      source: 'custom',
      temperature: 0.95,
      maxTokens: 2500,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:batch-posts-handler',
    contextProviders: ['system:time', 'weibo:existing-content'],

    showByDefault: true,
    tags: ['content', 'batch', 'generate'],
  },

  // ========== 博文互动生成 ==========
  {
    id: 'weibo:generate-engagement',
    appId: WEIBO_APP_ID,
    name: '💬 生成博文互动',
    description: '为博文生成评论、点赞、转发等互动数据',
    icon: 'fa-comments',
    category: 'content',

    type: 'prompt',
    executionMode: 'repeatable',
    promptId: 'social.post.engagement.weibo',

    inputSchema: [
      {
        name: 'postId',
        label: '博文ID（可选）',
        type: 'string',
        required: false,
        placeholder: '输入博文ID或留空手动填写',
      },
      {
        name: 'postContent',
        label: '博文内容',
        type: 'textarea',
        required: false,
        placeholder: '留空则从博文ID自动获取',
      },
      {
        name: 'authorName',
        label: '博主昵称',
        type: 'string',
        required: false,
        placeholder: '留空则从博文ID自动获取',
      },
      {
        name: 'followerCount',
        label: '粉丝数',
        type: 'number',
        required: false,
        defaultValue: 100,
      },
      {
        name: 'minComments',
        label: '最少评论数',
        type: 'number',
        required: false,
        defaultValue: 10,
      },
    ],

    defaultInput: {
      postId: '',
      postContent: '',
      authorName: '',
      authorBio: '',
      followerCount: 100,
      accountType: '普通用户',
      minComments: 10,
    },

    config: {
      source: 'custom',
      temperature: 0.95,
      maxTokens: 2000,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:engagement-handler',
    contextProviders: ['system:time', 'weibo:narrative'],

    showByDefault: true,
    tags: ['content', 'engagement', 'comments'],
  },

  // ========== 生成用户资料 ==========
  {
    id: 'weibo:generate-user',
    appId: WEIBO_APP_ID,
    name: '👤 生成用户资料',
    description: '生成虚拟微博用户画像',
    icon: 'fa-user-circle',
    category: 'user',

    type: 'prompt',
    executionMode: 'repeatable',
    promptId: 'social.user.generate.weibo',

    inputSchema: [
      {
        name: 'context',
        label: '用户类型',
        type: 'select',
        required: false,
        defaultValue: '普通用户',
        options: [
          { value: '普通用户', label: '普通用户' },
          { value: '追星族', label: '追星族' },
          { value: '数码博主', label: '数码博主' },
          { value: '美妆博主', label: '美妆博主' },
          { value: '营销号', label: '营销号' },
          { value: '段子手', label: '段子手' },
        ],
      },
    ],

    defaultInput: {
      context: '普通用户',
    },

    config: {
      source: 'custom',
      temperature: 0.8,
      maxTokens: 400,
    },

    priority: RequestPriority.LOW,
    outputHandlerId: 'weibo:json-handler',

    showByDefault: false,
    tags: ['user', 'profile', 'generate'],
  },

  // ========== 完整热点生成 ==========
  {
    id: 'weibo:complete-hot-topic',
    appId: WEIBO_APP_ID,
    name: '🔥 完整热点生成',
    description: '一次性生成热搜话题 + 相关博文 + 评论区 + 转发',
    icon: 'fa-layer-group',
    category: 'content',

    type: 'manual',
    executionMode: 'repeatable',

    promptTemplate: `请生成一个完整的微博热点事件。

话题类型：{{eventType}}
时间背景：{{timeContext}}

请严格按以下 JSON 格式输出：
{
  "hotSearches": [...],
  "posts": [...],
  "comments": [...],
  "reposts": [...]
}

要求：
1. 生成 1-2 个热搜话题
2. 生成 {{postCount}} 条相关博文
3. 为每条博文生成 {{commentCount}} 条评论
4. 可选生成 1-2 条转发`,

    systemPrompt:
      '你是微博热点模拟器。请生成结构化的复合内容。输出纯 JSON，不要包含 markdown 代码块。',

    inputSchema: [
      {
        name: 'eventType',
        label: '事件类型',
        type: 'select',
        required: false,
        defaultValue: '随机',
        options: [
          { value: '随机', label: '🎲 随机' },
          { value: '娱乐', label: '🎬 娱乐明星' },
          { value: '社会', label: '📰 社会民生' },
          { value: '体育', label: '⚽ 体育赛事' },
          { value: '科技', label: '💻 科技数码' },
          { value: '游戏', label: '🎮 游戏动漫' },
        ],
      },
      {
        name: 'timeContext',
        label: '时间背景',
        type: 'string',
        required: false,
        placeholder: '如：周末下午、工作日早晨',
        defaultValue: '当前时间',
      },
      {
        name: 'postCount',
        label: '博文数量',
        type: 'number',
        required: false,
        defaultValue: 3,
      },
      {
        name: 'commentCount',
        label: '每条博文评论数',
        type: 'number',
        required: false,
        defaultValue: 5,
      },
    ],

    defaultInput: {
      eventType: '随机',
      timeContext: '当前时间',
      postCount: 3,
      commentCount: 5,
    },

    config: {
      source: 'custom',
      temperature: 0.9,
      maxTokens: 3000,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:composite-handler',
    contextProviders: ['system:time', 'weibo:narrative'],

    showByDefault: true,
    tags: ['content', 'composite', 'hot-topic'],
  },

  // ========== 热点内容流水线（提示词链） ==========
  {
    id: 'weibo:hot-topic-pipeline',
    appId: WEIBO_APP_ID,
    name: '🔗 热点内容流水线',
    description: '执行完整的热点内容生成流程（使用提示词链）',
    icon: 'fa-project-diagram',
    category: 'content',

    type: 'chain',
    executionMode: 'repeatable',
    chainId: 'chain.weibo.微博热点内容生成.0',

    inputSchema: [
      {
        name: 'timeContext',
        label: '时间背景',
        type: 'string',
        required: false,
        placeholder: '如：周末下午、工作日早晨',
        defaultValue: '当前时间',
      },
      {
        name: 'eventType',
        label: '事件类型',
        type: 'select',
        required: false,
        defaultValue: '随机',
        options: [
          { value: '随机', label: '随机' },
          { value: '娱乐', label: '娱乐明星' },
          { value: '社会', label: '社会民生' },
          { value: '体育', label: '体育赛事' },
          { value: '科技', label: '科技数码' },
        ],
      },
      {
        name: 'postCount',
        label: '博文数量',
        type: 'number',
        required: false,
        defaultValue: 3,
      },
      {
        name: 'commentCount',
        label: '评论数量',
        type: 'number',
        required: false,
        defaultValue: 5,
      },
    ],

    defaultInput: {
      timeContext: '当前时间',
      eventType: '随机',
      postCount: 3,
      commentCount: 5,
    },

    config: {
      source: 'custom',
      temperature: 0.9,
      maxTokens: 2000,
    },

    priority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:chain-result-handler',
    contextProviders: ['system:time', 'weibo:narrative'],

    showByDefault: false,
    tags: ['content', 'chain', 'pipeline'],
  },
];

// ==================== 任务模板（用于自定义创建） ====================

/**
 * 微博任务模板列表
 * 供用户基于模板创建自定义任务
 */
export const weiboTaskTemplates: LLMTaskTemplate[] = [
  {
    id: 'weibo:template-post-generate',
    appId: WEIBO_APP_ID,
    name: '生成微博正文',
    description: '根据话题或主题生成一条微博内容',
    icon: 'fa-pen-fancy',
    category: 'content',
    type: 'manual',
    executionMode: 'once',

    promptTemplate: `你是一个微博用户，请根据以下话题生成一条微博内容：

话题：{{topic}}

要求：
1. 内容简短有趣，适合社交媒体传播
2. 使用适当的 emoji 和 #话题标签#
3. 语气自然，符合普通用户发帖风格
4. 字数控制在 140 字以内

请直接输出微博内容，不要有任何解释。`,

    systemPrompt: '你是一个活跃的微博用户，擅长创作有趣、有话题性的微博内容。',

    inputSchema: [
      {
        name: 'topic',
        label: '话题',
        type: 'string',
        required: true,
        placeholder: '输入话题关键词',
      },
    ],

    defaultInput: { topic: '' },

    recommendedConfig: {
      source: 'custom',
      temperature: 0.9,
      maxTokens: 300,
    },

    recommendedPriority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:text-handler',
    tags: ['content', 'post', 'template'],
  },

  {
    id: 'weibo:template-hot-topic',
    appId: WEIBO_APP_ID,
    name: '生成热搜话题',
    description: '生成微博热搜话题及相关内容',
    icon: 'fa-fire',
    category: 'trending',
    type: 'manual',
    executionMode: 'once',

    promptTemplate: `请生成一个可能登上微博热搜的话题：

话题类型：{{type}}

请生成以下内容：
1. 热搜标题（使用 #话题# 格式）
2. 话题简介（30-50字）
3. 热度等级（1-100）
4. 可能的讨论方向

请以 JSON 格式输出，包含 title, summary, heat, directions 字段。`,

    systemPrompt: '你是微博热搜分析师，了解中国社交媒体的热点趋势。',

    inputSchema: [
      {
        name: 'type',
        label: '话题类型',
        type: 'select',
        required: false,
        defaultValue: '娱乐',
        options: [
          { value: '娱乐', label: '娱乐' },
          { value: '社会', label: '社会' },
          { value: '体育', label: '体育' },
          { value: '科技', label: '科技' },
        ],
      },
    ],

    defaultInput: { type: '娱乐' },

    recommendedConfig: {
      source: 'custom',
      temperature: 0.9,
      maxTokens: 600,
    },

    recommendedPriority: RequestPriority.NORMAL,
    outputHandlerId: 'weibo:json-handler',
    tags: ['trending', 'hot-search', 'template'],
  },
];

// ==================== 辅助函数 ====================

/**
 * 获取微博任务定义
 */
export function getWeiboTaskDefinition(taskId: string): LLMTaskDefinition | undefined {
  return weiboTaskDefinitions.find((d) => d.id === taskId);
}

/**
 * 获取所有微博任务定义
 */
export function getAllWeiboTaskDefinitions(): LLMTaskDefinition[] {
  return weiboTaskDefinitions;
}

/**
 * 获取默认显示的任务定义
 */
export function getDefaultWeiboTaskDefinitions(): LLMTaskDefinition[] {
  return weiboTaskDefinitions.filter((d) => d.showByDefault);
}

/**
 * 获取微博任务模板
 */
export function getWeiboTaskTemplate(templateId: string): LLMTaskTemplate | undefined {
  return weiboTaskTemplates.find((t) => t.id === templateId);
}

/**
 * 获取所有微博任务模板
 */
export function getAllWeiboTaskTemplates(): LLMTaskTemplate[] {
  return weiboTaskTemplates;
}

/**
 * 按分类获取微博任务模板
 */
export function getWeiboTaskTemplatesByCategory(
  category: LLMTaskTemplate['category']
): LLMTaskTemplate[] {
  return weiboTaskTemplates.filter((t) => t.category === category);
}
