export interface GuardResult {
  blocked: boolean;
  reason?: string;
  category?: 'injection' | 'off_topic' | 'safe';
}

const INJECTION_PATTERNS = [
  /忽略.*指令/i,
  /忽略.*规则/i,
  /ignore.*instruction/i,
  /system.*prompt/i,
  /DAN\b/i,
  /越狱/i,
  /jailbreak/i,
  /假装.*你是/i,
  /忘记.*之前/i,
  /现在.*你是.*新.*角色/i,
];

export function detectPromptInjection(input: string): GuardResult {
  if (!input || input.length < 2) return { blocked: false, category: 'safe' };
  for (const p of INJECTION_PATTERNS) {
    if (p.test(input))
      return { blocked: true, reason: '疑似提示词注入，已拦截', category: 'injection' };
  }
  return { blocked: false, category: 'safe' };
}

export function detectOffTopic(input: string): GuardResult {
  const patterns = [
    /写.*代码/i,
    /编程/i,
    /股票.*分析/i,
    /法律.*咨询/i,
    /医疗/i,
    /政治/i,
    /色情|赌博|毒品|武器/i,
  ];
  for (const p of patterns) {
    if (p.test(input))
      return { blocked: true, reason: '小美专注于本地生活和旅游规划', category: 'off_topic' };
  }
  return { blocked: false, category: 'safe' };
}

export type ToolRisk = 'safe' | 'sensitive';
const SENSITIVE_TOOLS = new Set([
  'make_reservation',
  'book_activity',
  'dispatch_taxi',
  'order_delivery',
  'join_queue',
]);
export function classifyToolRisk(toolName: string): ToolRisk {
  return SENSITIVE_TOOLS.has(toolName) ? 'sensitive' : 'safe';
}

export function runGuardrails(input: string): GuardResult {
  const injection = detectPromptInjection(input);
  if (injection.blocked) return injection;
  return detectOffTopic(input);
}
