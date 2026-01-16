/**
 * 微博提示词链定义
 * @description 微博 App 专用的多步骤 LLM 编排链
 */

import type { AppChainDefinition } from '@/services/promptChainService';

/**
 * 微博热点内容生成流水线
 * 事件生成 → 话题提取 → 博文×N → 评论×N
 */
export const weiboHotTopicPipeline: AppChainDefinition = {
  name: '微博热点内容生成',
  description: '从世界事件生成完整的微博热点内容，包括话题、博文和评论',
  icon: '🔥',
  tags: ['weibo', 'hot-topic', 'content-generation'],
  executionMode: 'multi-step',
  version: '1.0.0',
  enabled: true,
  
  // 输入变量
  inputs: [
    {
      name: 'timeContext',
      description: '当前时间上下文（如：2024年1月1日 下午）',
      type: 'string',
      required: false,
      defaultValue: '当前时间',
    },
    {
      name: 'eventType',
      description: '事件类型（娱乐/社会/科技/体育等）',
      type: 'string',
      required: false,
      defaultValue: '随机',
    },
    {
      name: 'postCount',
      description: '生成博文数量',
      type: 'number',
      required: false,
      defaultValue: 3,
    },
    {
      name: 'commentCount',
      description: '每条博文的评论数量',
      type: 'number',
      required: false,
      defaultValue: 5,
    },
  ],
  
  // 执行步骤
  steps: [
    // Step 1: 生成世界事件
    {
      id: 'step-event',
      name: '生成世界事件',
      description: '基于时间和类型生成一个突发事件',
      type: 'prompt',
      promptId: 'social.event.generate',
      inputMapping: {
        timeContext: 'timeContext',
        eventType: 'eventType',
        intensity: '"high"',
      },
      outputKey: 'event',
      postProcess: {
        parseAs: 'json',
        defaultValue: { title: '未知事件', summary: '', category: 'other' },
      },
    },
    
    // Step 2: 生成微博话题标签
    {
      id: 'step-topic',
      name: '生成热搜话题',
      description: '将事件转化为微博热搜话题格式',
      type: 'prompt',
      promptId: 'social.topic.generate.weibo',
      inputMapping: {
        eventTitle: 'event.title',
        eventSummary: 'event.summary',
      },
      outputKey: 'topic',
      postProcess: {
        parseAs: 'json',
        extract: 'keyword',
        defaultValue: '#热门话题#',
      },
    },
    
    // Step 3: 批量生成博文
    {
      id: 'step-posts',
      name: '生成微博博文',
      description: '围绕话题生成多条微博',
      type: 'prompt',
      promptId: 'social.post.generate.weibo',
      inputMapping: {
        topic: 'topic',
        authorIdentity: 'item.identity',
        platformCulture: 'item.style',
      },
      outputKey: 'posts',
      postProcess: {
        parseAs: 'json',
      },
      loop: {
        type: 'over',
        over: '[{"identity": "普通网友", "style": "吃瓜围观"},{"identity": "娱乐博主", "style": "深度八卦"},{"identity": "营销号", "style": "标题党"}]',
        as: 'item',
        maxIterations: 5,
      },
    },
    
    // Step 4: 为第一条博文生成评论
    {
      id: 'step-comments',
      name: '生成评论区',
      description: '为博文生成评论',
      type: 'prompt',
      promptId: 'social.comment.batch.weibo',
      inputMapping: {
        postContent: 'posts[0].text',
        count: 'commentCount',
      },
      outputKey: 'comments',
      postProcess: {
        parseAs: 'json',
      },
      condition: 'posts[0]',
    },
  ],
  
  // 输出映射
  outputs: {
    event: 'event',
    topic: 'topic',
    posts: 'posts',
    comments: 'comments',
  },
};

/**
 * 评论区深度对话生成
 * 主评论 → 回复链 → 争议升级 → 官方回应
 */
export const weiboCommentThread: AppChainDefinition = {
  name: '评论区深度对话',
  description: '生成有争议的评论区对话线程，包含回复、争论和官方回应',
  icon: '💬',
  tags: ['weibo', 'comments', 'dialogue'],
  executionMode: 'multi-step',
  version: '1.0.0',
  enabled: true,
  
  inputs: [
    {
      name: 'postContent',
      description: '原博文内容',
      type: 'string',
      required: true,
    },
    {
      name: 'controversy',
      description: '争议点描述',
      type: 'string',
      required: false,
      defaultValue: '存在争议',
    },
    {
      name: 'hasOfficialResponse',
      description: '是否包含官方回应',
      type: 'boolean',
      required: false,
      defaultValue: true,
    },
  ],
  
  steps: [
    // Step 1: 生成主评论
    {
      id: 'step-main-comment',
      name: '生成主评论',
      description: '生成引发讨论的主评论',
      type: 'prompt',
      inlineTemplate: `针对以下微博内容，生成一条会引发讨论的评论。
博文内容：{{postContent}}
争议点：{{controversy}}

要求：
1. 评论要有明确立场
2. 语气要有挑衅性但不过激
3. 使用微博典型语气（emoji、缩写等）

请以 JSON 格式返回：
{"content": "评论内容", "stance": "支持/反对/质疑", "persona": "评论者人设"}`,
      inputMapping: {
        postContent: 'postContent',
        controversy: 'controversy',
      },
      outputKey: 'mainComment',
      postProcess: {
        parseAs: 'json',
      },
    },
    
    // Step 2: 生成回复链
    {
      id: 'step-replies',
      name: '生成回复链',
      description: '生成针对主评论的回复',
      type: 'prompt',
      inlineTemplate: `针对以下评论，生成3条不同立场的回复。
原评论：{{mainComment.content}}
评论立场：{{mainComment.stance}}

要求：
1. 包含支持、反对、中立各一条
2. 有楼中楼对话的感觉（可以@前面的人）
3. 逐渐升级争论强度

请以 JSON 数组格式返回：
[{"content": "回复内容", "stance": "立场", "replyTo": "回复对象昵称"}]`,
      inputMapping: {
        mainComment: 'mainComment',
      },
      outputKey: 'replies',
      postProcess: {
        parseAs: 'json',
      },
    },
    
    // Step 3: 官方回应（条件执行）
    {
      id: 'step-official',
      name: '官方回应',
      description: '生成官方/当事人回应',
      type: 'prompt',
      inlineTemplate: `针对以下争议评论区，生成一条官方/当事人的回应。
原博文：{{postContent}}
争议评论：{{mainComment.content}}

要求：
1. 语气正式但不失亲和
2. 可以是澄清、道歉或感谢
3. 带有认证标识的感觉

请以 JSON 格式返回：
{"content": "回应内容", "type": "澄清/道歉/感谢", "account": "官方账号名"}`,
      inputMapping: {
        postContent: 'postContent',
        mainComment: 'mainComment',
      },
      outputKey: 'officialResponse',
      postProcess: {
        parseAs: 'json',
      },
      condition: 'hasOfficialResponse',
    },
  ],
  
  outputs: {
    mainComment: 'mainComment',
    replies: 'replies',
    officialResponse: 'officialResponse',
  },
};

/**
 * 用户画像批量生成
 * 生成多个风格各异的微博用户
 */
export const weiboUserGenerator: AppChainDefinition = {
  name: '批量生成用户画像',
  description: '生成多个风格各异的微博用户画像',
  icon: '👥',
  tags: ['weibo', 'user', 'persona'],
  executionMode: 'multi-step',
  version: '1.0.0',
  enabled: true,
  
  inputs: [
    {
      name: 'count',
      description: '生成用户数量',
      type: 'number',
      required: false,
      defaultValue: 5,
    },
    {
      name: 'theme',
      description: '用户群体主题（如：追星族、数码博主等）',
      type: 'string',
      required: false,
      defaultValue: '混合',
    },
  ],
  
  steps: [
    {
      id: 'step-users',
      name: '生成用户列表',
      description: '批量生成用户画像',
      type: 'prompt',
      promptId: 'social.user.generate.weibo',
      inputMapping: {
        context: 'theme',
      },
      outputKey: 'users',
      postProcess: {
        parseAs: 'json',
      },
      loop: {
        type: 'times',
        times: 5, // 默认值，会被 count 覆盖
        as: 'index',
        maxIterations: 20,
      },
    },
  ],
  
  outputs: {
    users: 'users',
  },
};

/**
 * 导出所有微博链
 */
export const weiboChains: AppChainDefinition[] = [
  weiboHotTopicPipeline,
  weiboCommentThread,
  weiboUserGenerator,
];
