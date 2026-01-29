/**
 * UserPool 单元测试
 * 测试随机用户档案生成器的功能
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { UserPool, userPool } from '../userPool'
import type { GenerationContext } from '@/types/account'

describe('UserPool', () => {
  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = UserPool.getInstance()
      const instance2 = UserPool.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('应该与导出的 userPool 是同一实例', () => {
      expect(UserPool.getInstance()).toBe(userPool)
    })
  })

  describe('randomName', () => {
    it('应该生成中文名字', () => {
      const name = userPool.randomName()
      expect(name.length).toBeGreaterThanOrEqual(2)
      expect(name.length).toBeLessThanOrEqual(4)
      // 验证是中文字符
      expect(/^[\u4e00-\u9fa5]+$/.test(name)).toBe(true)
    })

    it('应该根据性别生成名字', () => {
      // 多次生成确保稳定性
      for (let i = 0; i < 10; i++) {
        const name = userPool.randomName('male')
        expect(name.length).toBeGreaterThanOrEqual(2)
      }
    })
  })

  describe('randomGender', () => {
    it('应该返回有效的性别值', () => {
      const validGenders = ['male', 'female', 'other', 'unknown']
      for (let i = 0; i < 20; i++) {
        const gender = userPool.randomGender()
        expect(validGenders).toContain(gender)
      }
    })

    it('应该倾向于返回 male 或 female', () => {
      let maleOrFemale = 0
      const iterations = 100
      
      for (let i = 0; i < iterations; i++) {
        const gender = userPool.randomGender()
        if (gender === 'male' || gender === 'female') {
          maleOrFemale++
        }
      }
      
      // 应该至少 80% 是 male 或 female
      expect(maleOrFemale / iterations).toBeGreaterThan(0.8)
    })
  })

  describe('randomAvatar', () => {
    it('应该返回有效的头像 URI', () => {
      const avatar = userPool.randomAvatar()
      expect(avatar).toMatch(/^avatar:\/\/default-\d+$/)
    })
  })

  describe('randomBio', () => {
    it('应该返回非空简介', () => {
      const bio = userPool.randomBio()
      expect(bio.length).toBeGreaterThan(0)
    })

    it('应该根据话题生成相关简介', () => {
      const techBio = userPool.randomBio({ topic: 'tech' })
      const lifeBio = userPool.randomBio({ topic: '生活' })
      
      expect(techBio.length).toBeGreaterThan(0)
      expect(lifeBio.length).toBeGreaterThan(0)
    })
  })

  describe('generateHandle', () => {
    it('应该生成有效的 handle', () => {
      const handle = userPool.generateHandle('张三', 'weibo')
      expect(handle.length).toBeGreaterThan(0)
      // handle 应该包含字母和数字
      expect(/[a-z]/.test(handle)).toBe(true)
      expect(/\d/.test(handle)).toBe(true)
    })

    it('应该为不同平台生成不同格式的 handle', () => {
      const weiboHandle = userPool.generateHandle('李四', 'weibo')
      const biliHandle = userPool.generateHandle('李四', 'bilibili')
      
      // 都应该是有效的 handle
      expect(weiboHandle.length).toBeGreaterThan(0)
      expect(biliHandle.length).toBeGreaterThan(0)
    })
  })

  describe('generateRandomProfile', () => {
    it('应该生成完整的随机档案', () => {
      const profile = userPool.generateRandomProfile()

      expect(profile.displayName).toBeDefined()
      expect(profile.displayName.length).toBeGreaterThan(0)
      expect(profile.nickname).toBe(profile.displayName)
      expect(profile.avatar).toBeDefined()
      expect(profile.bio).toBeDefined()
      expect(profile.gender).toBeDefined()
    })

    it('应该在提供平台时生成 handle', () => {
      const profile = userPool.generateRandomProfile({ platform: 'weibo' })

      expect(profile.handle).toBeDefined()
      expect(profile.handle!.length).toBeGreaterThan(0)
    })

    it('应该在不提供平台时不生成 handle', () => {
      const profile = userPool.generateRandomProfile()

      expect(profile.handle).toBeUndefined()
    })
  })

  describe('generateBatch', () => {
    it('应该批量生成指定数量的档案', () => {
      const profiles = userPool.generateBatch(5)

      expect(profiles.length).toBe(5)
      profiles.forEach(profile => {
        expect(profile.displayName).toBeDefined()
        expect(profile.gender).toBeDefined()
      })
    })

    it('应该为批量生成传递上下文', () => {
      const profiles = userPool.generateBatch(3, { platform: 'weibo' })

      profiles.forEach(profile => {
        expect(profile.handle).toBeDefined()
      })
    })
  })

  describe('randomAgeRange', () => {
    it('应该返回有效的年龄段', () => {
      const validRanges = ['teen', 'young', 'adult', 'middle', 'mature', 'senior']
      for (let i = 0; i < 20; i++) {
        const range = userPool.randomAgeRange()
        expect(validRanges).toContain(range)
      }
    })

    it('应该倾向于返回 young 和 adult', () => {
      let youngOrAdult = 0
      const iterations = 100
      
      for (let i = 0; i < iterations; i++) {
        const range = userPool.randomAgeRange()
        if (range === 'young' || range === 'adult') {
          youngOrAdult++
        }
      }
      
      // 应该至少 40% 是 young 或 adult
      expect(youngOrAdult / iterations).toBeGreaterThan(0.4)
    })
  })

  describe('randomOccupation', () => {
    it('应该返回有效的职业', () => {
      const occupation = userPool.randomOccupation()
      expect(occupation.length).toBeGreaterThan(0)
    })

    it('应该根据话题返回相关职业', () => {
      const techOccupation = userPool.randomOccupation({ topic: 'tech' })
      const techOccupations = [
        '程序员', '产品经理', '设计师', 'AI工程师', 
        '运维工程师', '测试工程师', '前端开发', '后端开发', '全栈工程师'
      ]
      expect(techOccupations).toContain(techOccupation)
    })
  })

  describe('randomLocation', () => {
    it('应该返回有效的地点', () => {
      const location = userPool.randomLocation()
      expect(location.length).toBeGreaterThan(0)
    })
  })

  describe('randomInterests', () => {
    it('应该返回指定数量的兴趣', () => {
      const interests = userPool.randomInterests(3)
      expect(interests.length).toBe(3)
    })

    it('应该返回不重复的兴趣', () => {
      const interests = userPool.randomInterests(5)
      const uniqueInterests = new Set(interests)
      expect(uniqueInterests.size).toBe(5)
    })

    it('应该返回有效的兴趣领域', () => {
      const validInterests = [
        'tech', 'entertainment', 'gaming', 'anime', 'food', 'travel',
        'fashion', 'fitness', 'finance', 'education', 'news', 'life',
        'art', 'pet', 'parenting', 'car', 'other'
      ]
      const interests = userPool.randomInterests(3)
      interests.forEach(interest => {
        expect(validInterests).toContain(interest)
      })
    })
  })

  describe('randomPersonality', () => {
    it('应该返回有效的性格类型', () => {
      const validTypes = [
        'enthusiast', 'observer', 'creator', 'debater',
        'supporter', 'critic', 'neutral'
      ]
      for (let i = 0; i < 20; i++) {
        const personality = userPool.randomPersonality()
        expect(validTypes).toContain(personality)
      }
    })
  })

  describe('randomActivityLevel', () => {
    it('应该返回有效的活跃度', () => {
      const validLevels = ['dormant', 'low', 'medium', 'high', 'super']
      for (let i = 0; i < 20; i++) {
        const level = userPool.randomActivityLevel()
        expect(validLevels).toContain(level)
      }
    })
  })

  describe('randomInfluenceLevel', () => {
    it('应该返回有效的影响力等级', () => {
      const validLevels = [
        'nobody', 'newbie', 'rising', 'small_v',
        'medium_v', 'big_v', 'super_v'
      ]
      for (let i = 0; i < 20; i++) {
        const level = userPool.randomInfluenceLevel()
        expect(validLevels).toContain(level)
      }
    })
  })

  describe('randomContentStyle', () => {
    it('应该返回有效的内容风格', () => {
      const validStyles = [
        'formal', 'casual', 'humorous', 'emotional',
        'professional', 'controversial', 'clickbait'
      ]
      for (let i = 0; i < 20; i++) {
        const style = userPool.randomContentStyle()
        expect(validStyles).toContain(style)
      }
    })
  })

  describe('generateFullProfile', () => {
    it('应该生成完整的角色画像', () => {
      const profile = userPool.generateFullProfile()

      expect(profile.ageRange).toBeDefined()
      expect(profile.occupation).toBeDefined()
      expect(profile.location).toBeDefined()
      expect(profile.interests).toBeDefined()
      expect(profile.interests.length).toBe(3)
      expect(profile.personality).toBeDefined()
      expect(profile.activityLevel).toBeDefined()
      expect(profile.influenceLevel).toBeDefined()
      expect(profile.tags).toBeDefined()
      expect(profile.behaviorTendencies).toBeDefined()
    })
  })

  describe('generateRichProfile', () => {
    it('应该生成带完整画像的用户档案', () => {
      const richProfile = userPool.generateRichProfile({ platform: 'weibo' })

      // 基础档案属性
      expect(richProfile.displayName).toBeDefined()
      expect(richProfile.handle).toBeDefined()
      expect(richProfile.gender).toBeDefined()

      // 扩展属性
      expect(richProfile.tagline).toBeDefined()
      expect(richProfile.profile).toBeDefined()
      expect(richProfile.profile?.interests).toBeDefined()
      expect(richProfile.profile?.activityLevel).toBeDefined()
    })
  })

  describe('generateTagline', () => {
    it('应该生成标语', () => {
      const profile = userPool.generateFullProfile()
      const tagline = userPool.generateTagline(profile)

      expect(tagline.length).toBeGreaterThan(0)
    })

    it('应该替换模板变量', () => {
      const profile = userPool.generateFullProfile()
      profile.occupation = '程序员'
      profile.location = '北京'
      
      const tagline = userPool.generateTagline(profile)
      
      // 不应该包含未替换的模板变量
      expect(tagline).not.toContain('{{')
      expect(tagline).not.toContain('}}')
    })
  })

  describe('generateTags', () => {
    it('应该根据兴趣生成标签', () => {
      const tags = userPool.generateTags(['tech', 'gaming'])
      
      expect(tags.length).toBeGreaterThan(0)
      expect(tags.length).toBeLessThanOrEqual(5)
    })

    it('应该根据职业添加标签', () => {
      const tags = userPool.generateTags(['tech'], '程序员')
      
      expect(tags).toContain('码农')
    })
  })

  describe('generateBehaviorTendencies', () => {
    it('应该生成行为倾向', () => {
      const tendencies = userPool.generateBehaviorTendencies('enthusiast', 'high')

      expect(tendencies.likeFrequency).toBeGreaterThanOrEqual(0)
      expect(tendencies.likeFrequency).toBeLessThanOrEqual(100)
      expect(tendencies.commentFrequency).toBeGreaterThanOrEqual(0)
      expect(tendencies.commentFrequency).toBeLessThanOrEqual(100)
      expect(tendencies.repostFrequency).toBeGreaterThanOrEqual(0)
      expect(tendencies.repostFrequency).toBeLessThanOrEqual(100)
    })

    it('应该根据活跃度调整基础值', () => {
      const dormant = userPool.generateBehaviorTendencies('neutral', 'dormant')
      const superActive = userPool.generateBehaviorTendencies('neutral', 'super')

      expect(dormant.likeFrequency).toBeLessThan(superActive.likeFrequency)
    })

    it('应该根据性格类型调整倾向', () => {
      const enthusiast = userPool.generateBehaviorTendencies('enthusiast', 'medium')
      const observer = userPool.generateBehaviorTendencies('observer', 'medium')

      // 热情派应该比观察者更爱互动
      expect(enthusiast.likeFrequency).toBeGreaterThan(observer.likeFrequency)
      expect(enthusiast.commentFrequency).toBeGreaterThan(observer.commentFrequency)
    })
  })

  describe('getFollowersByLevel', () => {
    it('应该返回合理范围内的粉丝数', () => {
      expect(userPool.getFollowersByLevel('nobody')).toBeLessThan(100)
      expect(userPool.getFollowersByLevel('newbie')).toBeLessThan(1000)
      expect(userPool.getFollowersByLevel('big_v')).toBeGreaterThan(1000000)
    })

    it('应该返回随机值', () => {
      const values = new Set<number>()
      for (let i = 0; i < 10; i++) {
        values.add(userPool.getFollowersByLevel('small_v'))
      }
      // 应该有多个不同的值
      expect(values.size).toBeGreaterThan(1)
    })
  })

  describe('generateByRole', () => {
    it('应该生成粉丝角色的档案', () => {
      const fan = userPool.generateByRole('fan')
      expect(fan.bio).toBeDefined()
      // 粉丝简介应该是支持性的
      const fanBios = ['超级粉丝！', '永远支持！', '真爱粉一枚', '死忠粉报到']
      expect(fanBios).toContain(fan.bio)
    })

    it('应该生成 KOL 角色的档案', () => {
      const kol = userPool.generateByRole('kol')
      expect(kol.bio).toBeDefined()
      const kolBios = ['知名博主', '百万粉丝博主', '行业观察者', '独立评论人']
      expect(kolBios).toContain(kol.bio)
    })

    it('应该生成官方角色的档案', () => {
      const official = userPool.generateByRole('official')
      expect(official.bio).toBe('官方账号')
    })

    it('应该对未知角色使用默认档案', () => {
      const unknown = userPool.generateByRole('unknown_role')
      expect(unknown.displayName).toBeDefined()
      expect(unknown.bio).toBeDefined()
    })
  })
})
