import { PlatformConfig } from '../../types/social'
import { PromptService } from '../prompt/promptService'
import { socialEnginePrompts } from './prompts'

export class PlatformRegistry {
  private static instance: PlatformRegistry
  private platforms: Map<string, PlatformConfig> = new Map()

  private constructor() {
    this.registerBuiltinPlatforms()
    this.registerPrompts()
  }

  private registerPrompts() {
    try {
      PromptService.registerAppPrompts('social-engine', socialEnginePrompts)
    } catch (error) {
      console.warn('[SocialEngine] Failed to register prompts:', error)
    }
  }

  public static getInstance(): PlatformRegistry {
    if (!PlatformRegistry.instance) {
      PlatformRegistry.instance = new PlatformRegistry()
    }
    return PlatformRegistry.instance
  }

  public getPlatform(id: string): PlatformConfig | undefined {
    return this.platforms.get(id)
  }

  public getAllPlatforms(): PlatformConfig[] {
    return Array.from(this.platforms.values())
  }

  public registerPlatform(config: PlatformConfig): void {
    this.platforms.set(config.id, config)
  }

  private registerBuiltinPlatforms() {
    // 1. Weibo (微博)
    this.registerPlatform({
      id: 'weibo',
      name: '微博',
      content: {
        hasTitle: false,
        mediaType: 'text_image',
        maxLength: 140, // 传统限制，虽然后来放宽了，但作为模拟器保持短文本特征
      },
      aiSetting: {
        tone: 'Gossip, Emotional, Short sentences, Trendy slang',
        roles: ['Fan', 'Hater', 'Passerby', 'MarketingAccount'],
        slang: ['yyds', '绝绝子', '无语子', '笑死', '家人们'],
        promptTemplate: 'social.post.generate.weibo',
      },
      interaction: {
        actions: ['like', 'repost', 'favorite'],
        commentStructure: 'nested',
      },
      dmStrategy: {
        allowStranger: true,
        foldUnknown: true,
      },
    })

    // 2. Bilibili (B站)
    this.registerPlatform({
      id: 'bilibili',
      name: 'Bilibili',
      content: {
        hasTitle: true,
        mediaType: 'video',
        maxLength: 1000, // 简介字数
      },
      aiSetting: {
        tone: 'Meme-heavy, Otaku culture, Critical but humorous',
        roles: ['Otaku', 'TechGeek', 'Gamer', 'Uploader'],
        slang: ['下次一定', '三连', '硬币', '好耶', '生草', '寄'],
        promptTemplate: 'social.post.generate.bilibili',
      },
      interaction: {
        actions: ['like', 'dislike', 'coin', 'repost', 'favorite'],
        commentStructure: 'bullet', // 虽然评论区是 nested，但特色是弹幕，这里主要指 UI 展现侧重
      },
      dmStrategy: {
        allowStranger: false,
        foldUnknown: false,
      },
    })

    // 3. Zhihu (知乎)
    this.registerPlatform({
      id: 'zhihu',
      name: '知乎',
      content: {
        hasTitle: true, // 问题标题
        mediaType: 'qa',
        maxLength: 5000,
      },
      aiSetting: {
        tone: 'Professional, Rational, Pretensious, Storytelling',
        roles: ['Expert', 'Intellectual', 'Storyteller'],
        slang: ['谢邀', '人在美国', '刚下飞机', '利益相关', '以上'],
        promptTemplate: 'social.post.generate.zhihu',
      },
      interaction: {
        actions: ['like', 'dislike', 'favorite', 'repost'], // 赞同/反对
        commentStructure: 'flat', // 知乎评论区相对扁平
      },
      dmStrategy: {
        allowStranger: true,
        foldUnknown: true,
      },
    })

    // 4. RedBook (小红书)
    this.registerPlatform({
      id: 'redbook',
      name: '小红书',
      content: {
        hasTitle: true,
        mediaType: 'text_image',
        maxLength: 1000,
      },
      aiSetting: {
        tone: 'Life-sharing, Aesthetic, Emoji-heavy, Helpful',
        roles: ['Influencer', 'Shopper', 'Student'],
        slang: ['集美', '避雷', '种草', '天花板', '绝美'],
        promptTemplate: 'social.post.generate.redbook',
      },
      interaction: {
        actions: ['like', 'favorite', 'repost'],
        commentStructure: 'nested',
      },
      dmStrategy: {
        allowStranger: true,
        foldUnknown: false,
      },
    })
  }
}
