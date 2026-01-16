/**
 * 论坛板块
 */
export interface ForumBoard {
  /** 板块ID */
  id: string
  /** 板块名称 */
  name: string
  /** 板块描述 */
  description?: string
  /** 图标 */
  icon?: string
}

/**
 * 论坛帖子
 */
export interface ForumPost {
  /** 帖子ID */
  id: string
  /** 所属板块ID */
  boardId: string
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 作者ID */
  authorId: string
  /** 发布时间 */
  timestamp: number
  /** 回复数 */
  replyCount: number
  /** 查看数 */
  viewCount: number
  /** 点赞数 */
  likeCount: number
}
