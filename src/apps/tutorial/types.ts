/**
 * Tutorial 教程应用类型定义
 */

/** 教程分类 */
export interface TutorialCategory {
  id: string
  name: string
  icon: string
  description?: string
}

/** 教程内容 */
export interface Tutorial {
  id: string
  categoryId: string
  title: string
  description: string
  icon: string
  content: string // Markdown 内容
  order: number
  readTime?: number // 预计阅读时间（分钟）
  tags?: string[]
}

/** 教程列表项 */
export interface TutorialListItem {
  id: string
  categoryId: string
  title: string
  description: string
  icon: string
  order: number
  readTime?: number
}