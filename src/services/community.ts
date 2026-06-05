import type { Post } from '../types';
import { getFeedImage } from './imageLibrary';

export const defaultExplorePosts: Post[] = [
  {
    id: 1,
    image: getFeedImage('亲子 农场 周末 打卡', 'explore_1'),
    mediaType: 'image',
    title: '周末带娃去哪玩？这个神仙农场也太好拍了吧！',
    userName: 'Miko酱',
    hotCount: 23000,
    content:
      '周末不想宅在家？带神兽来这个藏在通州的宝藏农场吧！不仅有超多可爱的小动物可以零距离互动，还可以亲手采摘有机蔬菜。农场里的咖啡馆也是超出片，法式田园风简直绝美！门票只需68元，可以说性价比巨高了。',
    location: '通州区·向往的农场',
    tags: ['周末特种兵', '宝藏小店'],
    comments: [
      { user: '小可爱', text: '哇！求个具体地址！' },
      { user: '周末去哪儿', text: '看着好棒，下周安排！' },
    ],
  },
  {
    id: 2,
    image: getFeedImage('胡同 咖啡馆 安静 下午茶', 'explore_2'),
    mediaType: 'image',
    title: '隐藏在胡同里的宝藏咖啡馆，安静发呆一整个下午',
    userName: '咖啡星人',
    hotCount: 8541,
    content:
      '无意间穿梭在胡同里发现的这家咖啡馆，推开门仿佛进入了另一个世界。老板手冲的日晒耶加雪菲果酸明亮，再配上店里招牌的巴斯克蛋糕，简直绝配！店里可以带宠物，下午两点左右光线最好，透过落地窗洒进来非常治愈。',
    location: '东城区·五道营',
    tags: ['宝藏小店', '美食探店'],
    comments: [{ user: '拿铁爱好者', text: '这家我也去过！氛围真的好' }],
  },
  {
    id: 3,
    image: getFeedImage('艺术展 光影 展览 798', 'explore_3'),
    mediaType: 'video',
    mediaUrl:
      'https://cdn.coverr.co/videos/coverr-woman-admiring-flowers-1560679506438?download=1080p',
    mediaPoster: getFeedImage('艺术展 光影 展览 798', 'explore_3_video'),
    mediaDuration: '00:18',
    title: '不可错过的艺术展！带你感受光影魅力🎨',
    userName: '野生艺术家',
    hotCount: 12000,
    content:
      '当代艺术中心的新展终于开了！这次是数字光影和实体装置的结合，视觉冲击力极强。特别是第三个展厅的《无限蔓延》，利用镜面和镭射光线营造出的空间感，随手一拍就是大片。建议穿纯色衣服来打卡效果更好哦！',
    location: '朝阳区·798艺术区',
    tags: ['看展达人'],
    comments: [
      { user: 'Lisa', text: '门票多少钱哇？需要预约吗？' },
      { user: '野生艺术家(作者)', text: '回复 Lisa: 门票98，周末需要提前一天在公众号预约哦' },
    ],
  },
  {
    id: 4,
    image: getFeedImage('轻食 低卡 沙拉 餐厅', 'explore_4'),
    mediaType: 'image',
    title: '减脂期也能冲！亲测好吃的低卡轻食餐厅🥗',
    userName: '吃不胖的安安',
    hotCount: 5320,
    content:
      '减脂期的姐妹看过来！这家轻食真的是我吃过最好吃的，完全不寡淡。强烈推荐他们的香煎三文鱼波奇饭，三文鱼外焦里嫩，搭配牛油果和藜麦，口感层次超级丰富。热量标注得很清楚，一份不到400卡，吃得毫无负担！',
    location: '海淀区·中关村',
    tags: ['美食探店'],
    comments: [],
  },
  {
    id: 5,
    image: getFeedImage('徒步 郊野 森林 户外', 'explore_5'),
    mediaType: 'video',
    mediaUrl: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/1080/Jellyfish_1080_10s_1MB.mp4',
    mediaPoster: getFeedImage('徒步 郊野 森林 户外', 'explore_5_video'),
    mediaDuration: '00:24',
    title: '逃离城市喧嚣，京郊徒步路线推荐，吸氧洗肺🌲',
    userName: '户外小达人',
    hotCount: 31000,
    content:
      '秋高气爽，正是徒步的好时节。这条路线离市区大概一个半小时车程，全程约8公里，爬升只有300米左右，对新手非常友好。一路上有溪水相伴，山林里的空气特别清新。到达山顶还能俯瞰连绵的群山，风景如画！',
    location: '怀柔区·神堂峪',
    tags: ['户外露营', '周末特种兵'],
    comments: [
      { user: '徒步小白', text: '必须配登山鞋吗？' },
      { user: '户外小达人(作者)', text: '回复 徒步小白: 普通运动鞋就可以的，这条路线比较成熟了' },
    ],
  },
  {
    id: 6,
    image: getFeedImage('聚餐 大排档 夜宵 烟火气', 'explore_6'),
    mediaType: 'image',
    title: '和朋友聚餐必去的大排档！烟火气十足，味道超赞',
    userName: '深夜包子',
    hotCount: 9870,
    content:
      '想要感受最地道的城市烟火气，就来这家充满氛围的大排档吧！生蚝个大肥美，蒜蓉烤得滋滋冒油。招牌的碳烤羊排更是绝绝子，外酥里嫩，一口咬下去满嘴爆汁。加上几瓶冰镇啤酒，和三五好友吹风聊天，简直是夏日标配。',
    location: '朝阳区·合生汇',
    tags: ['美食探店', '周末特种兵'],
    comments: [
      { user: '干饭人', text: '看饿了...' },
      { user: '夜猫子', text: '这家经常排队吗？' },
    ],
  },
];
