export interface DriverInfo {
  name: string;
  rating: number;
  trips: number;
  plate: string;
  vehicleModel: string;
  vehicleColor: string;
}

const SURNAMES = [
  '王',
  '李',
  '张',
  '刘',
  '陈',
  '杨',
  '赵',
  '黄',
  '周',
  '吴',
  '徐',
  '孙',
  '胡',
  '朱',
  '高',
  '林',
  '何',
  '郭',
  '马',
  '罗',
];
const NAME_CHARS = '伟芳秀英敏静丽强磊洋勇艳杰娟涛明超秀华建华建国建军志明海兵';

const PLATE_CITIES = ['京', '沪', '粤', '浙', '苏', '川', '鄂', '湘', '豫', '鲁'];
const PLATE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PLATE_DIGITS = '0123456789';

const VEHICLES_ECONOMY = [
  { model: '丰田卡罗拉', color: '白色' },
  { model: '大众朗逸', color: '银色' },
  { model: '日产轩逸', color: '白色' },
  { model: '本田凌派', color: '灰色' },
  { model: '比亚迪秦', color: '白色' },
];

const VEHICLES_COMFORT = [
  { model: '丰田凯美瑞', color: '黑色' },
  { model: '本田雅阁', color: '白色' },
  { model: '大众帕萨特', color: '黑色' },
  { model: '别克君威', color: '灰色' },
];

const VEHICLES_BUSINESS = [
  { model: '别克GL8', color: '黑色' },
  { model: '丰田埃尔法', color: '白色' },
  { model: '奔驰威霆', color: '黑色' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePlate(): string {
  const city = pick(PLATE_CITIES);
  const letter = pick(Array.from(PLATE_CHARS));
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += Math.random() < 0.7 ? pick(Array.from(PLATE_DIGITS)) : pick(Array.from(PLATE_CHARS));
  }
  return `${city}·${letter}${suffix}`;
}

function generateDriverName(): string {
  return (
    pick(SURNAMES) +
    pick(Array.from(NAME_CHARS)) +
    (Math.random() < 0.5 ? pick(Array.from(NAME_CHARS)) : '')
  );
}

function generateRating(): number {
  return Math.round((4.2 + Math.random() * 0.8) * 10) / 10;
}

export function generateDriverInfo(tier: string = 'economy'): DriverInfo {
  const vehicles =
    tier === 'business'
      ? VEHICLES_BUSINESS
      : tier === 'comfort'
        ? VEHICLES_COMFORT
        : VEHICLES_ECONOMY;
  const vehicle = pick(vehicles);
  return {
    name: generateDriverName(),
    rating: generateRating(),
    trips: randInt(800, 12000),
    plate: generatePlate(),
    vehicleModel: vehicle.model,
    vehicleColor: vehicle.color,
  };
}

export async function dispatchTaxi(input: {
  from: string;
  to: string;
  time: string;
  people: number;
  tierLabel?: string;
  tier?: string;
  estimatedFare?: number;
  estimatedWaitMinutes?: number;
}): Promise<{ success: boolean; message: string; driver?: DriverInfo }> {
  const randomSuccess = Math.random() < 0.98;
  if (!randomSuccess) {
    return { success: false, message: `当前车辆紧张，${input.from} 附近暂时无法立即叫车` };
  }
  const orderId = 'TX' + Date.now().toString(36).toUpperCase().slice(-8);
  const driver = generateDriverInfo(input.tier || 'economy');
  return {
    success: true,
    message: `已预约${input.tierLabel || '车辆'}，约 ${input.estimatedWaitMinutes || 4} 分钟到达，订单号：${orderId}`,
    driver,
  };
}
