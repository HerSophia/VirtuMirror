/**
 * Social Engine Prompts 单元测试
 * 测试社交引擎专用提示词定义
 */

import { describe, it, expect } from 'vitest'
import { socialEnginePrompts } from '../prompts'
import type { AppPromptDefinition } from '@/types/prompts'

describe('socialEnginePrompts', () => {
  it('应该导出提示词数组', () => {
    expect(Array.isArray(socialEnginePrompts)).toBe(true)
    expect(socialEnginePrompts.length).toBeGreaterThan(0)
  })

  describe('世界事件生成提示词', () => {
    it('应该包含 social.event.generate 场景', () => {
      const eventPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.event.generate'
      )

      expect(eventPrompt).toBeDefined()
      expect(eventPrompt?.name).toBe('生成世界事件')
      expect(eventPrompt?.category).toBe('social')
    })

    it('应该有正确的变量定义', () => {
      const eventPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.event.generate'
      )

      expect(eventPrompt?.availableVariables).toBeDefined()

      const timeContext = eventPrompt?.availableVariables?.find(
        (v) => v.name === 'timeContext'
      )
      expect(timeContext).toBeDefined()
      expect(timeContext?.required).toBe(true)
      expect(timeContext?.type).toBe('string')

      const eventType = eventPrompt?.availableVariables?.find(
        (v) => v.name === 'eventType'
      )
      expect(eventType).toBeDefined()
      expect(eventType?.required).toBe(false)
      expect(eventType?.defaultValue).toBe('随机')

      const intensity = eventPrompt?.availableVariables?.find(
        (v) => v.name === 'intensity'
      )
      expect(intensity).toBeDefined()
      expect(intensity?.required).toBe(false)
    })

    it('应该包含 JSON 格式说明', () => {
      const eventPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.event.generate'
      )

      expect(eventPrompt?.systemPrompt).toContain('JSON')
      expect(eventPrompt?.systemPrompt).toContain('keyword')
      expect(eventPrompt?.systemPrompt).toContain('summary')
      expect(eventPrompt?.systemPrompt).toContain('baseScore')
    })
  })

  describe('博文生成提示词', () => {
    it('应该包含 social.post.generate 场景', () => {
      const postPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.post.generate'
      )

      expect(postPrompt).toBeDefined()
      expect(postPrompt?.name).toBe('生成社交博文')
      expect(postPrompt?.category).toBe('social')
    })

    it('应该有平台相关的变量', () => {
      const postPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.post.generate'
      )

      const platformName = postPrompt?.availableVariables?.find(
        (v) => v.name === 'platformName'
      )
      expect(platformName).toBeDefined()
      expect(platformName?.required).toBe(true)

      const platformCulture = postPrompt?.availableVariables?.find(
        (v) => v.name === 'platformCulture'
      )
      expect(platformCulture).toBeDefined()
      expect(platformCulture?.required).toBe(true)

      const topic = postPrompt?.availableVariables?.find(
        (v) => v.name === 'topic'
      )
      expect(topic).toBeDefined()
      expect(topic?.required).toBe(true)
    })

    it('应该支持作者身份和字数限制配置', () => {
      const postPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.post.generate'
      )

      const authorIdentity = postPrompt?.availableVariables?.find(
        (v) => v.name === 'authorIdentity'
      )
      expect(authorIdentity).toBeDefined()
      expect(authorIdentity?.defaultValue).toBe('普通路人')

      const length = postPrompt?.availableVariables?.find(
        (v) => v.name === 'length'
      )
      expect(length).toBeDefined()
      expect(length?.type).toBe('number')
      expect(length?.defaultValue).toBe(140)
    })
  })

  describe('评论批量生成提示词', () => {
    it('应该包含 social.comment.batch 场景', () => {
      const commentPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.comment.batch'
      )

      expect(commentPrompt).toBeDefined()
      expect(commentPrompt?.name).toBe('批量生成评论')
      expect(commentPrompt?.category).toBe('social')
    })

    it('应该有帖子内容和数量变量', () => {
      const commentPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.comment.batch'
      )

      const postContent = commentPrompt?.availableVariables?.find(
        (v) => v.name === 'postContent'
      )
      expect(postContent).toBeDefined()
      expect(postContent?.required).toBe(true)

      const count = commentPrompt?.availableVariables?.find(
        (v) => v.name === 'count'
      )
      expect(count).toBeDefined()
      expect(count?.type).toBe('number')
      expect(count?.defaultValue).toBe(5)
    })

    it('应该说明输出为 JSON 数组格式', () => {
      const commentPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.comment.batch'
      )

      expect(commentPrompt?.systemPrompt).toContain('content')
      expect(commentPrompt?.systemPrompt).toContain('persona')
      expect(commentPrompt?.systemPrompt).toContain('sentiment')
    })
  })

  describe('用户画像生成提示词', () => {
    it('应该包含 social.user.generate 场景', () => {
      const userPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.user.generate'
      )

      expect(userPrompt).toBeDefined()
      expect(userPrompt?.name).toBe('生成虚拟用户')
      expect(userPrompt?.category).toBe('social')
    })

    it('应该有平台和上下文变量', () => {
      const userPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.user.generate'
      )

      const platformName = userPrompt?.availableVariables?.find(
        (v) => v.name === 'platformName'
      )
      expect(platformName).toBeDefined()
      expect(platformName?.required).toBe(true)

      const context = userPrompt?.availableVariables?.find(
        (v) => v.name === 'context'
      )
      expect(context).toBeDefined()
      expect(context?.defaultValue).toBe('随机路人')
    })

    it('应该说明用户画像的 JSON 结构', () => {
      const userPrompt = socialEnginePrompts.find(
        (p) => p.scene === 'social.user.generate'
      )

      expect(userPrompt?.systemPrompt).toContain('nickname')
      expect(userPrompt?.systemPrompt).toContain('handle')
      expect(userPrompt?.systemPrompt).toContain('bio')
      expect(userPrompt?.systemPrompt).toContain('tags')
    })
  })

  describe('提示词结构验证', () => {
    it('每个提示词应该有完整的必要字段', () => {
      for (const prompt of socialEnginePrompts) {
        expect(prompt.scene).toBeDefined()
        expect(prompt.name).toBeDefined()
        expect(prompt.description).toBeDefined()
        expect(prompt.category).toBe('social')
        expect(prompt.systemPrompt).toBeDefined()
        expect(prompt.template).toBeDefined()
        expect(prompt.availableVariables).toBeDefined()
        expect(Array.isArray(prompt.availableVariables)).toBe(true)
      }
    })

    it('每个变量应该有完整的定义', () => {
      for (const prompt of socialEnginePrompts) {
        for (const variable of prompt.availableVariables || []) {
          expect(variable.name).toBeDefined()
          expect(variable.description).toBeDefined()
          expect(variable.type).toBeDefined()
          expect(typeof variable.required).toBe('boolean')
        }
      }
    })
  })
})
