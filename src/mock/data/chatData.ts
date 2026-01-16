/**
 * Mock聊天数据
 * 用于开发环境测试
 */

import type { ChatMessage } from '@/types/sillytavern'

export const mockChatData: ChatMessage[] = [
  {
    message_id: 0,
    name: 'AI',
    role: 'assistant',
    is_hidden: false,
    message: `欢迎来到角色扮演世界！我是你的AI助手。

[app:微信, type:聊天, from:小明, time:09:00]
早上好！今天要一起去图书馆吗？
[/app]

[app:微信, type:聊天, from:小红, time:09:15]
我刚起床，还没吃早饭呢😅
[/app]`,
    data: {},
    extra: {},
  },
  {
    message_id: 1,
    name: '玩家',
    role: 'user',
    is_hidden: false,
    message: '我想先看看手机上有什么消息',
    data: {},
    extra: {},
  },
  {
    message_id: 2,
    name: 'AI',
    role: 'assistant',
    is_hidden: false,
    message: `你拿起手机，屏幕亮起，显示着几条新消息。

[app:微信, type:聊天, from:小明, time:09:30]
图书馆那边有新书到了，听说有你喜欢的类型
[/app]

[app:朋友圈, type:动态, from:小红, time:09:20]
今天的早餐太丰盛啦！🍳🥐☕
[图片:https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400]
[/app]

[app:微信, type:聊天, from:学习群, time:09:25]
@所有人 明天的考试大家准备好了吗？
[/app]`,
    data: {},
    extra: {},
  },
  {
    message_id: 3,
    name: '玩家',
    role: 'user',
    is_hidden: false,
    message: '给小明回复说好的，我一会儿就去',
    data: {},
    extra: {},
  },
  {
    message_id: 4,
    name: 'AI',
    role: 'assistant',
    is_hidden: false,
    message: `你在微信上给小明发送了消息。

[app:微信, type:聊天, from:小明, time:09:35]
太好了！我在二楼等你，靠窗那个位置
[/app]

小明很快就回复了你，看起来他已经在图书馆了。

[app:邮件, type:新邮件, from:教务处, subject:关于本学期期末考试安排的通知]
各位同学：

现将本学期期末考试安排通知如下：
1. 考试时间：6月20日-6月30日
2. 请携带学生证和准考证参加考试
3. 迟到超过30分钟者不得进入考场

祝同学们考试顺利！

教务处
2024年6月1日
[/app]`,
    data: {},
    extra: {},
  },
]