import type { Activity } from './ai';
import { fetchPOIImage } from './poiImageService';

const TEXT_TO_IMAGE_BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image';

const TOPIC_PROMPTS: Array<[RegExp, string[]]> = [
  [
    /(咖啡|下午茶|手冲|奶茶|拿铁|卡布奇诺)/,
    [
      'A cozy artisan coffee shop interior, warm lighting, latte art on wooden table, aesthetic cafe atmosphere, soft bokeh background',
      'Beautiful coffee cup with latte art on marble counter, pastry beside it, warm morning light, minimalist cafe design',
    ],
  ],
  [
    /(甜品|蛋糕|巴斯克|马卡龙|冰淇淋|布丁)/,
    [
      'Elegant dessert display, artisan cakes and pastries, soft pink and cream tones, bakery showcase, professional food photography',
      'Beautiful slice of cheesecake on a plate, berries garnish, warm cafe lighting, shallow depth of field',
    ],
  ],
  [
    /(火锅|麻辣烫|串串)/,
    [
      'Chinese hot pot with boiling broth, fresh ingredients around, steam rising, warm restaurant lighting, top-down food photography',
      'Sichuan spicy hot pot, colorful ingredients, chili peppers, cozy restaurant setting, appetizing food photography',
    ],
  ],
  [
    /(烧烤|烤肉|BBQ)/,
    [
      'Grilled meat on charcoal barbecue, smoke rising, colorful side dishes, outdoor dining atmosphere, food photography',
      'Korean BBQ restaurant table with sizzling meat on grill, side dishes, warm lighting, appetizing scene',
    ],
  ],
  [
    /(川菜|粤菜|湘菜|日料|西餐|餐厅|聚餐|美食)/,
    [
      'Beautiful restaurant interior with elegant table setting, warm ambient lighting, fine dining atmosphere',
      'Delicious Chinese cuisine dishes on round table, steam rising, warm restaurant ambiance, food photography',
    ],
  ],
  [
    /(外卖|轻食|炸鸡|黄焖鸡|汉堡|快餐)/,
    [
      'Colorful takeout food spread on table, various cuisines, bright and appetizing, modern food photography',
      'Fresh healthy poke bowl with colorful ingredients, avocado, rice, modern food styling, bright lighting',
    ],
  ],
  [
    /(展|艺术|美术馆|博物馆|画廊)/,
    [
      'Modern art gallery interior, white walls with colorful paintings, visitors walking, natural light from skylight',
      'Contemporary museum exhibition space, dramatic lighting, art installations, architectural photography',
    ],
  ],
  [
    /(剧院|演出|话剧|音乐|livehouse)/,
    [
      'Concert hall interior with dramatic stage lighting, audience silhouettes, purple and blue lights, live performance',
      'Theater stage with warm spotlights, red velvet curtains, elegant performance venue, atmospheric photography',
    ],
  ],
  [
    /(酒吧|夜宵|深夜)/,
    [
      'Stylish cocktail bar interior, neon lighting, bottles on shelf, moody atmosphere, nightlife photography',
      'Cozy bar counter with craft cocktails, warm amber lighting, brick wall background, evening atmosphere',
    ],
  ],
  [
    /(徒步|露营|citywalk|散步|漫步|公园|郊野|景点)/,
    [
      'Beautiful city park with walking paths, green trees, sunlight through leaves, people strolling, urban nature',
      'Scenic hiking trail through lush green forest, morning mist, sunlight rays, peaceful nature landscape',
    ],
  ],
  [
    /(亲子|带娃|乐园|动物|农场)/,
    [
      'Happy family at amusement park, colorful rides, bright sunny day, joyful atmosphere, lifestyle photography',
      'Children playing in a beautiful park, green grass, trees, warm afternoon light, family lifestyle',
    ],
  ],
  [
    /(电影|影院|看片)/,
    [
      'Modern cinema interior, red seats, big screen, popcorn, warm ambient lighting, entertainment photography',
      'Movie theater with audience watching film, dramatic screen glow, cozy atmosphere, cinematic mood',
    ],
  ],
  [
    /(购物|商场|逛街|买买买)/,
    [
      'Modern shopping mall interior, bright lights, elegant storefronts, people walking, lifestyle photography',
      'Boutique shop display window, stylish products, warm lighting, retail atmosphere, urban lifestyle',
    ],
  ],
];

function generateImageUrl(prompt: string): string {
  return `${TEXT_TO_IMAGE_BASE}?prompt=${encodeURIComponent(prompt)}&image_size=landscape_4_3`;
}

function hashSeed(seed: string): number {
  return seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function pickPrompt(prompts: string[], seed: string): string {
  return prompts[hashSeed(seed) % prompts.length];
}

function getImageForTopic(topic: string, seed: string): string {
  const text = topic.toLowerCase();
  for (const [regex, prompts] of TOPIC_PROMPTS) {
    if (regex.test(text)) {
      return generateImageUrl(pickPrompt(prompts, seed));
    }
  }
  return generateImageUrl(
    'Beautiful urban lifestyle scene, warm lighting, modern city, aesthetic photography, soft colors'
  );
}

export function getRealImageByTopic(topic: string, seed: string) {
  return getImageForTopic(topic, seed);
}

export function getActivityImage(
  activity: Pick<Activity, 'id' | 'title' | 'description' | 'type' | 'tags'>,
  index = 0
) {
  return getRealImageByTopic(
    `${activity.type} ${activity.title} ${activity.description} ${(activity.tags || []).join(' ')}`,
    `${activity.id}_${index}`
  );
}

export function getFeedImage(topic: string, seed: string) {
  return getRealImageByTopic(topic, seed);
}

export function getMerchantGalleryImages(
  activity: Pick<Activity, 'id' | 'title' | 'description' | 'type' | 'tags' | 'poiPhotos' | 'imageUrl'>
) {
  const realPhotos = activity.poiPhotos || [];
  const mainImage = activity.imageUrl;
  const fallback = [
    getActivityImage(activity, 0),
    getRealImageByTopic(`${activity.title} 环境 空间`, `${activity.id}_space`),
    getRealImageByTopic(`${activity.title} 细节 菜品`, `${activity.id}_detail`),
  ];

  const result: string[] = [];
  if (mainImage) result.push(mainImage);
  result.push(...realPhotos.filter(url => url !== mainImage));
  for (let i = result.length; i < 3; i++) {
    result.push(fallback[i] || fallback[0]);
  }
  return result.slice(0, 3);
}

export async function fetchActivityImageUrl(
  activity: Pick<Activity, 'id' | 'title' | 'description' | 'type' | 'tags'>,
  city?: string,
  index = 0
): Promise<string> {
  const realUrl = await fetchPOIImage(activity.title, city);
  return realUrl || getActivityImage(activity, index);
}

export async function fetchFeedImageUrl(
  topic: string,
  seed: string,
  city?: string
): Promise<string> {
  const name = topic.split(/\s+/)[0] || topic;
  const realUrl = await fetchPOIImage(name, city);
  return realUrl || getFeedImage(topic, seed);
}
