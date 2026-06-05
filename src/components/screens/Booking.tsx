import { Activity } from '../../services/ai';
import { ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { StepIndicator, ORDER_STEPS } from '../ui/StepIndicator';
import ScreenGuard from '../ui/ScreenGuard';

interface BookingProps {
  activity: Activity | null;
  onBack: () => void;
  onProceedToPay: (variant?: { timeSlot: string; ticketName: string }) => void;
}

export default function Booking({ activity, onBack, onProceedToPay }: BookingProps) {
  const isFood = activity?.type === 'food';
  const isTravel = activity?.type === 'travel';
  const accent = isFood
    ? { text: 'text-[var(--rose-ink)]' }
    : isTravel
      ? { text: 'text-[var(--sky-ink)]' }
      : { text: 'text-[var(--mint-ink)]' };

  const timeslots = isFood
    ? [
        {
          time: '现在下单',
          status: '推荐',
          statusClass: 'bg-[var(--rose-soft)] text-[var(--rose-ink)]',
          available: '约25分钟送达',
        },
        { time: '30分钟后', status: '', statusClass: '', available: '配送更稳妥' },
        { time: '晚点再点', status: '', statusClass: '', available: '适合行程后段' },
      ]
    : isTravel
      ? [
          {
            time: '现在出发',
            status: '推荐',
            statusClass: 'bg-[var(--sky-soft)] text-[var(--sky-ink)]',
            available: '路线已准备好',
          },
          { time: '30分钟后', status: '', statusClass: '', available: '避开高峰更舒适' },
          { time: '1小时后', status: '', statusClass: '', available: '适合顺延安排' },
        ]
      : [
          {
            time: '14:00-16:00',
            status: '推荐',
            statusClass: 'bg-[var(--mint-soft)] text-[var(--mint-ink)]',
            available: '余票充足',
          },
          {
            time: '14:30-16:30',
            status: '已选',
            statusClass: 'bg-[var(--brand)] text-[var(--brand-ink)]',
            available: '余票充足',
          },
          { time: '15:00-17:00', status: '', statusClass: '', available: '余票较少' },
          { time: '15:30-17:30', status: '', statusClass: '', available: '余票较少' },
          { time: '16:00-18:00', status: '', statusClass: '', available: '余票紧张' },
        ];

  const basePrice = activity?.price || 0;
  const foodBasePrice = isFood ? Math.max(basePrice, 25) : basePrice;

  const ticketOptions = isFood
    ? [
        {
          name: '单人推荐套餐',
          desc: '包含：招牌单品 / 热门搭配 / 按当前偏好推荐',
          price: foodBasePrice,
          tag: '推荐',
        },
        {
          name: '双人分享套餐',
          desc: '包含：双人主食 / 小食 / 饮品组合',
          price: foodBasePrice + 38,
          tag: '',
        },
      ]
    : isTravel
      ? [
          {
            name: '标准出行方案',
            desc: '包含：路线建议 / 到达提醒 / 时间节点提示',
            price: basePrice || 50,
            tag: '推荐',
          },
          {
            name: '舒适优先方案',
            desc: '包含：更少步行 / 更稳妥衔接 / 备用路线',
            price: (basePrice || 50) + 20,
            tag: '',
          },
        ]
      : [
          {
            name: '标准票 1人',
            desc: '包含：当前推荐场次 / 标准入场权益',
            price: basePrice,
            tag: '推荐',
          },
          {
            name: '双人票',
            desc: '包含：双人入场 / 更适合结伴出行',
            price: basePrice > 0 ? basePrice * 2 - 20 : 0,
            tag: '',
          },
          {
            name: '优选票',
            desc: '包含：更灵活场次 / 更舒适体验',
            price: basePrice > 0 ? basePrice + 30 : 0,
            tag: '',
          },
        ];

  const [selectedTime, setSelectedTime] = useState(timeslots[0]?.time || '');
  const [selectedTicket, setSelectedTicket] = useState(ticketOptions[0]?.name || '');

  // activity 变化时重置选中状态
  useEffect(() => {
    setSelectedTime(timeslots[0]?.time || '');
    setSelectedTicket(ticketOptions[0]?.name || '');
  }, [activity?.id, activity?.type]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const formatDate = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  return (
    <ScreenGuard data={activity} onBack={onBack}>
      <div className="flex h-full flex-col bg-transparent">
        <div className="px-5 pt-14 pb-3 bg-white/82 backdrop-blur-xl flex items-center shadow-[0_6px_18px_rgba(20,24,33,0.04)] relative z-20 border-b border-[var(--app-border)]">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-start absolute left-5"
          >
            <ChevronLeft className="w-7 h-7 text-[var(--app-ink)]" />
          </button>
          <span className="flex-1 text-center font-bold text-lg text-[#141821]">
            时段与套餐选择
          </span>
        </div>

        <StepIndicator steps={ORDER_STEPS} currentStep={1} />

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Time Selection */}
          <div className="app-card mx-4 mt-4 px-5 py-5 rounded-[24px]">
            <h3 className="font-bold text-[var(--app-ink)] text-base mb-1">
              {isFood ? '选择送达时间' : isTravel ? '选择出发时间' : '选择入场时段'}
            </h3>
            <p className="text-xs text-[var(--app-text-soft)] mb-4">
              {isFood
                ? '会结合当前行程节奏推荐更合适的送达时间'
                : isTravel
                  ? '会结合当前路线安排推荐更顺的出发时间'
                  : '为避免排队，建议选择推荐时段'}
            </p>

            <div className="flex space-x-4 mb-4 border-b border-[var(--app-border)] pb-3">
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-[var(--brand-ink)]">今天</span>
                <span className="text-xs text-[var(--brand-ink)]">{formatDate(today)}</span>
              </div>
              <div className="flex flex-col items-center opacity-40">
                <span className="text-sm font-bold text-[var(--app-ink)]">明天</span>
                <span className="text-xs text-[var(--app-text)]">{formatDate(tomorrow)}</span>
              </div>
              <div className="flex flex-col items-center opacity-40">
                <span className="text-sm font-bold text-[var(--app-ink)]">
                  {weekDays[dayAfter.getDay()]}
                </span>
                <span className="text-xs text-[var(--app-text)]">{formatDate(dayAfter)}</span>
              </div>
            </div>

            <div className="space-y-3">
              {timeslots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <div
                    key={slot.time}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${
                      isSelected
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)]/50'
                        : 'border-[var(--app-border)] bg-[var(--app-card-soft)]'
                    }`}
                  >
                    <div className="flex items-center">
                      <span
                        className={`text-base font-bold mr-3 ${isSelected ? 'text-[var(--app-ink)]' : 'text-[var(--app-ink)]'}`}
                      >
                        {slot.time}
                      </span>
                      {(slot.status || isSelected) && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            isSelected
                              ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                              : slot.statusClass
                          }`}
                        >
                          {isSelected ? '已选' : slot.status}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--app-text-soft)]">{slot.available}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ticket Selection */}
          <div className="app-card mx-4 mt-3 px-5 py-5 rounded-[24px]">
            <h3 className="font-bold text-[var(--app-ink)] text-base mb-1">
              {isFood ? '选择套餐' : isTravel ? '选择出行方案' : '选择票种'}
            </h3>
            <p className="text-xs text-[var(--app-text-soft)] mb-4">已为你按当前任务智能匹配</p>

            <div className="space-y-4">
              {ticketOptions.map((ticket) => {
                const isSelected = selectedTicket === ticket.name;
                return (
                  <div
                    key={ticket.name}
                    onClick={() => setSelectedTicket(ticket.name)}
                    className={`relative p-5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)]/40 border-2 shadow-sm'
                        : 'border-[var(--app-border)] bg-white shadow-sm'
                    }`}
                  >
                    {ticket.tag && (
                      <div className="absolute top-0 right-0 bg-[var(--brand)] text-xs font-bold text-[var(--brand-ink)] px-2.5 py-0.5 rounded-bl-xl">
                        {ticket.tag}
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-[var(--app-ink)] text-base">{ticket.name}</h4>
                      <div className="flex items-baseline">
                        <span className={`text-sm font-bold ${accent.text} mr-0.5`}>¥</span>
                        <span className={`text-2xl font-bold ${accent.text} leading-none`}>
                          {ticket.price}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--app-text)] leading-relaxed max-w-[75%]">
                      {(ticket.desc ?? '').split(' / ').map((line) => (
                        <span key={line} className="block mt-1">
                          • {line}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/82 backdrop-blur-xl border-t border-[var(--app-border)] flex items-center justify-between pb-safe z-30">
          <div className="flex items-baseline ml-2">
            {(() => {
              const selectedPrice =
                ticketOptions.find((t) => t.name === selectedTicket)?.price || activity?.price || 0;
              return selectedPrice > 0 ? (
                <>
                  <span className={`text-lg font-bold ${accent.text} mr-1`}>¥</span>
                  <span className={`text-3xl font-bold ${accent.text} leading-none`}>
                    {selectedPrice}
                  </span>
                  {isFood && (
                    <span className="text-xs font-bold text-[var(--app-text-soft)] ml-1">人均</span>
                  )}
                </>
              ) : isFood ? (
                <span className={`text-2xl font-bold ${accent.text} leading-none`}>价格详询</span>
              ) : (
                <span className={`text-2xl font-bold ${accent.text} leading-none`}>免费</span>
              );
            })()}
          </div>
          <button
            onClick={() => onProceedToPay({ timeSlot: selectedTime, ticketName: selectedTicket })}
            className="app-btn-primary font-bold py-3.5 px-10 rounded-full transition-colors text-base"
          >
            {isFood ? '去下单' : isTravel ? '去确认' : '去支付'}
          </button>
        </div>
      </div>
    </ScreenGuard>
  );
}
