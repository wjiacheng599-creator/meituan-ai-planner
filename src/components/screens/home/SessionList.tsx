import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, CircleAlert, Lightbulb, Star as StarIcon } from 'lucide-react';
import type { Plan, Activity } from '../../../services/ai';
import type {
  WeatherCardData,
  RestaurantCardData,
  DeliveryCardData,
  TicketCardData,
  CouponCardData,
} from '../../cards/ServiceCards';
import type { TaxiCardData } from '../../cards/TaxiCard';
import {
  WeatherCard,
  RestaurantCarousel,
  DeliveryCarousel,
  TicketCarousel,
  CouponList,
} from '../../cards/ServiceCards';
import { TaxiCard } from '../../cards/TaxiCard';
import PipelineProgress, { type PipelineStep } from './PipelineProgress';
import SavedPlans from './SavedPlans';
import RequirementConfirmCard from './RequirementConfirmCard';
import type { RequirementData } from './RequirementConfirmCard';
import { fetchWeather } from '../../../services/ai';
import XiaoMeiAvatar from '../../mascot/XiaoMeiAvatar';

export interface ChatMessage {
  id: string;
  type:
    | 'user'
    | 'assistant'
    | 'plan'
    | 'comparison'
    | 'weather'
    | 'restaurant'
    | 'delivery'
    | 'ticket'
    | 'coupon'
    | 'taxi'
    | 'pipeline';
  content?: string;
  sourceQuery?: string;
  requirementQuery?: string;
  parsedRequirements?: import('../../../services/ai/intent').ParsedRequirements;
  suggestedPrompts?: string[];
  plan?: Plan;
  comparisonData?: import('../../../services/ai').CompareResult;
  weatherData?: WeatherCardData;
  restaurantData?: RestaurantCardData[];
  deliveryData?: DeliveryCardData[];
  ticketData?: TicketCardData[];
  couponData?: CouponCardData[];
  taxiData?: TaxiCardData;
  taxiBookingStatus?: 'idle' | 'booked';
  pipelineSteps?: PipelineStep[];
  pipelineTitle?: string;
  pipelineSummary?: string;
  pipelineCollapsed?: boolean;
}

interface SessionListProps {
  messages: ChatMessage[];
  onViewActivity: (act: Activity) => void;
  onViewRestaurant?: (item: RestaurantCardData) => void;
  onOpenRestaurantFinder?: (items: RestaurantCardData[], keyword: string) => void;
  onViewDeliveryItem?: (item: DeliveryCardData) => void;
  onViewTicketItem?: (item: TicketCardData) => void;
  onOpenServiceFinder?: (
    mode: 'delivery' | 'ticket' | 'coupon',
    items: DeliveryCardData[] | TicketCardData[] | CouponCardData[],
    keyword: string
  ) => void;
  onViewItinerary: (plan: Plan) => void;
  onSavePlan: (plan: Plan) => void;
  onUpdateWeatherMessage: (msgId: string, data: WeatherCardData) => void;
  onRequirementConfirm?: (data: RequirementData, originalQuery: string) => void;
  onRequirementSkip?: (originalQuery: string) => void;
  onSuggestedPrompt?: (prompt: string) => void;
  onBookTaxi?: (data: TaxiCardData) => void;
  onOpenTaxiFinder?: (data: TaxiCardData) => void;
  onUpdateTaxiMessage?: (msgId: string, data: TaxiCardData, status?: 'idle' | 'booked') => void;
}

const BotAvatar = ({
  children,
  maxW = 'max-w-[90%]',
}: {
  children: React.ReactNode;
  maxW?: string;
}) => (
  <div className={`flex items-start gap-2.5 ${maxW} w-full mt-2`}>
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--brand-soft)] bg-[rgba(255,244,191,0.62)] shadow-inner">
      <XiaoMeiAvatar mood="smile" size="w-7 h-7" />
    </div>
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      <span className="ml-2 text-[13px] font-semibold text-[var(--app-text)]">小美 AI助手</span>
      {children}
    </div>
  </div>
);

const SessionList = React.memo(function SessionList({
  messages,
  onViewActivity,
  onViewRestaurant,
  onOpenRestaurantFinder,
  onViewDeliveryItem,
  onViewTicketItem,
  onOpenServiceFinder,
  onViewItinerary,
  onSavePlan,
  onUpdateWeatherMessage,
  onRequirementConfirm,
  onRequirementSkip,
  onSuggestedPrompt,
  onBookTaxi,
  onOpenTaxiFinder,
  onUpdateTaxiMessage,
}: SessionListProps) {
  return (
    <div className="flex flex-col pb-2 shrink-0">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.type === 'user' ? 'items-end mb-3' : 'items-start mb-5'}`}
          >
            {msg.type === 'user' && (
              <div className="app-card max-w-[85%] rounded-[24px] rounded-tr-[8px] px-4 py-2.5 text-[var(--app-ink)]">
                <span className="text-[13px] font-semibold leading-relaxed">{msg.content}</span>
              </div>
            )}

            {msg.type === 'assistant' && !msg.requirementQuery && !msg.suggestedPrompts && (
              <BotAvatar>
                <div className="app-card rounded-[24px] rounded-tl-[8px] px-4 py-3 text-[var(--app-ink)]">
                  <span className="text-[13px] font-bold leading-relaxed whitespace-pre-line">
                    {msg.content}
                  </span>
                </div>
              </BotAvatar>
            )}

            {/* AI 建议的快捷回复 */}
            {msg.type === 'assistant' &&
              msg.suggestedPrompts &&
              msg.suggestedPrompts.length > 0 && (
                <BotAvatar>
                  <div className="flex flex-wrap gap-2">
                    {msg.suggestedPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => onSuggestedPrompt?.(prompt)}
                        className="px-4 py-2 rounded-full text-[13px] font-bold bg-[var(--brand-soft)] text-[var(--brand-ink)] border border-[var(--brand)]/30 hover:bg-[var(--brand)]/20 active:scale-95 transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </BotAvatar>
              )}

            {msg.type === 'assistant' && msg.requirementQuery && (
              <BotAvatar maxW="max-w-[95%]">
                <RequirementConfirmCard
                  initialData={
                    msg.parsedRequirements
                      ? {
                          date: msg.parsedRequirements.date,
                          days: msg.parsedRequirements.days,
                          people: msg.parsedRequirements.people,
                          hasChildren: msg.parsedRequirements.hasChildren,
                          hasElderly: msg.parsedRequirements.hasElderly,
                          budget: msg.parsedRequirements.budget,
                          preferences: msg.parsedRequirements.preferences,
                        }
                      : undefined
                  }
                  missingFields={msg.parsedRequirements?.missingFields}
                  onConfirm={(data) => onRequirementConfirm?.(data, msg.requirementQuery!)}
                  onSkip={() => onRequirementSkip?.(msg.requirementQuery!)}
                />
              </BotAvatar>
            )}

            {msg.type === 'pipeline' && msg.pipelineSteps && (
              <PipelineProgress
                title={msg.pipelineTitle}
                summary={msg.pipelineSummary}
                collapsed={msg.pipelineCollapsed}
                steps={msg.pipelineSteps}
              />
            )}

            {msg.type === 'weather' && msg.weatherData && (
              <BotAvatar>
                <WeatherCard
                  data={msg.weatherData}
                  onCityChange={async (city) => {
                    const newWeather = await fetchWeather(city);
                    const highStr =
                      newWeather.tempRange.split('~')[1]?.trim() || String(newWeather.temp + 3);
                    const lowStr =
                      newWeather.tempRange.split('~')[0]?.replace('°', '').trim() ||
                      String(newWeather.temp - 3);
                    const weatherCardData: WeatherCardData = {
                      city: newWeather.city,
                      temp: newWeather.temp,
                      condition: newWeather.condition,
                      humidity: newWeather.humidity,
                      wind: '微风',
                      high: parseInt(highStr) || newWeather.temp + 3,
                      low: parseInt(lowStr) || newWeather.temp - 3,
                      advice: newWeather.advice,
                    };
                    onUpdateWeatherMessage(msg.id, weatherCardData);
                  }}
                />
              </BotAvatar>
            )}

            {msg.type === 'restaurant' && msg.restaurantData && (
              <BotAvatar maxW="max-w-[95%]">
                <RestaurantCarousel
                  data={msg.restaurantData}
                  onItemAction={(item) => onViewRestaurant?.(item)}
                  onViewMore={(items) =>
                    onOpenRestaurantFinder?.(items, msg.sourceQuery || '找餐厅')
                  }
                />
              </BotAvatar>
            )}

            {msg.type === 'delivery' && msg.deliveryData && (
              <BotAvatar maxW="max-w-[95%]">
                <DeliveryCarousel
                  data={msg.deliveryData}
                  onItemAction={(item) => onViewDeliveryItem?.(item)}
                  onViewMore={(items) =>
                    onOpenServiceFinder?.('delivery', items, msg.sourceQuery || '点外卖')
                  }
                />
              </BotAvatar>
            )}

            {msg.type === 'ticket' && msg.ticketData && (
              <BotAvatar maxW="max-w-[95%]">
                <TicketCarousel
                  data={msg.ticketData}
                  onItemAction={(item) => onViewTicketItem?.(item)}
                  onViewMore={(items) =>
                    onOpenServiceFinder?.('ticket', items, msg.sourceQuery || '找活动')
                  }
                />
              </BotAvatar>
            )}

            {msg.type === 'coupon' && msg.couponData && (
              <BotAvatar>
                <CouponList
                  data={msg.couponData}
                  onViewMore={(items) =>
                    onOpenServiceFinder?.('coupon', items, msg.sourceQuery || '领优惠')
                  }
                />
              </BotAvatar>
            )}

            {msg.type === 'taxi' && msg.taxiData && (
              <BotAvatar maxW="max-w-[95%]">
                <TaxiCard
                  data={msg.taxiData}
                  bookingStatus={msg.taxiBookingStatus}
                  onBookTaxi={(data) => onOpenTaxiFinder?.(data)}
                  onDestinationChange={(newData) => onUpdateTaxiMessage?.(msg.id, newData)}
                />
              </BotAvatar>
            )}

            {msg.type === 'comparison' && msg.comparisonData && (
              <BotAvatar>
                <div className="app-card flex flex-col overflow-hidden rounded-[24px] p-4">
                  <div className="flex items-center gap-2 mb-4 pl-1">
                    <Sparkles className="w-4 h-4 text-[var(--app-text)]" strokeWidth={2.5} />
                    <span className="text-[15px] font-bold text-[var(--app-ink)]">AI 对比分析</span>
                  </div>

                  <div
                    className={`flex bg-[var(--app-card-soft)] rounded-2xl p-1.5 gap-1 mb-4 ${msg.comparisonData.items.length > 2 ? 'overflow-x-auto scrollbar-none' : ''}`}
                  >
                    {msg.comparisonData.items.map((item, idx) => {
                      const gradients = [
                        'from-slate-100 to-slate-200',
                        'from-[#eef2f9] to-[#e7edf7]',
                        'from-[#edf2fb] to-[#e3eaf6]',
                        'from-[#f5f7fb] to-[#e9eef7]',
                      ];
                      return (
                        <div
                          key={item.name}
                          className="flex-1 min-w-[100px] flex flex-col items-center justify-center p-3 bg-white rounded-[12px] shadow-sm border border-[var(--app-border)]/80"
                        >
                          <div
                            className={`w-12 h-12 rounded-full overflow-hidden mb-2 bg-gradient-to-br ${gradients[idx % gradients.length]}`}
                          />
                          <span className="mb-0.5 line-clamp-1 text-center text-[13px] font-bold text-[var(--app-ink)]">
                            {item.name}
                          </span>
                          <span className="flex items-center gap-0.5 rounded-[4px] bg-[var(--app-card-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--app-text)]">
                            <StarIcon className="w-3 h-3 fill-[var(--app-text-soft)] text-[var(--app-text-soft)]" />{' '}
                            {item.rating}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center text-[13px]">
                      {msg.comparisonData.items.map((item, idx) => (
                        <React.Fragment key={item.name}>
                          {idx > 0 && idx === Math.floor(msg.comparisonData!.items.length / 2) && (
                            <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                              人均
                            </div>
                          )}
                          <div className="flex-1 text-center font-bold text-[var(--app-ink)]">
                            {item.priceRange}
                          </div>
                        </React.Fragment>
                      ))}
                      {msg.comparisonData.items.length === 2 && (
                        <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                          人均
                        </div>
                      )}
                    </div>
                    <div className="h-[1px] w-full bg-[var(--app-border)]" />
                    <div className="flex items-start text-[13px]">
                      {msg.comparisonData.items.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && idx === Math.floor(msg.comparisonData!.items.length / 2) && (
                            <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                              亮点
                            </div>
                          )}
                          <div className="flex-1 text-center font-bold text-[var(--app-text)] leading-tight">
                            {item.highlights.map((h, i) => (
                              <div
                                key={`highlight-${i}`}
                                className="flex items-center justify-center gap-0.5"
                              >
                                <CheckCircle2 className="w-3 h-3 text-[var(--app-text-soft)] shrink-0" />{' '}
                                {h}
                              </div>
                            ))}
                          </div>
                        </React.Fragment>
                      ))}
                      {msg.comparisonData.items.length === 2 && (
                        <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                          亮点
                        </div>
                      )}
                    </div>
                    <div className="h-[1px] w-full bg-[var(--app-border)]" />
                    <div className="flex items-start text-[13px]">
                      {msg.comparisonData.items.map((item, idx) => (
                        <React.Fragment key={item.name}>
                          {idx > 0 && idx === Math.floor(msg.comparisonData!.items.length / 2) && (
                            <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                              注意
                            </div>
                          )}
                          <div className="flex-1 text-center font-bold text-[var(--app-text)] leading-tight">
                            {item.drawbacks.map((d, i) => (
                              <div
                                key={`drawback-${i}`}
                                className="flex items-center justify-center gap-0.5"
                              >
                                <CircleAlert className="w-3 h-3 text-[var(--app-text-soft)] shrink-0" />{' '}
                                {d}
                              </div>
                            ))}
                          </div>
                        </React.Fragment>
                      ))}
                      {msg.comparisonData.items.length === 2 && (
                        <div className="w-16 text-center text-[var(--app-text-soft)] font-bold text-[10px]">
                          注意
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-card-soft)] p-3">
                    <p className="flex items-start gap-1.5 text-[13px] font-bold leading-relaxed text-[var(--app-text)]">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--app-text-soft)]" />{' '}
                      {msg.comparisonData.aiVerdict}
                    </p>
                  </div>
                </div>
              </BotAvatar>
            )}

            {msg.type === 'plan' && msg.plan && (
              <SavedPlans
                plan={msg.plan}
                content={msg.content}
                onViewActivity={onViewActivity}
                onSavePlan={onSavePlan}
                onViewItinerary={onViewItinerary}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export default SessionList;
