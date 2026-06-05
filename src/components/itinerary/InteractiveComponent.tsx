import React from 'react';
import BudgetSlider from './BudgetSlider';
import OptionVoting from './OptionVoting';
import TimeAdjuster from './TimeAdjuster';
import ActivityReplaceCard, {
  type ActivityReplaceCardProps,
  type ActivityReplaceOption,
} from './ActivityReplaceCard';
import ActivityAddCard, {
  type ActivityAddCardProps,
  type ActivityAddOption,
} from './ActivityAddCard';

export interface ActivityReplaceProps {
  type: 'ActivityReplace';
  title: string;
  originalActivity: string;
  options: ActivityReplaceOption[];
  onConfirm: (originalActivity: string, selected: ActivityReplaceOption) => void;
  onCancel?: () => void;
}

export interface ActivityAddProps {
  type: 'ActivityAdd';
  title: string;
  options: ActivityAddOption[];
  onConfirm: (selected: ActivityAddOption[]) => void;
  onCancel?: () => void;
}

export interface BudgetSliderProps {
  type: 'BudgetSlider';
  min: number;
  max: number;
  step: number;
  currentValue: number;
  label: string;
  onConfirm: (value: number) => void;
  onCancel?: () => void;
}

export interface OptionVotingProps {
  type: 'OptionVoting';
  options: Array<{ id: string; label: string; description?: string }>;
  maxSelections: number;
  title: string;
  onVote: (selectedIds: string[]) => void;
}

export interface TimeAdjusterProps {
  type: 'TimeAdjuster';
  activityId: string;
  currentTime: string;
  minTime: string;
  maxTime: string;
  label: string;
  onConfirm: (activityId: string, newTime: string) => void;
  onCancel?: () => void;
}

export type InteractiveComponentProps =
  | BudgetSliderProps
  | OptionVotingProps
  | TimeAdjusterProps
  | ActivityReplaceProps
  | ActivityAddProps;

function isBudgetSlider(props: InteractiveComponentProps): props is BudgetSliderProps {
  return props.type === 'BudgetSlider';
}
function isOptionVoting(props: InteractiveComponentProps): props is OptionVotingProps {
  return props.type === 'OptionVoting';
}
function isTimeAdjuster(props: InteractiveComponentProps): props is TimeAdjusterProps {
  return props.type === 'TimeAdjuster';
}
function isActivityReplace(props: InteractiveComponentProps): props is ActivityReplaceProps {
  return props.type === 'ActivityReplace';
}
function isActivityAdd(props: InteractiveComponentProps): props is ActivityAddProps {
  return props.type === 'ActivityAdd';
}

interface Props {
  component: InteractiveComponentProps;
}

export default function InteractiveComponent({ component }: Props) {
  if (isBudgetSlider(component)) return <BudgetSlider {...component} />;
  if (isOptionVoting(component)) return <OptionVoting {...component} />;
  if (isTimeAdjuster(component)) return <TimeAdjuster {...component} />;
  if (isActivityReplace(component)) return <ActivityReplaceCard {...component} />;
  if (isActivityAdd(component)) return <ActivityAddCard {...component} />;
  return null;
}
