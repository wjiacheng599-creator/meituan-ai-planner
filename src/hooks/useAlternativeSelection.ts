import { useState, useCallback, useMemo } from 'react';
import type { Activity } from '../services/ai/types';

export interface AlternativeOption {
  original: Activity;
  options: Partial<Activity>[];
}

export function useAlternativeSelection(initialPlan?: { activities: Activity[] }) {
  const [selectedAlternatives, setSelectedAlternatives] = useState<Map<string, Partial<Activity>>>(
    new Map()
  );

  const alternatives = useMemo(() => {
    if (!initialPlan?.activities) return [];

    const result: AlternativeOption[] = [];

    for (const activity of initialPlan.activities) {
      if (activity.alternatives && activity.alternatives.length > 0) {
        result.push({
          original: activity,
          options: activity.alternatives,
        });
      }
    }

    return result;
  }, [initialPlan?.activities]);

  const selectAlternative = useCallback((originalId: string, altActivity: Partial<Activity>) => {
    setSelectedAlternatives((prev) => {
      const next = new Map(prev);
      next.set(originalId, altActivity);
      return next;
    });
  }, []);

  const removeAlternative = useCallback((originalId: string) => {
    setSelectedAlternatives((prev) => {
      const next = new Map(prev);
      next.delete(originalId);
      return next;
    });
  }, []);

  const applyAlternatives = useCallback(
    (activities: Activity[]): Activity[] => {
      return activities.map((activity) => {
        const selectedAlt = selectedAlternatives.get(activity.id);
        if (selectedAlt) {
          return {
            ...activity,
            ...selectedAlt,
          };
        }
        return activity;
      });
    },
    [selectedAlternatives]
  );

  const hasPendingChanges = selectedAlternatives.size > 0;

  const confirmChanges = useCallback(() => {
    setSelectedAlternatives(new Map());
  }, []);

  const discardChanges = useCallback(() => {
    setSelectedAlternatives(new Map());
  }, []);

  return {
    alternatives,
    selectAlternative,
    removeAlternative,
    applyAlternatives,
    selectedAlternatives,
    hasPendingChanges,
    confirmChanges,
    discardChanges,
  };
}

export interface AlternativeSelectionState {
  originalActivity: Activity;
  selectedOption: Partial<Activity> | null;
}

export function useAlternativeSelectionSingle(initialActivity?: Activity) {
  const [selectedOption, setSelectedOption] = useState<Partial<Activity> | null>(null);

  const options = useMemo(() => {
    return initialActivity?.alternatives || [];
  }, [initialActivity?.alternatives]);

  const selectOption = useCallback((option: Partial<Activity>) => {
    setSelectedOption(option);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedOption(null);
  }, []);

  const applySelection = useCallback(
    (activity: Activity): Activity => {
      if (selectedOption) {
        return {
          ...activity,
          ...selectedOption,
        };
      }
      return activity;
    },
    [selectedOption]
  );

  return {
    options,
    selectedOption,
    selectOption,
    clearSelection,
    applySelection,
  };
}
