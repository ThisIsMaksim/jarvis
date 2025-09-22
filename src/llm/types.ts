export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string;
  tool_calls?: ToolCall[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  provider: string;
  processingTime: number;
}

export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
  transcribe(audioBuffer: Uint8Array, format: string): Promise<string>;
  vision(messages: LLMMessage[]): Promise<LLMResponse>;
  isAvailable(): boolean;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolExecutionResult {
  success: boolean;
  result: any;
  error?: string;
}

export type ProviderType = 'openai' | 'gemini';