import type { AppPromptDefinition } from '@/types/prompts'

export const socialEnginePrompts: AppPromptDefinition[] = [
  // 1. 世界事件生成
  {
    scene: 'social.event.generate',
    name: '生成世界事件',
    description: '根据当前时间生成突发新闻或社会热点事件',
    category: 'social',
    systemPrompt: `你是一个虚拟世界的"导演"，负责生成引人注目的突发新闻、科技突破、娱乐八卦或社会热点。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "keyword": "话题关键词(如 #某事发生#)",
  "summary": "事件简述(50字以内)",
  "baseScore": 60-100之间的整数(表示初始热度),
  "category": "tech/entertainment/society/daily"
}`,
    template: `当前世界时间：{{timeContext}}
请生成一个{{eventType}}类型的突发事件。
要求：
1. 事件应具有{{intensity}}的轰动性。
2. 关键词要符合社交媒体热搜风格（简短有力）。
3. 事件内容不要与现实世界完全挂钩，保持虚构感。`,
    availableVariables: [
      {
        name: 'timeContext',
        description: '当前世界时间字符串',
        type: 'string',
        required: true,
        example: '2024年6月1日 14:00',
      },
      {
        name: 'eventType',
        description: '事件类型（随机/科技/娱乐/社会）',
        type: 'string',
        required: false,
        defaultValue: '随机',
      },
      {
        name: 'intensity',
        description: '事件轰动程度（低/中/高/爆炸性）',
        type: 'string',
        required: false,
        defaultValue: '中',
      },
    ],
  },

  // 2. 博文生成 (通用)
  {
    scene: 'social.post.generate',
    name: '生成社交博文',
    description: '根据话题生成指定平台的博文内容',
    category: 'social',
    systemPrompt: `你是一个精通社交媒体运营的内容创作者。请根据指定的平台风格生成博文。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "content": "博文正文",
  "tags": ["tag1", "tag2"],
  "imagePrompt": "用于生成配图的英文提示词(可选)"
}`,
    template: `平台：{{platformName}}
平台文化：{{platformCulture}}
当前话题：{{topic}}
作者身份：{{authorIdentity}}

请生成一条符合上述要求的博文。
要求：
1. 语气口吻必须符合{{platformName}}的用户习惯。
2. {{platformName}}的典型特征：{{platformCulture}}。
3. 字数控制在{{length}}字以内。
4. 内容要有互动性，能引发讨论。`,
    availableVariables: [
      {
        name: 'platformName',
        description: '平台名称(微博/B站/知乎)',
        type: 'string',
        required: true,
        example: '微博',
      },
      {
        name: 'platformCulture',
        description: '平台文化描述',
        type: 'string',
        required: true,
        example: '吃瓜、短平快、使用emoji',
      },
      {
        name: 'topic',
        description: '关联话题',
        type: 'string',
        required: true,
      },
      {
        name: 'authorIdentity',
        description: '作者身份描述',
        type: 'string',
        required: false,
        defaultValue: '普通路人',
      },
      {
        name: 'length',
        description: '字数限制',
        type: 'number',
        required: false,
        defaultValue: 140,
      },
    ],
  },

  // 3. 评论生成 (批量)
  {
    scene: 'social.comment.batch',
    name: '批量生成评论',
    description: '为博文生成多条不同立场的评论',
    category: 'social',
    systemPrompt: `你是一个社交媒体评论生成器。请模拟真实网友的反应，生成多样化的评论。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
[
  {
    "content": "评论内容",
    "persona": "评论者人设简述(如：杠精/粉丝/路人)",
    "sentiment": "positive/neutral/negative"
  },
  ...
]`,
    template: `平台：{{platformName}}
博文内容：
"""
{{postContent}}
"""

请生成 {{count}} 条评论。
要求：
1. 混合不同的立场（支持、反对、调侃、无关）。
2. 模拟真实口语，包含网络流行语。
3. 针对{{platformName}}风格进行调整。`,
    availableVariables: [
      {
        name: 'platformName',
        description: '平台名称',
        type: 'string',
        required: true,
      },
      {
        name: 'postContent',
        description: '原文内容',
        type: 'string',
        required: true,
      },
      {
        name: 'count',
        description: '生成数量',
        type: 'number',
        required: false,
        defaultValue: 5,
      },
    ],
  },

  // 4. 用户画像生成
  {
    scene: 'social.user.generate',
    name: '生成虚拟用户',
    description: '生成一个社交媒体用户的详细画像',
    category: 'social',
    systemPrompt: `你是一个虚拟角色设计师。请生成一个生动立体的社交媒体用户画像。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "nickname": "昵称",
  "handle": "唯一ID(英文数字)",
  "bio": "个人简介",
  "tags": ["标签1", "标签2"]
}`,
    template: `请为{{platformName}}生成一个用户画像。
上下文线索：{{context}}
要求：
1. 昵称要符合平台风格。
2. 简介要体现性格特点。`,
    availableVariables: [
      {
        name: 'platformName',
        description: '平台名称',
        type: 'string',
        required: true,
      },
      {
        name: 'context',
        description: '生成上下文(如：在科技贴下评论的人)',
        type: 'string',
        required: false,
        defaultValue: '随机路人',
      },
    ],
  },
]
