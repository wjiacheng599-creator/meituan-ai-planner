export interface Activity {
  id: string;
  timeLine: string;
  title: string;
  type: 'food' | 'travel' | 'attraction';
  description: string;
  price: number;
  tags: string[];
  reasoning?: string;
}

export interface WeatherInfo {
  condition: string;
  temp: number;
  advice: string;
}

export interface RealtimeData {
  weather?: WeatherInfo;
  traffic?: Array<{ from: string; to: string; delayMinutes: number }>;
  queueStatus?: Array<{ activityId: string; waitMinutes: number }>;
  availability?: Array<{ activityId: string; available: boolean }>;
}

export interface AdjustmentProposal {
  activityId: string;
  activityTitle: string;
  action: 'reschedule' | 'replace' | 'cancel' | 'add' | 'skip';
  reason: string;
  alternative?: Activity;
  estimatedImpact: 'low' | 'medium' | 'high';
  priority: number;
}

export class DynamicAdjustmentEngine {
  private outdoorKeywords = ['公园', '户外', '江边', '沙滩', '游乐园', '动物园', '景点', '徒步', '爬山', '骑行'];
  private indoorKeywords = ['室内', '博物馆', '商场', '餐厅', '咖啡', '展览', '剧院', '电影院', '健身房'];

  assessWeatherImpact(activities: Activity[], weather?: WeatherInfo): AdjustmentProposal[] {
    if (!weather) return [];

    const proposals: AdjustmentProposal[] = [];
    const badWeather = /雨|雪|雷|雾|霾|沙尘/.test(weather.condition);
    const extremeTemp = weather.temp < 5 || weather.temp > 35;

    for (const activity of activities) {
      const isOutdoor = !activity.tags.some(tag => 
        this.indoorKeywords.some(keyword => tag.includes(keyword))
      ) && (
        this.outdoorKeywords.some(keyword => activity.title.includes(keyword)) ||
        this.outdoorKeywords.some(keyword => activity.tags.some(tag => tag.includes(keyword)))
      );

      if (badWeather && isOutdoor) {
        proposals.push({
          activityId: activity.id,
          activityTitle: activity.title,
          action: 'reschedule',
          reason: `${weather.condition}天气，户外活动"${activity.title}"体验差，建议调整到室内场馆或推迟到天气好转`,
          estimatedImpact: 'medium',
          priority: 2,
        });
      }
    }

    if (extremeTemp) {
      const tempAdvice = weather.temp > 35 
        ? '高温天气户外活动易中暑'
        : '低温天气户外体感寒冷';
      
      for (const activity of activities) {
        const isOutdoor = !activity.tags.some(tag => 
          this.indoorKeywords.some(keyword => tag.includes(keyword))
        );

        if (isOutdoor) {
          proposals.push({
            activityId: activity.id,
            activityTitle: activity.title,
            action: 'reschedule',
            reason: `${tempAdvice}，建议将"${activity.title}"调整为室内活动`,
            estimatedImpact: 'medium',
            priority: 2,
          });
        }
      }
    }

    return proposals.sort((a, b) => b.priority - a.priority);
  }

  assessTrafficImpact(activities: Activity[], traffic?: Array<{ from: string; to: string; delayMinutes: number }>): AdjustmentProposal[] {
    if (!traffic || traffic.length === 0) return [];

    const proposals: AdjustmentProposal[] = [];

    for (const activity of activities) {
      for (const t of traffic) {
        const matchesActivity = 
          activity.title.includes(t.from) || 
          activity.title.includes(t.to) ||
          activity.description.includes(t.from) ||
          activity.description.includes(t.to);

        if (matchesActivity && t.delayMinutes > 30) {
          proposals.push({
            activityId: activity.id,
            activityTitle: activity.title,
            action: 'reschedule',
            reason: `从${t.from}到${t.to}预计延误${t.delayMinutes}分钟，建议调整"${activity.title}"的时间安排`,
            estimatedImpact: t.delayMinutes > 60 ? 'high' : 'medium',
            priority: t.delayMinutes > 60 ? 3 : 1,
          });
        }
      }
    }

    return proposals.sort((a, b) => b.priority - a.priority);
  }

  assessQueueImpact(activities: Activity[], queueStatus?: Array<{ activityId: string; waitMinutes: number }>): AdjustmentProposal[] {
    if (!queueStatus || queueStatus.length === 0) return [];

    const proposals: AdjustmentProposal[] = [];

    for (const status of queueStatus) {
      const activity = activities.find(a => a.id === status.activityId);
      if (!activity) continue;

      if (status.waitMinutes > 60) {
        proposals.push({
          activityId: activity.id,
          activityTitle: activity.title,
          action: 'skip',
          reason: `"${activity.title}"当前排队需要${status.waitMinutes}分钟，建议先跳过或预约其他时间`,
          estimatedImpact: 'high',
          priority: 3,
        });
      } else if (status.waitMinutes > 30) {
        proposals.push({
          activityId: activity.id,
          activityTitle: activity.title,
          action: 'reschedule',
          reason: `"${activity.title}"当前排队需要${status.waitMinutes}分钟，建议稍后前往或错峰`,
          estimatedImpact: 'medium',
          priority: 2,
        });
      }
    }

    return proposals.sort((a, b) => b.priority - a.priority);
  }

  assessAvailabilityImpact(activities: Activity[], availability?: Array<{ activityId: string; available: boolean }>): AdjustmentProposal[] {
    if (!availability || availability.length === 0) return [];

    const proposals: AdjustmentProposal[] = [];

    for (const status of availability) {
      if (!status.available) {
        const activity = activities.find(a => a.id === status.activityId);
        if (!activity) continue;

        proposals.push({
          activityId: activity.id,
          activityTitle: activity.title,
          action: 'replace',
          reason: `"${activity.title}"当前已约满，建议替换为同类型其他场馆或调整时间`,
          estimatedImpact: 'high',
          priority: 3,
        });
      }
    }

    return proposals.sort((a, b) => b.priority - a.priority);
  }

  async assessAndPropose(
    activities: Activity[],
    realtimeData: RealtimeData
  ): Promise<AdjustmentProposal[]> {
    const weatherProposals = this.assessWeatherImpact(activities, realtimeData.weather);
    const trafficProposals = this.assessTrafficImpact(activities, realtimeData.traffic);
    const queueProposals = this.assessQueueImpact(activities, realtimeData.queueStatus);
    const availabilityProposals = this.assessAvailabilityImpact(activities, realtimeData.availability);

    const allProposals = [
      ...weatherProposals,
      ...trafficProposals,
      ...queueProposals,
      ...availabilityProposals,
    ];

    const proposalMap = new Map<string, AdjustmentProposal>();
    for (const proposal of allProposals) {
      const existing = proposalMap.get(proposal.activityId);
      if (!existing || proposal.priority > existing.priority) {
        proposalMap.set(proposal.activityId, proposal);
      }
    }

    return Array.from(proposalMap.values()).sort((a, b) => b.priority - a.priority);
  }
}

export const globalAdjustmentEngine = new DynamicAdjustmentEngine();
