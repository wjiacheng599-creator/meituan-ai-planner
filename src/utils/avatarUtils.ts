import type { PersonProfile } from '../types';

/**
 * 年龄段 → 头像前缀映射
 */
const AGE_GROUP_MAP: Record<string, string> = {
  儿童: 'child',
  青少年: 'young', // 青少年归入青年组
  青年: 'young',
  中年: 'adult',
  老年: 'senior',
};

/**
 * 7种风格标签（按年龄段和性别分类）
 */
export const STYLE_TAGS: Record<string, Record<string, string[]>> = {
  young: {
    male: ['清新风', '时尚风', '文艺风', '职场风', '阳光风', '潮流风', '科技风'],
    female: ['清新风', '时尚风', '文艺风', '职场风', '阳光风', '潮流风', '科技风'],
  },
  child: {
    male: ['可爱风', '活泼风', '文静风', '阳光风', '聪明风', '运动风', '创意风'],
    female: ['可爱风', '活泼风', '文静风', '阳光风', '聪明风', '运动风', '创意风'],
  },
  adult: {
    male: ['稳重风', '成熟风', '睿智风', '商务风', '亲和风', '休闲风', '专业风'],
    female: ['优雅风', '知性风', '干练风', '温婉风', '亲和风', '休闲风', '专业风'],
  },
  senior: {
    male: ['慈祥风', '睿智风', '儒雅风', '乐观风', '休闲风', '传统风', '优雅风'],
    female: ['慈祥风', '睿智风', '儒雅风', '乐观风', '休闲风', '传统风', '优雅风'],
  },
};

/**
 * 风格中文 → 文件名后缀映射
 */
const STYLE_FILENAME_MAP: Record<string, Record<string, string>> = {
  young: {
    清新风: 'fresh',
    时尚风: 'fashion',
    文艺风: 'literary',
    职场风: 'professional',
    阳光风: 'sunny',
    潮流风: 'trendy',
    科技风: 'tech',
  },
  child: {
    可爱风: 'cute',
    活泼风: 'active',
    文静风: 'gentle',
    阳光风: 'sunny',
    聪明风: 'scholarly',
    运动风: 'energetic',
    创意风: 'creative',
  },
  adult: {
    稳重风: 'stable',
    成熟风: 'mature',
    睿智风: 'wise',
    商务风: 'business',
    亲和风: 'charming',
    休闲风: 'casual',
    专业风: 'professional',
    优雅风: 'elegant',
    知性风: 'intellectual',
    干练风: 'capable',
    温婉风: 'gentle',
  },
  senior: {
    慈祥风: 'kind',
    睿智风: 'wise',
    儒雅风: 'scholarly',
    乐观风: 'optimistic',
    休闲风: 'casual',
    传统风: 'traditional',
    优雅风: 'elegant',
  },
};

/**
 * 从名字推断性别（简单规则：无法推断时返回 undefined）
 */
function inferGenderFromName(name: string): 'male' | 'female' | undefined {
  // 女性网络昵称特征优先
  const femaleNickPatterns = [
    '酱',
    '子',
    '酱☆',
    '妹妹',
    '小姐姐',
    '美美',
    '花花',
    '糖',
    '甜',
    '软',
    '萌',
    '喵',
  ];
  for (const p of femaleNickPatterns) {
    if (name.includes(p)) return 'female';
  }

  const lastChar = name.slice(-1);
  // 常见女性名字尾字
  const femaleEndings = [
    '娜',
    '婷',
    '丽',
    '芳',
    '秀',
    '玲',
    '燕',
    '梅',
    '雪',
    '慧',
    '娟',
    '艳',
    '萍',
    '霞',
    '兰',
    '洁',
    '雅',
    '倩',
    '璐',
    '瑶',
    '琳',
    '怡',
    '欣',
    '蕾',
    '茜',
    '薇',
    '菲',
    '媛',
    '晶',
    '敏',
    '静',
    '雯',
    '莹',
    '彤',
    '涵',
    '韵',
    '舒',
    '妮',
    '梦',
    '琪',
    '诗',
    '思',
    '艺',
    '月',
    '云',
    '蕊',
    '莎',
    '丹',
  ];
  const maleEndings = [
    '伟',
    '强',
    '磊',
    '军',
    '洋',
    '勇',
    '杰',
    '涛',
    '超',
    '明',
    '辉',
    '刚',
    '健',
    '俊',
    '峰',
    '建',
    '华',
    '文',
    '斌',
    '宇',
    '浩',
    '凯',
    '龙',
    '波',
    '鹏',
    '飞',
    '鑫',
    '毅',
    '林',
    '海',
    '博',
    '睿',
    '晨',
    '轩',
    '昊',
    '哲',
    '翔',
    '航',
    '旭',
    '天',
  ];

  if (femaleEndings.includes(lastChar)) return 'female';
  if (maleEndings.includes(lastChar)) return 'male';
  return undefined;
}

/**
 * 获取头像路径
 * 优先级：1. profile.avatar（手动设置） 2. 根据属性自动匹配 3. 默认头像
 */
export function getAvatarPath(profile: Partial<PersonProfile> & { name: string }): string {
  // 1. 如果手动设置了 avatar，优先使用
  if (profile.avatar) return profile.avatar;

  const agePrefix = AGE_GROUP_MAP[profile.ageGroup || ''] || 'young';
  const gender = profile.gender || inferGenderFromName(profile.name) || 'male';

  // 2. 根据 styleTag 匹配风格
  let styleSuffix = 'fresh'; // 默认风格
  const styleMap = STYLE_FILENAME_MAP[agePrefix];
  if (profile.styleTag && styleMap && styleMap[profile.styleTag]) {
    styleSuffix = styleMap[profile.styleTag];
  } else {
    // 没有 styleTag 时，用名字的 hash 来稳定分配一个风格
    const hash = profile.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const tags =
      STYLE_TAGS[agePrefix]?.[gender] || STYLE_TAGS[agePrefix]?.male || STYLE_TAGS.young.male;
    const randomTag = tags[hash % tags.length];
    styleSuffix = styleMap[randomTag] || 'fresh';
  }

  return `/avatars/${agePrefix}-${gender}-${styleSuffix}.png`;
}

/**
 * 根据年龄段和性别获取可用的风格标签列表
 */
export function getStyleTagsForAgeGroup(ageGroup: string, gender?: string): string[] {
  const prefix = AGE_GROUP_MAP[ageGroup] || 'young';
  const g = gender || 'male';
  return STYLE_TAGS[prefix]?.[g] || STYLE_TAGS[prefix]?.male || STYLE_TAGS.young.male;
}
