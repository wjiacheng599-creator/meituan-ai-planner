import { useState, useCallback } from 'react';
import type { TravelMode } from '../types';
import { useUserPreferenceStore } from '../services/userPreference';

export function useTravelMode() {
  const storeTravelMode = useUserPreferenceStore((state) => state.travelMode);
  const storeSetTravelMode = useUserPreferenceStore((state) => state.setTravelMode);

  const [travelMode, setTravelModeState] = useState<TravelMode>(storeTravelMode);
  const [initialized, setInitialized] = useState(false);

  const setTravelMode = useCallback(
    (mode: TravelMode) => {
      setTravelModeState(mode);
      storeSetTravelMode(mode);
    },
    [storeSetTravelMode]
  );

  if (!initialized && storeTravelMode !== travelMode) {
    setTravelModeState(storeTravelMode);
    setInitialized(true);
  }

  return { travelMode: initialized ? travelMode : storeTravelMode, setTravelMode };
}
