export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ServiceIntentResult {
  text: string;
  cardType?: string;
  cardData?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: (args: Record<string, unknown>) => Promise<ServiceIntentResult>;
}
