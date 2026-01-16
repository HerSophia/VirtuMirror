/**
 * 用户生成器 (User Pool)
 * 
 * 纯粹的"用户生成器"，只负责生成随机的用户属性
 * 不负责存储（存储由 AccountService 负责）
 * 
 * @see docs/systems/account-service.md
 */

import type {
  GeneratedProfile,
  GenerationContext,
  Gender,
  CharacterProfile,
  AgeRange,
  ActivityLevel,
  InfluenceLevel,
  PersonalityType,
  InterestDomain,
  ContentStyle,
  BehaviorTendencies,
} from '@/types/account'

// 预置的随机名称库
const FIRST_NAMES = {
  male: [
    '伟', '强', '磊', '明', '杰', '军', '勇', '涛', '斌', '浩',
    '鹏', '宇', '轩', '晨', '阳', '翔', '俊', '博', '辉', '超',
  ],
  female: [
    '芳', '娜', '敏', '静', '丽', '婷', '艳', '慧', '莉', '颖',
    '雪', '梦', '雨', '欣', '怡', '琳', '佳', '倩', '玲', '晓',
  ],
  neutral: [
    '晓', '子', '思', '雨', '可', '佳', '文', '嘉', '天', '心',
  ],
}

const LAST_NAMES = [
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高',
  '梁', '郑', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹',
]

// 预置的头像（可以是默认头像或占位符）
const DEFAULT_AVATARS = [
  'avatar://default-1',
  'avatar://default-2',
  'avatar://default-3',
  'avatar://default-4',
  'avatar://default-5',
]

// 预置的签名/简介模板
const BIO_TEMPLATES = {
  general: [
    '这个人很懒，什么都没写。',
    '快乐每一天！',
    '生活不止眼前的苟且',
    '努力成为更好的自己',
    '爱生活，爱自己',
    '保持热爱，奔赴山海',
    '愿你历尽千帆，归来仍是少年',
    '日拱一卒，功不唐捐',
  ],
  tech: [
    '代码改变世界',
    '全栈开发者 | 开源爱好者',
    '科技让生活更美好',
    'AI时代的探索者',
    '永远保持对技术的热情',
  ],
  entertainment: [
    '追星女孩/男孩',
    '二次元爱好者',
    '电影发烧友',
    '音乐是我的灵魂',
    '游戏人生',
  ],
  life: [
    '美食探店达人',
    '旅行中...',
    '摄影爱好者',
    '健身打卡中',
    '猫奴/狗奴',
  ],
}

// 平台特定的 handle 前缀/后缀
const HANDLE_PATTERNS = {
  weibo: {
    prefixes: ['', 'official_', 'real_', 'i_am_', 'just_'],
    suffixes: ['', '_v', '_official', '_2024', '_here'],
  },
  bilibili: {
    prefixes: ['', 'up_', 'bili_', ''],
    suffixes: ['', '_official', '_channel', '_vlog'],
  },
  chat: {
    prefixes: [''],
    suffixes: [''],
  },
}

// 职业列表
const OCCUPATIONS: Record<string, string[]> = {
  tech: ['程序员', '产品经理', '设计师', 'AI工程师', '运维工程师', '测试工程师', '前端开发', '后端开发', '全栈工程师'],
  business: ['销售', '市场营销', '人力资源', '财务', '运营', '商务拓展', '项目经理'],
  creative: ['作家', '画师', '摄影师', '视频创作者', '音乐人', '编剧', '导演', '主播'],
  service: ['医生', '护士', '老师', '律师', '公务员', '警察', '消防员'],
  student: ['大学生', '研究生', '高中生', '留学生', '博士生'],
  other: ['自由职业', '创业者', '全职妈妈', '退休人员', '无业', '待业'],
}

// 地点列表
const LOCATIONS = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安',
  '南京', '重庆', '天津', '苏州', '长沙', '郑州', '青岛', '厦门',
  '大连', '宁波', '东莞', '佛山', '合肥', '福州', '昆明', '海外',
]

// 标语模板
const TAGLINE_TEMPLATES: Record<string, string[]> = {
  tech: [
    '代码改变世界的{{occupation}}',
    '热爱开源的{{occupation}}一枚',
    '{{location}}互联网人',
    'Bug终结者',
    '0和1的世界探索者',
  ],
  life: [
    '热爱生活的{{location}}人',
    '美食探店中...',
    '旅行是最好的投资',
    '认真生活的普通人',
    '日常分享达人',
  ],
  entertainment: [
    '追星女孩的日常',
    '二次元浓度超标',
    '游戏宅的快乐生活',
    '资深影迷',
    '音乐是我的灵魂',
  ],
  work: [
    '努力搬砖的{{occupation}}',
    '{{location}}打工人',
    '职场小白进化中',
    '朝九晚五的日常',
  ],
  creative: [
    '用镜头记录生活',
    '文字是我的武器',
    '创意无限',
    '艺术源于生活',
  ],
}

/**
 * 用户生成器类
 */
export class UserPool {
  private static instance: UserPool

  private constructor() {}

  static getInstance(): UserPool {
    if (!UserPool.instance) {
      UserPool.instance = new UserPool()
    }
    return UserPool.instance
  }

  /**
   * 生成随机用户档案
   */
  generateRandomProfile(context?: GenerationContext): GeneratedProfile {
    const gender = this.randomGender()
    const displayName = this.randomName(gender)
    const avatar = this.randomAvatar()
    const bio = this.randomBio(context)
    const handle = context?.platform ? this.generateHandle(displayName, context.platform) : undefined

    return {
      displayName,
      nickname: displayName, // 默认昵称与显示名相同
      avatar,
      bio,
      handle,
      gender,
    }
  }

  /**
   * 生成随机名称
   */
  randomName(gender?: Gender): string {
    const lastName = this.pickRandom(LAST_NAMES)
    
    let firstNamePool: string[]
    if (gender === 'male') {
      firstNamePool = FIRST_NAMES.male
    } else if (gender === 'female') {
      firstNamePool = FIRST_NAMES.female
    } else {
      firstNamePool = [...FIRST_NAMES.male, ...FIRST_NAMES.female, ...FIRST_NAMES.neutral]
    }
    
    const firstName = this.pickRandom(firstNamePool)
    
    // 随机决定名字长度（1-2个字）
    if (Math.random() > 0.5) {
      const secondChar = this.pickRandom(firstNamePool)
      return lastName + firstName + secondChar
    }
    
    return lastName + firstName
  }

  /**
   * 生成随机性别
   */
  randomGender(): Gender {
    const rand = Math.random()
    if (rand < 0.45) return 'male'
    if (rand < 0.9) return 'female'
    if (rand < 0.95) return 'other'
    return 'unknown'
  }

  /**
   * 生成随机头像
   */
  randomAvatar(): string {
    return this.pickRandom(DEFAULT_AVATARS)
  }

  /**
   * 生成随机简介
   */
  randomBio(context?: GenerationContext): string {
    let templates: string[]
    
    if (context?.topic) {
      const topic = context.topic.toLowerCase()
      if (topic.includes('tech') || topic.includes('科技') || topic.includes('编程')) {
        templates = BIO_TEMPLATES.tech
      } else if (topic.includes('娱乐') || topic.includes('明星') || topic.includes('游戏')) {
        templates = BIO_TEMPLATES.entertainment
      } else if (topic.includes('生活') || topic.includes('美食') || topic.includes('旅行')) {
        templates = BIO_TEMPLATES.life
      } else {
        templates = BIO_TEMPLATES.general
      }
    } else {
      // 随机选择一个分类
      const categories = Object.values(BIO_TEMPLATES)
      templates = this.pickRandom(categories)
    }
    
    return this.pickRandom(templates)
  }

  /**
   * 生成平台 handle
   */
  generateHandle(name: string, platform: string): string {
    const patterns = HANDLE_PATTERNS[platform as keyof typeof HANDLE_PATTERNS] || HANDLE_PATTERNS.chat
    
    // 将中文名转为拼音或使用随机字母
    const baseName = this.nameToHandle(name)
    
    const prefix = this.pickRandom(patterns.prefixes)
    const suffix = this.pickRandom(patterns.suffixes)
    
    // 添加随机数字以确保唯一性
    const randomNum = Math.floor(Math.random() * 10000)
    
    return `${prefix}${baseName}${randomNum}${suffix}`
  }

  /**
   * 将名字转换为 handle 格式
   */
  private nameToHandle(name: string): string {
    // 简单处理：使用随机字母组合
    // 实际项目中可以接入拼音库
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < name.length && i < 4; i++) {
      result += letters[Math.floor(Math.random() * letters.length)]
    }
    return result
  }

  /**
   * 从数组中随机选取一个元素
   */
  private pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  /**
   * 批量生成用户档案
   */
  generateBatch(count: number, context?: GenerationContext): GeneratedProfile[] {
    const profiles: GeneratedProfile[] = []
    for (let i = 0; i < count; i++) {
      profiles.push(this.generateRandomProfile(context))
    }
    return profiles
  }

  /**
   * 生成完整的角色画像
   */
  generateFullProfile(context?: GenerationContext): CharacterProfile {
    const ageRange = this.randomAgeRange()
    const occupation = this.randomOccupation(context)
    const interests = this.randomInterests(3)
    const personality = this.randomPersonality()
    const activityLevel = this.randomActivityLevel()
    const influenceLevel = this.randomInfluenceLevel()
    const tags = this.generateTags(interests, occupation)
    const contentStyle = this.randomContentStyle()

    return {
      ageRange,
      occupation,
      location: this.randomLocation(),
      interests,
      contentStyle,
      personality,
      activityLevel,
      influenceLevel,
      tags,
      behaviorTendencies: this.generateBehaviorTendencies(personality, activityLevel),
    }
  }

  /**
   * 生成带完整画像的用户档案
   */
  generateRichProfile(context?: GenerationContext): GeneratedProfile {
    const basicProfile = this.generateRandomProfile(context)
    const fullProfile = this.generateFullProfile(context)
    const tagline = this.generateTagline(fullProfile)

    return {
      ...basicProfile,
      tagline,
      profile: fullProfile,
    }
  }

  /**
   * 生成标语
   */
  generateTagline(profile: CharacterProfile): string {
    const interest = profile.interests[0] || 'life'
    const category = this.getTaglineCategory(interest)
    const templates = TAGLINE_TEMPLATES[category] || TAGLINE_TEMPLATES.life
    const template = this.pickRandom(templates)

    return template
      .replace('{{occupation}}', profile.occupation || '打工人')
      .replace('{{location}}', profile.location || '某城市')
  }

  /**
   * 生成随机年龄段
   */
  randomAgeRange(): AgeRange {
    const rand = Math.random()
    if (rand < 0.05) return 'teen'
    if (rand < 0.35) return 'young'
    if (rand < 0.65) return 'adult'
    if (rand < 0.85) return 'middle'
    if (rand < 0.95) return 'mature'
    return 'senior'
  }

  /**
   * 生成随机职业
   */
  randomOccupation(context?: GenerationContext): string {
    // 根据上下文选择职业类别
    let category = 'other'
    if (context?.topic) {
      const topic = context.topic.toLowerCase()
      if (topic.includes('tech') || topic.includes('科技') || topic.includes('编程')) {
        category = 'tech'
      } else if (topic.includes('娱乐') || topic.includes('明星') || topic.includes('创作')) {
        category = 'creative'
      } else if (topic.includes('学') || topic.includes('教育')) {
        category = 'student'
      }
    } else {
      // 随机选择类别
      const categories = Object.keys(OCCUPATIONS)
      category = this.pickRandom(categories)
    }

    return this.pickRandom(OCCUPATIONS[category] || OCCUPATIONS.other)
  }

  /**
   * 生成随机地点
   */
  randomLocation(): string {
    return this.pickRandom(LOCATIONS)
  }

  /**
   * 生成随机兴趣列表
   */
  randomInterests(count: number): InterestDomain[] {
    const allInterests: InterestDomain[] = [
      'tech', 'entertainment', 'gaming', 'anime', 'food', 'travel',
      'fashion', 'fitness', 'finance', 'education', 'news', 'life',
      'art', 'pet', 'parenting', 'car', 'other',
    ]
    const selected: InterestDomain[] = []
    const available = [...allInterests]

    for (let i = 0; i < count && available.length > 0; i++) {
      const index = Math.floor(Math.random() * available.length)
      selected.push(available.splice(index, 1)[0])
    }

    return selected
  }

  /**
   * 生成随机性格类型
   */
  randomPersonality(): PersonalityType {
    const types: PersonalityType[] = [
      'enthusiast', 'observer', 'creator', 'debater',
      'supporter', 'critic', 'neutral',
    ]
    return this.pickRandom(types)
  }

  /**
   * 生成随机活跃度
   */
  randomActivityLevel(): ActivityLevel {
    const rand = Math.random()
    if (rand < 0.1) return 'dormant'
    if (rand < 0.3) return 'low'
    if (rand < 0.6) return 'medium'
    if (rand < 0.85) return 'high'
    return 'super'
  }

  /**
   * 生成随机影响力等级
   */
  randomInfluenceLevel(): InfluenceLevel {
    const rand = Math.random()
    if (rand < 0.4) return 'nobody'
    if (rand < 0.7) return 'newbie'
    if (rand < 0.85) return 'rising'
    if (rand < 0.93) return 'small_v'
    if (rand < 0.97) return 'medium_v'
    if (rand < 0.99) return 'big_v'
    return 'super_v'
  }

  /**
   * 生成随机内容风格
   */
  randomContentStyle(): ContentStyle {
    const styles: ContentStyle[] = [
      'formal', 'casual', 'humorous', 'emotional',
      'professional', 'controversial', 'clickbait',
    ]
    // casual 和 humorous 更常见
    const weighted: ContentStyle[] = [
      ...styles,
      'casual', 'casual', 'casual',
      'humorous', 'humorous',
    ]
    return this.pickRandom(weighted)
  }

  /**
   * 生成标签
   */
  generateTags(interests: InterestDomain[], occupation?: string): string[] {
    const tags: string[] = []

    // 根据兴趣添加标签
    const interestTags: Record<InterestDomain, string[]> = {
      tech: ['科技控', '极客', '数码爱好者'],
      entertainment: ['追星族', '娱乐八卦'],
      gaming: ['游戏玩家', '电竞迷'],
      anime: ['二次元', '动漫迷', 'ACGN'],
      food: ['吃货', '美食家', '干饭人'],
      travel: ['旅行达人', '背包客'],
      fashion: ['时尚达人', '穿搭博主'],
      fitness: ['健身达人', '运动爱好者'],
      finance: ['理财达人', '投资小白'],
      education: ['学习党', '知识分享'],
      news: ['时事关注者', '吃瓜群众'],
      life: ['生活记录者', '日常分享'],
      art: ['艺术爱好者', '文艺青年'],
      pet: ['猫奴', '狗奴', '铲屎官'],
      parenting: ['宝妈', '育儿达人'],
      car: ['车友', '汽车发烧友'],
      other: [],
    }

    for (const interest of interests) {
      const possibleTags = interestTags[interest]
      if (possibleTags.length > 0) {
        tags.push(this.pickRandom(possibleTags))
      }
    }

    // 根据职业添加标签
    if (occupation) {
      if (occupation.includes('程序') || occupation.includes('开发')) {
        tags.push('码农')
      } else if (occupation.includes('学生')) {
        tags.push('学生党')
      } else if (occupation.includes('设计')) {
        tags.push('设计师')
      }
    }

    // 限制标签数量
    return tags.slice(0, 5)
  }

  /**
   * 生成行为倾向
   */
  generateBehaviorTendencies(
    personality: PersonalityType,
    activity: ActivityLevel
  ): BehaviorTendencies {
    // 基础值根据活跃度
    const activityBase: Record<ActivityLevel, number> = {
      dormant: 5,
      low: 20,
      medium: 50,
      high: 75,
      super: 95,
    }
    const base = activityBase[activity]

    // 性格修正
    const personalityModifiers: Record<PersonalityType, {
      like: number
      comment: number
      repost: number
      original: number
      controversy: number
    }> = {
      enthusiast: { like: 1.5, comment: 1.3, repost: 1.2, original: 30, controversy: 40 },
      observer: { like: 0.8, comment: 0.3, repost: 0.5, original: 10, controversy: 20 },
      creator: { like: 0.6, comment: 0.5, repost: 0.4, original: 80, controversy: 50 },
      debater: { like: 0.7, comment: 2.0, repost: 0.8, original: 60, controversy: 80 },
      supporter: { like: 1.8, comment: 1.2, repost: 1.5, original: 20, controversy: 20 },
      critic: { like: 0.4, comment: 1.5, repost: 0.6, original: 50, controversy: 70 },
      neutral: { like: 1.0, comment: 0.8, repost: 0.7, original: 40, controversy: 50 },
    }
    const mod = personalityModifiers[personality]

    return {
      likeFrequency: Math.min(100, Math.round(base * mod.like)),
      commentFrequency: Math.min(100, Math.round(base * mod.comment)),
      repostFrequency: Math.min(100, Math.round(base * mod.repost)),
      originalContentRatio: mod.original,
      controversyTolerance: mod.controversy,
    }
  }

  /**
   * 根据影响力等级获取粉丝数范围
   */
  getFollowersByLevel(level: InfluenceLevel): number {
    const ranges: Record<InfluenceLevel, [number, number]> = {
      nobody: [0, 100],
      newbie: [100, 1000],
      rising: [1000, 10000],
      small_v: [10000, 100000],
      medium_v: [100000, 1000000],
      big_v: [1000000, 10000000],
      super_v: [10000000, 100000000],
    }
    const [min, max] = ranges[level]
    return Math.floor(min + Math.random() * (max - min))
  }

  /**
   * 根据兴趣获取标语类别
   */
  private getTaglineCategory(interest: InterestDomain): string {
    const mapping: Record<InterestDomain, string> = {
      tech: 'tech',
      entertainment: 'entertainment',
      gaming: 'entertainment',
      anime: 'entertainment',
      food: 'life',
      travel: 'life',
      fashion: 'life',
      fitness: 'life',
      finance: 'work',
      education: 'work',
      news: 'life',
      life: 'life',
      art: 'creative',
      pet: 'life',
      parenting: 'life',
      car: 'life',
      other: 'life',
    }
    return mapping[interest] || 'life'
  }

  /**
   * 生成特定角色的用户档案
   * @param role 角色类型，如 'fan', 'hater', 'passerby'
   */
  generateByRole(role: string, context?: GenerationContext): GeneratedProfile {
    const profile = this.generateRandomProfile(context)
    
    // 根据角色调整简介
    switch (role.toLowerCase()) {
      case 'fan':
        profile.bio = this.pickRandom([
          '超级粉丝！',
          '永远支持！',
          '真爱粉一枚',
          '死忠粉报到',
        ])
        break
      case 'hater':
        profile.bio = this.pickRandom([
          '理性吃瓜',
          '路人视角',
          '客观评价',
          '就事论事',
        ])
        break
      case 'kol':
        profile.bio = this.pickRandom([
          '知名博主',
          '百万粉丝博主',
          '行业观察者',
          '独立评论人',
        ])
        break
      case 'official':
        profile.bio = '官方账号'
        break
      default:
        // 保持默认
        break
    }
    
    return profile
  }
}

// 导出服务单例
export const userPool = UserPool.getInstance()
