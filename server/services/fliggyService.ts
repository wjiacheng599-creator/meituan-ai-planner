import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TIMEOUT_MS = 15000;

export interface FliggyHotel {
  name: string;
  address: string;
  price: string;
  star: string;
  score: string;
  scoreDesc: string;
  brandName: string | null;
  mainPic: string;
  detailUrl: string;
  latitude: string;
  longitude: string;
  interestsPoi: string;
}

export interface FliggyPOI {
  name: string;
  address: string;
  id: string;
  mainPic: string;
  jumpUrl: string;
  ticketInfo?: {
    price: string | null;
    ticketName: string;
    priceDate: string;
  };
}

export interface FliggySearchResult<T> {
  items: T[];
  systemMessage?: string;
}

async function runFlyaiCommand(args: string): Promise<any> {
  try {
    const { stdout } = await execAsync(`flyai ${args} 2>/dev/null`, {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } catch (err: any) {
    console.warn(`[fliggyService] flyai 命令失败: ${args}`, err.message);
    return null;
  }
}

export async function searchHotels(params: {
  city: string;
  keyword?: string;
  poiName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  maxPrice?: number;
  stars?: string;
  sort?: string;
}): Promise<FliggySearchResult<FliggyHotel>> {
  const parts = [`--dest-name "${params.city}"`];
  if (params.keyword) parts.push(`--key-words "${params.keyword}"`);
  if (params.poiName) parts.push(`--poi-name "${params.poiName}"`);
  if (params.checkInDate) parts.push(`--check-in-date ${params.checkInDate}`);
  if (params.checkOutDate) parts.push(`--check-out-date ${params.checkOutDate}`);
  if (params.maxPrice) parts.push(`--max-price ${params.maxPrice}`);
  if (params.stars) parts.push(`--hotel-stars "${params.stars}"`);
  if (params.sort) parts.push(`--sort ${params.sort}`);

  const raw = await runFlyaiCommand(`search-hotel ${parts.join(' ')}`);
  if (!raw || raw.status !== 0) {
    return { items: [], systemMessage: raw?.systemMessage };
  }

  const items: FliggyHotel[] = (raw.data?.itemList || []).map((item: any) => ({
    name: item.name || '',
    address: item.address || '',
    price: item.price || '',
    star: item.star || '',
    score: item.score || '',
    scoreDesc: item.scoreDesc || '',
    brandName: item.brandName || null,
    mainPic: item.mainPic || '',
    detailUrl: item.detailUrl || '',
    latitude: item.latitude || '',
    longitude: item.longitude || '',
    interestsPoi: item.interestsPoi || '',
  }));

  return { items, systemMessage: raw.systemMessage };
}

export async function searchPOI(params: {
  city: string;
  keyword?: string;
  category?: string;
  level?: number;
}): Promise<FliggySearchResult<FliggyPOI>> {
  const parts = [`--city-name "${params.city}"`];
  if (params.keyword) parts.push(`--keyword "${params.keyword}"`);
  if (params.category) parts.push(`--category "${params.category}"`);
  if (params.level) parts.push(`--poi-level ${params.level}`);

  const raw = await runFlyaiCommand(`search-poi ${parts.join(' ')}`);
  if (!raw || raw.status !== 0) {
    return { items: [], systemMessage: raw?.systemMessage };
  }

  const items: FliggyPOI[] = (raw.data?.itemList || []).map((item: any) => ({
    name: item.name || '',
    address: item.address || '',
    id: item.id || '',
    mainPic: item.mainPic || '',
    jumpUrl: item.jumpUrl || '',
    ticketInfo: item.ticketInfo ? {
      price: item.ticketInfo.price || null,
      ticketName: item.ticketInfo.ticketName || '',
      priceDate: item.ticketInfo.priceDate || '',
    } : undefined,
  }));

  return { items, systemMessage: raw.systemMessage };
}

export async function keywordSearch(query: string): Promise<FliggySearchResult<any>> {
  const raw = await runFlyaiCommand(`keyword-search --query "${query}"`);
  if (!raw || raw.status !== 0) {
    return { items: [], systemMessage: raw?.systemMessage };
  }

  const items = (raw.data?.itemList || []).map((item: any) => ({
    title: item.info?.title || '',
    price: item.info?.price || '',
    picUrl: item.info?.picUrl || '',
    jumpUrl: item.info?.jumpUrl || '',
    star: item.info?.star || '',
    scoreDesc: item.info?.scoreDesc || '',
    tags: item.info?.tags || [],
  }));

  return { items, systemMessage: raw.systemMessage };
}
