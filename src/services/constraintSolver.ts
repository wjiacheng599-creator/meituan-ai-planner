import type { Activity } from './ai/types';

export interface PlanningConstraint {
  type: 'time_window' | 'travel_time' | 'budget' | 'preference';
  weight: number;
  data: Record<string, unknown>;
}

export interface TimeWindow {
  activityId: string;
  start: number;
  end: number;
}

export interface PlanningProblem {
  activities: Activity[];
  constraints: PlanningConstraint[];
  timeWindows: TimeWindow[];
  maxTravelTime: number;
  maxBudget: number;
  startTime: number;
  endTime: number;
}

export interface SolverResult {
  success: boolean;
  activities: Activity[];
  totalTravelTime: number;
  totalCost: number;
  satisfactionScore: number;
  message: string;
}

interface ConstraintSolverState {
  assignments: Map<string, number>;
  totalCost: number;
  totalTravelTime: number;
  satisfactionScore: number;
}

export class ConstraintSolver {
  private problem: PlanningProblem;
  private maxIterations: number;
  private randomSeed: number;

  constructor(problem: PlanningProblem, options?: { maxIterations?: number; randomSeed?: number }) {
    this.problem = problem;
    this.maxIterations = options?.maxIterations || 1000;
    this.randomSeed = options?.randomSeed || Date.now();
  }

  private seededRandom(): number {
    this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
    return this.randomSeed / 233280;
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private evaluateConstraintSatisfaction(): number {
    let totalWeight = 0;
    let satisfiedWeight = 0;

    for (const constraint of this.problem.constraints) {
      totalWeight += constraint.weight;

      switch (constraint.type) {
        case 'budget':
          if (this.problem.maxBudget > 0) {
            const currentCost = this.calculateTotalCost();
            if (currentCost <= this.problem.maxBudget) {
              satisfiedWeight += constraint.weight;
            } else {
              satisfiedWeight += constraint.weight * 0.5;
            }
          }
          break;

        case 'travel_time':
          if (this.problem.maxTravelTime > 0) {
            const currentTravel = this.calculateTotalTravelTime();
            if (currentTravel <= this.problem.maxTravelTime) {
              satisfiedWeight += constraint.weight;
            } else {
              satisfiedWeight += constraint.weight * 0.3;
            }
          }
          break;

        case 'time_window':
          const window = constraint.data as unknown as TimeWindow;
          const assignedTime = this.getAssignment(window.activityId);
          if (assignedTime !== undefined) {
            if (assignedTime >= window.start && assignedTime <= window.end) {
              satisfiedWeight += constraint.weight;
            } else {
              satisfiedWeight += constraint.weight * 0.5;
            }
          }
          break;
      }
    }

    return totalWeight > 0 ? satisfiedWeight / totalWeight : 1.0;
  }

  private calculateTotalCost(): number {
    return this.problem.activities.reduce((sum, a) => sum + (a.price || 0), 0);
  }

  private calculateTotalTravelTime(): number {
    let total = 0;
    const ids = Array.from(this.problem.activities.map((a) => a.id));

    for (let i = 0; i < ids.length - 1; i++) {
      total += 30;
    }

    return total;
  }

  private getAssignment(activityId: string): number | undefined {
    const index = this.problem.activities.findIndex((a) => a.id === activityId);
    return index >= 0 ? this.problem.startTime + index * 90 : undefined;
  }

  private evaluateState(): ConstraintSolverState {
    return {
      assignments: new Map(
        this.problem.activities.map((a, i) => [a.id, this.problem.startTime + i * 90])
      ),
      totalCost: this.calculateTotalCost(),
      totalTravelTime: this.calculateTotalTravelTime(),
      satisfactionScore: this.evaluateConstraintSatisfaction(),
    };
  }

  public solve(): SolverResult {
    let bestState = this.evaluateState();
    let iterations = 0;

    const activities = this.shuffle([...this.problem.activities]);

    for (const activity of activities) {
      iterations++;

      if (iterations > this.maxIterations) {
        break;
      }

      const currentScore = bestState.satisfactionScore;
      const newScore = this.evaluateConstraintSatisfaction();

      if (newScore > currentScore) {
        bestState = this.evaluateState();
      }
    }

    const reorderedActivities = this.problem.activities.map((a, i) => ({
      ...a,
      timeLine: this.formatTimeLine(
        this.problem.startTime + i * 90,
        this.problem.startTime + (i + 1) * 90
      ),
    }));

    return {
      success: bestState.satisfactionScore >= 0.7,
      activities: reorderedActivities,
      totalTravelTime: bestState.totalTravelTime,
      totalCost: bestState.totalCost,
      satisfactionScore: bestState.satisfactionScore,
      message:
        bestState.satisfactionScore >= 0.9
          ? '约束满足度优秀'
          : bestState.satisfactionScore >= 0.7
            ? '约束满足度良好'
            : '约束满足度一般，建议调整约束条件',
    };
  }

  private formatTimeLine(startMinutes: number, endMinutes: number): string {
    const startHour = Math.floor(startMinutes / 60);
    const startMin = startMinutes % 60;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;

    return `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  }
}

export function solvePlanningWithConstraints(problem: PlanningProblem): SolverResult {
  const solver = new ConstraintSolver(problem);
  return solver.solve();
}

export function createDefaultProblem(activities: Activity[]): PlanningProblem {
  return {
    activities,
    constraints: [
      { type: 'budget', weight: 1.0, data: { maxBudget: 1000 } },
      { type: 'travel_time', weight: 0.8, data: { maxTravelTime: 120 } },
    ],
    timeWindows: [],
    maxTravelTime: 120,
    maxBudget: 1000,
    startTime: 9 * 60,
    endTime: 22 * 60,
  };
}
