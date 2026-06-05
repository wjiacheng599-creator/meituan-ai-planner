import React from 'react';
import QuickServiceShortcuts from './QuickServiceShortcuts';

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
}

const QuickActions = React.memo(function QuickActions({
  onSelect,
}: QuickActionsProps) {
  return <QuickServiceShortcuts onSelect={onSelect} />;
});

export default QuickActions;
