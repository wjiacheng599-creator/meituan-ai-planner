import React from 'react';
import DynamicSuggestions, { type DynamicSuggestionCard } from './DynamicSuggestions';

interface SuggestionCardsProps {
  suggestionCards: DynamicSuggestionCard[];
  onSelect: (prompt: string) => void;
}

const SuggestionCards = React.memo(function SuggestionCards({
  suggestionCards,
  onSelect,
}: SuggestionCardsProps) {
  return <DynamicSuggestions suggestionCards={suggestionCards} onSelect={onSelect} />;
});

export default SuggestionCards;
