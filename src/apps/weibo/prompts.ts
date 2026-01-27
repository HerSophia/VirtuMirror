import { NARRATIVE_VARIABLE_DEFINITIONS } from '@/services/narrative/narrativeService'
import type { AppPromptDefinition } from '@/types/prompts'

export const weiboPrompts: AppPromptDefinition[] = [
  // 0. 叙事内容分析 (用于订阅酒馆内容)
  {
    scene: 'social.weibo.analyze.narrative',
    name: '分析叙事内容（微博）',
    description: '分析来自所给的叙事内容，判断是否需要生成微博相关内容',
    category: 'social',
    systemPrompt: `你是一个叙事内容分析器，专门分析角色扮演故事中的社交媒体相关内容。
你需要从叙事文本中识别是否有人发布了微博、更新了动态、或者有值得发微博的事件发生。

请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "shouldPost": true/false,
  "reason": "判断理由",
  "extractedContent": {
    "text": "提取的微博正文（如果有）",
    "author": "发帖人名称",
    "images": ["图片描述"],
    "topic": "相关话题"
  } | null
}`,
    template: `请分析以下叙事内容，判断是否有与微博相关的内容需要处理：

<叙事内容>
{{narrative}}
</叙事内容>

分析要求：
1. 识别叙事中是否明确提到发微博、发帖、更新动态、刷微博等行为
2. 如果提到了具体的微博内容，提取出来
3. 如果叙事中有重要事件但没有明确提到发微博，也可以标记为需要生成（shouldPost: true）
4. 注意区分角色的行为和旁白描述

请以 JSON 格式返回分析结果。`,
    availableVariables: [...NARRATIVE_VARIABLE_DEFINITIONS],
  },

  // 1. 博文生成 (微博专用，支持多种类型)
  // Phase 4 重构：输出格式符合 UniversalPost 新架构
  {
    scene: 'social.post.generate.weibo',
    name: '生成微博博文',
    description: '生成微博风格的博文（支持文字/图集/投票/视频等类型）',
    category: 'social',
    systemPrompt: `你是一个微博资深用户，擅长用简洁、情绪化的语言发布内容。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。

根据 postType 字段输出不同格式：

【文字帖 (text) - 少于4张图】
{
  "primaryType": "text",
  "payload": {
    "text": "博文正文(含emoji和话题)"
  },
  "media": [
    {
      "id": "img_0",
      "type": "image",
      "description": "图片描述",
      "order": 0
    }
  ],
  "authorName": "作者昵称"
}

【图集帖 (gallery) - 4张图及以上】
{
  "primaryType": "gallery",
  "payload": {
    "text": "博文正文(含emoji和话题)"
  },
  "media": [
    {"id": "img_0", "type": "image", "description": "图片1描述", "order": 0},
    {"id": "img_1", "type": "image", "description": "图片2描述", "order": 1},
    {"id": "img_2", "type": "image", "description": "图片3描述", "order": 2},
    {"id": "img_3", "type": "image", "description": "图片4描述", "order": 3}
  ],
  "authorName": "作者昵称"
}

【投票帖 (poll)】
{
  "primaryType": "poll",
  "payload": {
    "text": "投票引导文案",
    "poll": {
      "question": "投票问题",
      "options": [
        {"id": "opt_0", "text": "选项1", "votes": 0},
        {"id": "opt_1", "text": "选项2", "votes": 0}
      ],
      "duration": 24,
      "multiSelect": false
    }
  },
  "authorName": "作者昵称"
}

【视频帖 (video)】
{
  "primaryType": "video",
  "payload": {
    "text": "视频介绍文案"
  },
  "media": [
    {
      "id": "video_0",
      "type": "video",
      "description": "视频内容描述",
      "coverDescription": "封面画面描述",
      "duration": 60
    }
  ],
  "authorName": "作者昵称"
}

注意：系统同时支持新格式(primaryType+payload+media)和旧格式(type+text+images)，但推荐使用新格式。`,
    template: `当前话题：{{topic}}
博文类型：{{postType}}
作者身份：{{authorIdentity}}
语气风格：{{platformCulture}}

请根据博文类型生成相应的微博内容。

【通用要求】
1. 必须包含话题标签，格式为 #话题#
2. 使用 Emoji 表情，表达情绪
3. 语言风格要口语化，符合微博用户习惯
4. 如果是营销号，可以使用【】夸张标题

【文字/图文帖要求】
- 正文控制在 140 字以内
- 可以添加 1-9 张图片描述（描述要具体生动）
- 图片描述应该与话题和正文相关

【投票帖要求】
- 投票问题要有话题性，能引发讨论
- 选项 2-4 个，每个选项简短有力
- 引导文案鼓励用户参与讨论
- duration 为投票时长（小时），可选 1/6/12/24/72

【视频帖要求】
- 视频描述要详细，说明内容和亮点
- 封面描述选择最吸引眼球的画面
- 介绍文案要有悬念，吸引点击
- duration 为视频时长（秒）`,
    availableVariables: [
      {
        name: 'topic',
        description: '关联话题',
        type: 'string',
        required: true,
      },
      {
        name: 'postType',
        description: '博文类型：text(文字/图文), poll(投票), video(视频)',
        type: 'string',
        required: true,
        defaultValue: 'text',
      },
      {
        name: 'authorIdentity',
        description: '作者身份描述',
        type: 'string',
        required: false,
        defaultValue: '路人',
      },
      {
        name: 'platformCulture',
        description: '语气风格',
        type: 'string',
        required: false,
        defaultValue: '吃瓜',
      },
    ],
  },

  // 2. 评论生成 (微博专用)
  {
    scene: 'social.comment.batch.weibo',
    name: '生成微博评论',
    description: '生成微博风格的评论 (饭圈/吃瓜/情绪化)',
    category: 'social',
    systemPrompt: `你是一个微博评论区模拟器。请模拟真实微博用户的反应，生成多样化的评论。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
[
  {
    "content": "评论内容",
    "persona": "评论者人设简述",
    "sentiment": "positive/neutral/negative"
  }
]`,
    template: `博文内容：
"""
{{postContent}}
"""

请生成 {{count}} 条微博评论。
要求：
1. 风格特点：极短、情绪化、使用缩写 (yyds, nsdd, xswl)、大量 Emoji。
2. 角色类型：
   - 粉丝：疯狂控评，"抱走我家哥哥/姐姐"，"期待"，"好美"。
   - 杠精：无脑反驳，"就我一个人觉得...吗？"，"只有我..."。
   - 路人：吃瓜，"前排"，"？"，"哈哈哈"。
   - 营销号：带图评论，"点我看后续"。
3. 包含一些回复别人的楼中楼感觉（虽然是第一层，但可以带 @xxx）。`,
    availableVariables: [
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

  // 3. 用户画像生成 (微博专用)
  {
    scene: 'social.user.generate.weibo',
    name: '生成微博用户画像',
    description: '生成微博特有的用户画像 (认证/星座/追星)',
    category: 'social',
    systemPrompt: `你是一个微博用户画像生成器。
请输出纯 JSON 格式。
格式要求：
{
  "nickname": "昵称",
  "handle": "唯一ID",
  "bio": "简介",
  "tags": ["tag1"]
}`,
    template: `请生成一个微博用户画像。
线索：{{context}}
要求：
1. 昵称风格：可以使用英文+中文，或者带表情符号，或者很长。例如 "Momo的小号", "用户738291", "全智鲜", "XX在减肥"。
2. 简介风格：通常包含星座、坐标、追星对象（如 "主推XX"）、或者一些伤感文学/鸡汤。
3. 如果是营销号，简介要有商务联系方式。`,
    availableVariables: [
      {
        name: 'context',
        description: '生成上下文',
        type: 'string',
        required: false,
        defaultValue: '随机路人',
      },
    ],
  },

  // 4. 话题优化 (微博专用)
  {
    scene: 'social.topic.generate.weibo',
    name: '生成微博热搜话题',
    description: '将普通事件标题转化为微博热搜标签',
    category: 'social',
    systemPrompt: `你是一个微博热搜运营。
请输出纯 JSON 格式。
格式：
{
  "keyword": "#话题#"
}`,
    template: `原始事件：{{eventTitle}}
事件描述：{{eventSummary}}

请将其转化为一个具有爆款潜质的微博热搜话题。
要求：
1. 必须使用 #双井号# 包裹。
2. 简短有力，通常不超过15个字。
3. 可以使用主谓结构，或者制造悬念。
4. 符合微博热搜的八卦/社会新闻风格。`,
    availableVariables: [
      {
        name: 'eventTitle',
        description: '事件标题',
        type: 'string',
        required: true,
      },
      {
        name: 'eventSummary',
        description: '事件描述',
        type: 'string',
        required: true,
      },
    ],
  },

  // 5. 博文内容扩展 (用户发帖时 AI 润色)
  {
    scene: 'social.post.expand.weibo',
    name: '扩展微博内容',
    description: '将用户的简短内容扩展为更生动的微博风格文案',
    category: 'social',
    systemPrompt: `你是一个微博文案专家，擅长将简短的想法扩展为有感染力的微博内容。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "text": "扩展后的博文正文(含emoji和话题标签)",
  "suggestedTopics": ["建议的话题标签"],
  "tone": "文案语气描述"
}`,
    template: `用户原始内容：{{userContent}}
用户身份：{{authorIdentity}}
期望语气：{{desiredTone}}

请将用户的内容扩展为一条精彩的微博。
要求：
1. 保留用户的核心意思，但让表达更加生动有趣。
2. 适当添加 Emoji 表情，但不要过度。
3. 如果内容适合加话题标签，可以建议1-2个热门相关话题。
4. 控制在 140 字以内。
5. 语气要符合用户身份，自然不做作。`,
    availableVariables: [
      {
        name: 'userContent',
        description: '用户原始内容',
        type: 'string',
        required: true,
      },
      {
        name: 'authorIdentity',
        description: '用户身份',
        type: 'string',
        required: false,
        defaultValue: '普通用户',
      },
      {
        name: 'desiredTone',
        description: '期望语气',
        type: 'string',
        required: false,
        defaultValue: '轻松随意',
      },
    ],
  },

  // 6. 图片描述扩展
  {
    scene: 'social.image.expand.weibo',
    name: '扩展图片描述',
    description: '将用户的简短图片描述扩展为详细的视觉描述',
    category: 'social',
    systemPrompt: `你是一个图片描述专家，擅长将简短的描述扩展为生动的视觉画面。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "expandedDescription": "扩展后的详细描述",
  "visualElements": ["主要视觉元素"],
  "mood": "画面氛围"
}`,
    template: `用户描述的图片：{{imageDescription}}
图片用途：{{purpose}}

请将这个简短描述扩展为一个详细的视觉描述。
要求：
1. 描述应该能让人脑海中形成清晰的画面。
2. 包含画面的主体、背景、光线、氛围等细节。
3. 控制在 50-100 字之间。
4. 使用客观描述性语言。`,
    availableVariables: [
      {
        name: 'imageDescription',
        description: '用户的图片描述',
        type: 'string',
        required: true,
      },
      {
        name: 'purpose',
        description: '图片用途',
        type: 'string',
        required: false,
        defaultValue: '微博配图',
      },
    ],
  },

  // 7. 视频描述扩展
  {
    scene: 'social.video.expand.weibo',
    name: '扩展视频描述',
    description: '将用户的视频概述扩展为详细的内容描述',
    category: 'social',
    systemPrompt: `你是一个视频内容描述专家。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "expandedDescription": "扩展后的视频内容描述",
  "coverDescription": "建议的封面画面描述",
  "highlights": ["视频亮点"],
  "suggestedDuration": "建议时长（秒）"
}`,
    template: `用户描述的视频内容：{{videoDescription}}
视频类型：{{videoType}}

请将这个视频概述扩展为详细的内容描述。
要求：
1. 描述视频的主要内容和流程。
2. 指出可能的精彩片段或亮点。
3. 建议一个合适的封面画面。
4. 估算合理的视频时长。`,
    availableVariables: [
      {
        name: 'videoDescription',
        description: '用户的视频描述',
        type: 'string',
        required: true,
      },
      {
        name: 'videoType',
        description: '视频类型',
        type: 'string',
        required: false,
        defaultValue: 'vlog',
      },
    ],
  },

  // 8. 博文互动生成（发布后自动生成评论、点赞、转发）
  {
    scene: 'social.post.engagement.weibo',
    name: '生成博文互动数据',
    description: '根据博文内容、叙事背景和博主信息，生成评论、点赞数和转发数',
    category: 'social',
    systemPrompt: `你是一个微博互动数据模拟器，需要根据博文内容和上下文生成真实的互动数据。

请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "stats": {
    "likes": 数字,
    "shares": 数字,
    "views": 数字
  },
  "comments": [
    {
      "content": "评论内容",
      "nickname": "评论者昵称",
      "persona": "评论者人设",
      "likes": 评论点赞数,
      "sentiment": "positive/neutral/negative"
    }
  ]
}`,
    template: `<博主信息>
昵称：{{authorName}}
简介：{{authorBio}}
粉丝数：{{followerCount}}
账号类型：{{accountType}}
</博主信息>

<博文内容>
{{postContent}}
</博文内容>

{{#if narrative}}
<当前叙事背景>
{{narrative}}
</当前叙事背景>
{{/if}}

请为这条博文生成互动数据。

要求：
1. 根据博主粉丝数和内容质量估算合理的互动数据：
   - 普通用户（粉丝<1000）：点赞 0-50，转发 0-10
   - 小V（粉丝1000-10000）：点赞 10-200，转发 5-50
   - 大V（粉丝>10000）：点赞 100-2000，转发 50-500
   - 一般大V（粉丝>100000）：点赞 5000-40000，转发 500-3000
   - 超级大V（粉丝>1000000）：点赞 100000+，转发 20000+
   - 热门内容可以翻倍

2. 生成至少 {{minComments}} 条评论，评论风格要求：
   - 极短、情绪化、使用网络用语
   - 包含不同类型的评论者（粉丝、路人、杠精等）
   - 大量使用 Emoji
   - 部分评论可以 @其他用户或回复楼上

3. 如果博文内容与叙事背景相关，评论可以体现对故事情节的反应

4. 评论者昵称要多样化，体现微博用户的特点`,
    availableVariables: [
      {
        name: 'authorName',
        description: '博主昵称',
        type: 'string',
        required: true,
      },
      {
        name: 'authorBio',
        description: '博主简介',
        type: 'string',
        required: false,
        defaultValue: '',
      },
      {
        name: 'followerCount',
        description: '粉丝数',
        type: 'number',
        required: false,
        defaultValue: 100,
      },
      {
        name: 'accountType',
        description: '账号类型',
        type: 'string',
        required: false,
        defaultValue: '普通用户',
      },
      {
        name: 'postContent',
        description: '博文内容',
        type: 'string',
        required: true,
      },
      {
        name: 'narrative',
        description: '叙事背景',
        type: 'string',
        required: false,
      },
      {
        name: 'minComments',
        description: '最少评论数',
        type: 'number',
        required: false,
        defaultValue: 10,
      },
    ],
  },

  // 9. 投票选项优化
  {
    scene: 'social.poll.optimize.weibo',
    name: '优化投票选项',
    description: '将用户的投票问题和选项优化为更有吸引力的形式',
    category: 'social',
    systemPrompt: `你是一个微博投票运营专家，擅长设计有趣且能引发讨论的投票。
请输出纯 JSON 格式，不要包含 Markdown 代码块标记。
格式要求：
{
  "question": "优化后的投票问题",
  "options": ["选项1", "选项2", ...],
  "hook": "引导评论的钩子文案"
}`,
    template: `用户的投票问题：{{question}}
用户提供的选项：{{options}}

请优化这个投票，让它更有吸引力。
要求：
1. 问题要简洁有力，能引发好奇心。
2. 选项要互斥且有趣，每个选项都能代表一种鲜明立场。
3. 可以适当使用 Emoji。
4. 生成一个能引导用户评论讨论的钩子文案。`,
    availableVariables: [
      {
        name: 'question',
        description: '投票问题',
        type: 'string',
        required: true,
      },
      {
        name: 'options',
        description: '投票选项（逗号分隔）',
        type: 'string',
        required: true,
      },
    ],
  },
]
