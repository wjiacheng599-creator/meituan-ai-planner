import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sun,
  Wind,
  Droplets,
  Thermometer,
  Sparkles,
  Umbrella,
  Eye,
  MapPin,
  ShieldCheck,
  Route,
  ChevronDown,
  X,
} from 'lucide-react';
import { WeatherIcon } from './WeatherIcons';
import { setManualCity, clearManualCity } from '../../services/apiAdapter';

export interface WeatherCardData {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  wind: string;
  high: number;
  low: number;
  advice: string;
}

const weatherConfig: Record<
  string,
  { iconName: string; gradient: string; accent: string; bgGradient: string }
> = {
  晴: {
    iconName: 'clear-day',
    gradient: 'from-[#3b82f6] via-[#60a5fa] to-[#93c5fd]',
    accent: 'text-white',
    bgGradient: 'from-sky-100 via-amber-50 to-yellow-100',
  },
  多云: {
    iconName: 'partly-cloudy-day',
    gradient: 'from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8]',
    accent: 'text-slate-800',
    bgGradient: 'from-slate-100 via-gray-100 to-blue-50',
  },
  阴: {
    iconName: 'overcast',
    gradient: 'from-[#94a3b8] via-[#64748b] to-[#475569]',
    accent: 'text-white',
    bgGradient: 'from-gray-200 via-slate-200 to-zinc-200',
  },
  雨: {
    iconName: 'rain',
    gradient: 'from-[#6366f1] via-[#4f46e5] to-[#4338ca]',
    accent: 'text-white',
    bgGradient: 'from-indigo-100 via-blue-100 to-indigo-50',
  },
  小雨: {
    iconName: 'drizzle',
    gradient: 'from-[#818cf8] via-[#6366f1] to-[#4f46e5]',
    accent: 'text-white',
    bgGradient: 'from-indigo-100 via-blue-100 to-purple-50',
  },
  雷: {
    iconName: 'thunderstorms',
    gradient: 'from-[#6b7280] via-[#374151] to-[#1f2937]',
    accent: 'text-white',
    bgGradient: 'from-gray-200 via-slate-200 to-gray-300',
  },
  雪: {
    iconName: 'snow',
    gradient: 'from-[#bae6fd] via-[#7dd3fc] to-[#38bdf8]',
    accent: 'text-slate-800',
    bgGradient: 'from-blue-50 via-sky-100 to-cyan-100',
  },
  雾: {
    iconName: 'fog',
    gradient: 'from-[#cbd5e1] via-[#94a3b8] to-[#64748b]',
    accent: 'text-slate-800',
    bgGradient: 'from-gray-100 via-slate-100 to-zinc-100',
  },
};

function getWeatherConfig(condition: string) {
  for (const [key, config] of Object.entries(weatherConfig)) {
    if (condition.includes(key)) return config;
  }
  return {
    iconName: 'clear-day',
    gradient: 'from-[#f59e0b] via-[#fbbf24] to-[#fcd34d]',
    accent: 'text-white',
    bgGradient: 'from-sky-100 via-amber-50 to-yellow-100',
  };
}

const chineseCityAliases: Record<string, string> = {
  beijing: '北京',
  shanghai: '上海',
  guangzhou: '广州',
  shenzhen: '深圳',
  hangzhou: '杭州',
  nanjing: '南京',
  suzhou: '苏州',
  chengdu: '成都',
  chongqing: '重庆',
  wuhan: '武汉',
  xian: '西安',
  "xi'an": '西安',
  tianjin: '天津',
  qingdao: '青岛',
  changsha: '长沙',
  zhengzhou: '郑州',
  xiamen: '厦门',
  ningbo: '宁波',
  fuzhou: '福州',
  kunming: '昆明',
  sanya: '三亚',
  harbin: '哈尔滨',
  shenyang: '沈阳',
  dali: '大理',
};

function localizeCityName(city: string) {
  if (/[\u4e00-\u9fa5]/.test(city)) return city;
  return chineseCityAliases[city.trim().toLowerCase()] || city;
}

function getTemperatureFeel(temp: number) {
  if (temp <= 8) return '偏冷，体感会更明显';
  if (temp <= 16) return '微凉，长时间在户外建议加一层';
  if (temp <= 24) return '体感舒适，适合步行和短途出行';
  if (temp <= 30) return '偏暖，注意补水和防晒';
  return '偏热，尽量避开正午暴晒';
}

function getDressingAdvice(temp: number, condition: string) {
  if (/雨|雪|雷/.test(condition)) return '轻薄外套 + 防水鞋，随身带伞更稳妥';
  if (temp <= 10) return '建议穿针织或卫衣，早晚加外套';
  if (temp <= 18) return '长袖或薄卫衣就够，晚间可加薄外套';
  if (temp <= 26) return '短袖搭轻薄外套，室内外切换更舒服';
  return '短袖或轻薄衬衫即可，注意防晒和补水';
}

function getCommuteAdvice(condition: string, humidity: number) {
  if (/雷|暴雨/.test(condition)) return '优先地铁或网约车，尽量避开积水路段';
  if (/雨/.test(condition)) return '步行距离控制在 10 分钟内更舒适，打车成功率会更高';
  if (/雪|雾/.test(condition)) return '留出更宽松通勤时间，转弯和过街时放慢节奏';
  if (humidity >= 80) return '空气偏闷，室内外切换时记得补水和透气';
  return '适合步行、骑行或常规通勤，不需要特别调整';
}

function getTravelTips(data: WeatherCardData) {
  const hasRainRisk = /雨|雪|雷/.test(data.condition) || data.humidity >= 78;
  return [
    { label: '穿搭', value: getDressingAdvice(data.temp, data.condition) },
    { label: '出行', value: getCommuteAdvice(data.condition, data.humidity) },
    {
      label: '随身物品',
      value: hasRainRisk ? '带折叠伞、纸巾，电子设备注意防水' : '墨镜、纸巾和水杯会更实用',
    },
    {
      label: '适合时段',
      value: data.temp >= 28 ? '更适合上午或傍晚出门' : '全天都可安排外出，午后体感最好',
    },
  ];
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function getHumidityState(humidity: number) {
  if (humidity >= 80) return '偏潮';
  if (humidity >= 55) return '舒适';
  return '偏干';
}

export const WeatherCard = memo(function WeatherCard({
  data,
  onCityChange,
}: {
  data: WeatherCardData;
  onCityChange?: (city: string) => void;
}) {
  const cfg = getWeatherConfig(data.condition);
  const [activePanel, setActivePanel] = useState<'detail' | 'advice' | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const cityLabel = localizeCityName(data.city);
  const travelTips = getTravelTips(data);
  const tempSpan = Math.max(data.high - data.low, 1);
  const tempProgress = clamp(((data.temp - data.low) / tempSpan) * 100, 0, 100);
  const humidityProgress = clamp(data.humidity, 0, 100);

  const hotCities = [
    '北京',
    '上海',
    '广州',
    '深圳',
    '成都',
    '杭州',
    '武汉',
    '西安',
    '重庆',
    '南京',
  ];

  const handleCitySelect = (city: string) => {
    setManualCity(city);
    setShowCityPicker(false);
    setSearchQuery('');
    onCityChange?.(city);
  };

  const handleResetLocation = () => {
    clearManualCity();
    setShowCityPicker(false);
    setSearchQuery('');
    onCityChange?.('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleCitySelect(searchQuery.trim());
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="app-card w-full rounded-[24px] overflow-hidden"
        style={{
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <div className={`bg-gradient-to-br ${cfg.gradient} p-5 relative overflow-hidden`}>
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.15) 0%, transparent 40%)',
            }}
          />
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/8 blur-xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <button
                onClick={() => setShowCityPicker(!showCityPicker)}
                className="flex items-center gap-1.5 mb-3 active:scale-95 transition-transform"
              >
                <MapPin className="w-3.5 h-3.5 text-white/80" />
                <span className="text-[13px] font-bold text-white/80">{cityLabel}</span>
                <ChevronDown className="w-3 h-3 text-white/60" />
              </button>
              <div className="mb-1">
                <WeatherIcon condition={data.condition} size={80} />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-[42px] font-bold text-white leading-none tracking-tight drop-shadow-sm">
                  {data.temp}°
                </div>
                <div className="text-[15px] font-bold text-white/90">{data.condition}</div>
              </div>
            </div>
            <div className="text-right space-y-2 mt-1">
              <div className="flex items-center gap-1.5 bg-white/25 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/20 shadow-inner">
                <Thermometer className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-bold text-white">
                  {data.high}° / {data.low}°
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/25 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/20 shadow-inner">
                <Droplets className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-bold text-white">{data.humidity}%</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/25 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/20 shadow-inner">
                <Wind className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-bold text-white">{data.wind}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div
            className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/70 to-white/40 backdrop-blur-xl px-4 py-3.5"
            style={{
              boxShadow: '0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white"
                style={{
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                }}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="flex-1 text-[13px] font-semibold leading-relaxed text-slate-700">
                {data.advice}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActivePanel((prev) => (prev === 'detail' ? null : 'detail'))}
              className="app-btn-dark flex-1 flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-[11px] font-semibold active:scale-[0.97] transition-transform cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> 详情
            </button>
            <button
              onClick={() => setActivePanel((prev) => (prev === 'advice' ? null : 'advice'))}
              className="app-btn-ghost flex-1 flex items-center justify-center gap-1.5 rounded-[14px] py-2.5 text-[11px] font-semibold active:scale-[0.97] transition-transform cursor-pointer"
            >
              <Umbrella className="w-3.5 h-3.5" /> 出行建议
            </button>
          </div>

          <AnimatePresence initial={false}>
            {activePanel && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="app-card-soft mt-3 rounded-[24px] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[15px] font-bold text-[var(--app-ink)]">
                        {activePanel === 'detail' ? `${cityLabel}天气详情` : `${cityLabel}出行建议`}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-[var(--app-text-soft)]">
                        {cityLabel} · {data.condition} · {data.temp}°
                      </p>
                    </div>
                    <button
                      onClick={() => setActivePanel(null)}
                      className="app-chip-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:scale-95"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {activePanel === 'detail' ? (
                    <div className="space-y-3">
                      <div className="app-card rounded-2xl p-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[13px] font-bold text-[var(--app-text-soft)]">
                            温度走势
                          </span>
                          <span className="text-[13px] font-bold text-[var(--app-ink)]">
                            {data.temp}° 当前
                          </span>
                        </div>
                        <div className="relative pt-5 pb-2">
                          <div className="h-2 rounded-full bg-gradient-to-r from-[#e7edf6] via-[#dce5f1] to-[#d0dae8]" />
                          <div
                            className="absolute top-0 -translate-x-1/2"
                            style={{ left: `${tempProgress}%` }}
                          >
                            <div className="app-btn-dark rounded-full px-2 py-1 text-[10px] font-semibold shadow-lg">
                              {data.temp}°
                            </div>
                            <div className="mx-auto mt-1 h-3 w-px bg-[rgba(20,24,33,0.6)]" />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-[var(--app-text-soft)]">
                            <span>{data.low}° 低温</span>
                            <span>{data.high}° 高温</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="app-card rounded-2xl p-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-bold text-[var(--app-text-soft)]">
                              湿度
                            </span>
                            <span className="text-[15px] font-bold text-[var(--app-ink)]">
                              {data.humidity}%
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-[#e7edf6]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#95a7c5] to-[#7b8eaf]"
                              style={{ width: `${humidityProgress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[11px] font-bold text-[var(--app-text)]">
                            {getHumidityState(data.humidity)}
                          </p>
                        </div>

                        <div className="app-card rounded-2xl p-3.5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-bold text-[var(--app-text-soft)]">
                              风况
                            </span>
                            <span className="text-[15px] font-bold text-[var(--app-ink)]">
                              {data.wind}
                            </span>
                          </div>
                          <div className="flex gap-1.5 mb-2">
                            {[0, 1, 2].map((bar) => (
                              <div
                                key={bar}
                                className={`h-7 flex-1 rounded-full ${bar === 0 ? 'bg-[#dce3ee]' : bar === 1 ? 'bg-[#cfd8e5]' : 'bg-[#e7edf6]'}`}
                              />
                            ))}
                          </div>
                          <p className="text-[11px] font-bold text-[var(--app-text)]">
                            适合常规出行
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {travelTips.map((tip, index) => (
                        <div
                          key={tip.label}
                          className={`rounded-2xl border px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] ${index === 0 ? 'border-[var(--peach-strong)] bg-[linear-gradient(135deg,rgba(255,247,251,0.94)_0%,rgba(255,241,225,0.72)_100%)]' : 'bg-white border-[var(--app-border)]'}`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            {index === 0 ? (
                              <Sparkles className="w-4 h-4 text-[var(--rose-ink)]" />
                            ) : index === 1 ? (
                              <Route className="w-4 h-4 text-[var(--sky-ink)]" />
                            ) : index === 2 ? (
                              <ShieldCheck className="w-4 h-4 text-[var(--mint-ink)]" />
                            ) : (
                              <Sun className="w-4 h-4 text-[var(--peach-ink)]" />
                            )}
                            <span className="text-[13px] font-bold text-gray-500">{tip.label}</span>
                          </div>
                          <p className="text-[13px] font-semibold text-[var(--app-ink)] leading-relaxed">
                            {tip.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showCityPicker && (
            <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[var(--app-text-soft)]">切换城市</span>
                <button
                  onClick={handleResetLocation}
                  className="text-[10px] font-medium text-[var(--app-text)] active:text-[var(--app-ink)]"
                >
                  恢复自动定位
                </button>
              </div>

              <form onSubmit={handleSearchSubmit} className="mb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索任意城市..."
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[13px] text-[var(--app-ink)] placeholder:text-[var(--app-text-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--peach-strong)] focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!searchQuery.trim()}
                    className="app-btn-dark px-3 py-2 rounded-lg text-[13px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    搜索
                  </button>
                </div>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {hotCities.map((city) => (
                  <button
                    key={city}
                    onClick={() => handleCitySelect(city)}
                    className="px-2.5 py-1 rounded-full bg-[var(--app-bg)] border border-[var(--app-border)] text-[11px] font-medium text-[var(--app-ink)] active:bg-[var(--app-bg-soft)] active:scale-95 transition-all"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
});
