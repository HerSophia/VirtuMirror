import { WeiboPostUI, WeiboUser, HotSearchItem, MessageItem, StoryItem } from '../types';

// Image 1: Message Tab Data
export const messageGridItems = [
  { id: 'at', title: '@我的', icon: 'at', color: 'bg-blue-400' },
  { id: 'comment', title: '评论', icon: 'comment', color: 'bg-green-400' },
  { id: 'like', title: '赞', icon: 'thumb-up', color: 'bg-orange-400' },
];

export const messageListItems: MessageItem[] = [
  {
    id: '1',
    type: 'notification',
    icon: 'account-group',
    iconColor: 'bg-orange-500',
    title: '群推荐',
    subtitle: '加入感兴趣的粉丝群，开启热聊模式',
    time: '05:11'
  },
  {
    id: '2',
    type: 'notification',
    icon: 'message-text',
    iconColor: 'bg-red-500',
    title: '留言板',
    subtitle: '游戏超话社区: http://t.cn/A6nJc...',
    time: '24-11-1'
  },
  {
    id: '3',
    type: 'notification',
    icon: 'diamond',
    iconColor: 'bg-pink-500',
    title: '超话社区',
    subtitle: '亲爱的用户，#...',
    time: '21-10-13'
  },
  {
    id: '4',
    type: 'notification',
    icon: 'sina', 
    iconColor: 'bg-white', 
    title: '新浪新闻',
    subtitle: '携妻子闺蜜同游三亚？央美确诊...',
    time: '21-8-6',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sina'
  },
  {
    id: '5',
    type: 'notification',
    title: '微博会员',
    subtitle: '捡漏啦！1元购微博会员 超值大放送',
    time: '21-7-3',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=VIP'
  },
  {
    id: '6',
    type: 'notification',
    title: '微博小秘书',
    subtitle: '权威题库，名师解答！只为你一...',
    time: '20-3-28',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Secretary'
  }
];

// Image 2: Home Tab Data
export const stories: StoryItem[] = [
  { id: '1', name: '明星来电', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Star', isLive: true },
  { id: '2', name: '2人连麦中', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chat', isLive: true },
  { id: '3', name: '默小魂', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mo' },
  { id: '4', name: '我是歌手...', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Singer' },
  { id: '5', name: '倒数第11...', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Count' },
];

export const homePosts: WeiboPostUI[] = [
  {
    id: 'post1',
    user: {
      id: 'u1',
      name: '仙姬',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fairy',
      verified: true,
      verifiedType: 'personal',
      vipLevel: 2
    },
    time: '来自 微博网页版',
    content: '#夏目友人帐#妖不可貌相，原来小胡子是帅气的白龙 #2025动漫嘉年华#',
    images: [
      'https://picsum.photos/seed/anime1/400/300', 
    ],
    likes: 74,
    comments: 0,
    shares: 0,
    isFollowing: false
  },
  {
    id: 'post2',
    user: {
      id: 'u2',
      name: '方三岁鸭__',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duck',
      verified: true,
      verifiedType: 'personal',
      vipLevel: 2
    },
    time: '25-12-31 科学科普博主',
    content: '这就是我不介意大家轻易去尝试无边泳池的原因\n#微博超有用视频大赛##冷知识百科#',
    images: [
      'https://picsum.photos/seed/pool/400/200'
    ],
    likes: 120,
    comments: 45,
    shares: 12,
    isFollowing: true
  }
];

// Categories Data
export const hotSearchData: Record<string, HotSearchItem[]> = {
  '热搜': [
    { rank: 0, title: '努力奋斗才能梦想成真', heat: 0, isTop: true, tag: 'hot' },
    { rank: 1, title: '新年首日中国空间站过境合集', heat: 124018 },
    { rank: 2, title: '尔滨你是有点子浪漫在身上的', heat: 89432 },
    { rank: 3, title: '2026为梦想奋斗为幸福打拼', heat: 68960 },
    { rank: 4, title: '罚罪2', heat: 68527, tag: 'boil', tagType: 'text', tagText: '剧集' },
    { rank: 5, title: '得闲谨制', heat: 68229 },
    { rank: 6, title: '个人存取款超5万元不再登记', heat: 67770 },
    { rank: 7, title: '冰雪大世界建了超大玫瑰冰瀑', heat: 67131 },
    { rank: 8, title: '三亚元旦入境游客暴增5倍', heat: 66866 },
    { rank: 9, title: '小吃街共用一个收款码有后续了', heat: 65920 },
    { rank: 10, title: '二十年快滴很 弹指一挥间', heat: 65352, tagType: 'text', tagText: '剧集' },
    { rank: 11, title: '发现卧室其实不应该装衣柜', heat: 65285 }
  ],
  '文娱': [
    { rank: 1, title: 'TWS', heat: 143804, tag: 'hot' },
    { rank: 2, title: '林俊杰 最近的这些事真的有点烦', heat: 55123, tag: 'hot' },
    { rank: 3, title: '骄阳似我 奇耻大辱', heat: 51631, tag: 'hot' },
    { rank: 4, title: '曝童锦程有孩子', heat: 51285, tag: 'hot' },
    { rank: 5, title: '沈佳润唱功', heat: 46541, tag: 'hot' },
    { rank: 6, title: '梓渝 我怀念的', heat: 43956 },
    { rank: 7, title: '李施嬅下车 胡彦斌掀桌', heat: 39340 },
    { rank: 8, title: '肖战点歌', heat: 34646 },
    { rank: 9, title: '汪苏泷让场外的观众进场了', heat: 33718 },
    { rank: 10, title: '肖战在嘘什么', heat: 31501 },
    { rank: 11, title: '毛不易在小沈阳家辈分全乱套', heat: 30563 },
    { rank: 12, title: '怪奇物语', heat: 28903 }
  ],
  '生活': [
    { rank: 1, title: '发现卧室其实不应该装衣柜', heat: 26164 },
    { rank: 2, title: '狗狗第一次后悔自己的鼻子很灵', heat: 23547 },
    { rank: 3, title: '小猫生了一模一样的自己', heat: 21192 },
    { rank: 4, title: '咪为什么喜欢把尾巴圈在脚上', heat: 19073 },
    { rank: 5, title: '元旦', heat: 17166 },
    { rank: 6, title: '地铁偶遇初代探店博主', heat: 15449 },
    { rank: 7, title: 'ins风的腊八蒜', heat: 13904 },
    { rank: 8, title: '审马积累', heat: 12514 },
    { rank: 9, title: '养一个大学生就像发射了一颗卫星', heat: 11262 },
    { rank: 10, title: '毛孩子一身肌肉', heat: 10136 },
    { rank: 11, title: '大学生回老家听力考试', heat: 9122 },
    { rank: 12, title: '零下30度的世界', heat: 8210 }
  ],
  '社会': [
    { rank: 1, title: '重庆飞三亚航班紧急返航乘客发声', heat: 0, tag: 'hot' },
    { rank: 2, title: '新年首日中国空间站过境合集', heat: 54179 },
    { rank: 3, title: '尔滨你是有点子浪漫在身上的', heat: 48761 },
    { rank: 4, title: '个人存取款超5万元不再登记', heat: 43885 },
    { rank: 5, title: '保姆在厨房做饭燃气突然爆炸', heat: 39496 },
    { rank: 6, title: '印警方称200公斤大麻被老鼠吃掉', heat: 35546 },
    { rank: 7, title: '瑞士医院被烧伤患者淹没', heat: 31992 },
    { rank: 8, title: '2026年生娃基本不花钱', heat: 28792 },
    { rank: 9, title: '蔡磊称拯救渐冻症患者不用回报', heat: 25913 },
    { rank: 10, title: '冰雪大世界建了超大玫瑰冰瀑', heat: 23322 },
    { rank: 11, title: '三亚元旦入境游客暴增5倍', heat: 20990 },
    { rank: 12, title: '法国跨年把2026打成2036', heat: 18891 }
  ],
  '同城': [
    { rank: 1, title: '华晨宇来广西也变小砂糖桔', heat: 6039 },
    { rank: 2, title: '新的一年广西学子都在干嘛', heat: 5569 },
    { rank: 3, title: '用最地道的广西风味解锁2026', heat: 5422 },
    { rank: 4, title: '广西学子欢喜迎2026元旦', heat: 5279 },
    { rank: 5, title: '广西小砂糖橘三闯漠河', heat: 5262 },
    { rank: 6, title: '广西云2026焕新', heat: 5218 }
  ],
  '体育': [
    { rank: 1, title: '林诗栋回复韩昊霖', heat: 17038 },
    { rank: 2, title: '孙颖莎说的话含金量还在上升', heat: 15334 },
    { rank: 3, title: '樊振东再次登上东方卫视跨年大屏', heat: 13800 },
    { rank: 4, title: '吴敬平新年晒樊振东照片', heat: 12420 },
    { rank: 5, title: 'CBA', heat: 11178 },
    { rank: 6, title: '徐杰受伤', heat: 10060 },
    { rank: 7, title: '切尔西官宣马雷斯卡下课', heat: 9054 },
    { rank: 8, title: '陈芋汐去跨年晚会了', heat: 8230 },
    { rank: 9, title: '贾磊说徐杰应该问题不大', heat: 8225 },
    { rank: 10, title: '陈芋汐跨年现场追星王安宇', heat: 8098 },
    { rank: 11, title: 'CBA京粤大战北京取胜', heat: 7461 },
    { rank: 12, title: '林高远跨界挑战不再犹豫', heat: 6714 }
  ],
  'ACG': [
    { rank: 1, title: '第五人格', heat: 14351 },
    { rank: 2, title: '白露的红夫人', heat: 12915 },
    { rank: 3, title: '白露红夫人四抓', heat: 11624 },
    { rank: 4, title: 'MRC对战Gr', heat: 10461 },
    { rank: 5, title: '年锦燃尽了', heat: 9415 },
    { rank: 6, title: '钟意签名送完你的送你的', heat: 8474 },
    { rank: 7, title: '王者中比传说还稀有的免费皮肤', heat: 7626 },
    { rank: 8, title: '完美世界一个月两个特别篇', heat: 6864 },
    { rank: 9, title: 'iG战胜LNG', heat: 6355 },
    { rank: 10, title: '王者用一次就会上瘾的皮肤', heat: 6294 },
    { rank: 11, title: '无畏契约手游直播', heat: 6203 },
    { rank: 12, title: '王者想不到的老六组合', heat: 6133 }
  ],
  '科技': [
    { rank: 1, title: '王自如摊牌回应罗永浩', heat: 12959 },
    { rank: 2, title: '1分钟看完全球跨年烟花', heat: 11663 },
    { rank: 3, title: '零跑年销量近60万台超额完成目标', heat: 10496 },
    { rank: 4, title: 'DeepSeek元旦新论文', heat: 9447 },
    { rank: 5, title: 'ai都让你聊冷场了', heat: 8502 },
    { rank: 6, title: '曝英伟达GPU将涨价', heat: 7652 },
    { rank: 7, title: '蔚来', heat: 6886 },
    { rank: 8, title: '罗永浩回应退票', heat: 6198 },
    { rank: 9, title: '手机内存永远不够用', heat: 5578 },
    { rank: 10, title: '多家车企公布全年交付量', heat: 5020 },
    { rank: 11, title: '沃尔沃新年首推新能源购置补贴', heat: 4518 },
    { rank: 12, title: '小米回应YU7配置调整', heat: 4066 }
  ]
};

// Legacy support if needed, pointing to hot
export const hotSearchList = hotSearchData['热搜'];

export const discoverSummary = [
  { title: '曝童锦程有孩子', tag: 'hot' },
  { title: '个人存取款超5万元...', tag: '' },
  { title: '央视跨年晚会上的...', tag: '' },
  { title: '林俊杰 最近的这...', tag: 'hot' },
  { title: '男子带妻儿开直升...', tag: '' },
  { title: '肖战点歌', tag: '' },
  { title: '骄阳似我 奇耻大辱', tag: 'hot' },
  { title: 'Sakee Asen', tag: '' },
  { title: '李荣浩紧急公关撤...', tag: '' },
  { title: '王者中阵亡次数最...', tag: '' },
];

/**
 * Helper to generate random posts
 */
export function generateRandomPost(): WeiboPostUI {
  const users = [
    { name: '科技新知', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Tech' },
    { name: '萌宠日报', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Pet' },
    { name: '电影最前线', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Movie' },
    { name: '美食大探店', avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Food' }
  ];
  
  const contents = [
    '今天天气真不错，出去走走！#生活记录#',
    '这个新出的电影真的太好看了，强烈推荐大家去电影院看！#电影推荐#',
    '好想吃火锅啊...有没有一起的？[馋嘴]',
    '科技改变生活，现在的AI真的太强了。#人工智能# #科技#',
    '路边的野花不要采~ [音乐]',
    '打卡网红店，味道一般般吧，不推荐。#避雷#',
    '熬夜加班中，谁懂啊家人们... [泪]'
  ];
  
  const user = users[Math.floor(Math.random() * users.length)];
  const content = contents[Math.floor(Math.random() * contents.length)];
  
  return {
    id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    user: {
      id: `u_${Math.random().toString(36).substr(2, 5)}`,
      name: user.name,
      avatar: user.avatar,
      verified: Math.random() > 0.5,
      verifiedType: 'personal',
      vipLevel: Math.floor(Math.random() * 3)
    },
    time: '刚刚',
    source: Math.random() > 0.5 ? 'iPhone 15 Pro' : '微博网页版',
    content: content,
    images: Math.random() > 0.5 ? [`https://picsum.photos/seed/${Math.random()}/400/300`] : [],
    likes: Math.floor(Math.random() * 100),
    comments: Math.floor(Math.random() * 20),
    shares: Math.floor(Math.random() * 10),
    isFollowing: Math.random() > 0.8
  };
}
