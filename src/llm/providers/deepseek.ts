import { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from '../types.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger('deepseek-provider');

export class DeepSeekProvider implements LLMProvider {
  public readonly name = 'deepseek';
  private apiKey: string;
  private baseURL = 'https://api.deepseek.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making DeepSeek chat request with ${messages.length} messages`);

      const requestBody: any = {
        model: 'deepseek-chat',
        messages: messages.map(msg => {
          const message: any = {
            role: msg.role,
            content: msg.content,
          };
          if (msg.name) message.name = msg.name;
          if (msg.tool_calls) message.tool_calls = msg.tool_calls;
          if (msg.tool_call_id) message.tool_call_id = msg.tool_call_id;
          return message;
        }),
        temperature: 0.7,
        max_tokens: 4000,
        stream: false,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools.map(tool => ({
          type: 'function',
          function: tool.function,
        }));
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const choice = data.choices[0];
      
      if (!choice) {
        throw new Error('No response from DeepSeek');
      }

      const processingTime = Date.now() - startTime;

      const toolCalls = choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));

      return {
        content: choice.message.content || '',
        tool_calls: toolCalls || [],
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
        model: data.model || 'deepseek-chat',
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('DeepSeek chat error:', error);
      throw new Error(`DeepSeek chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transcribe(_audioBuffer: Uint8Array, _format: string): Promise<string> {
    logger.info(`DeepSeek doesn't support audio transcription, format: ${_format}`);
    throw new Error('DeepSeek provider does not support audio transcription');
  }

  async vision(messages: LLMMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making DeepSeek vision request with ${messages.length} messages`);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-vl-chat',
          messages: messages.map(msg => ({
            role: msg.role as any,
            content: msg.content,
          })),
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek Vision API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const choice = data.choices[0];

      if (!choice) {
        throw new Error('No response from DeepSeek Vision');
      }

      const processingTime = Date.now() - startTime;

      return {
        content: choice.message.content || '',
        tool_calls: [],
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
        model: data.model || 'deepseek-vl-chat',
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('DeepSeek vision error:', error);
      throw new Error(`DeepSeek vision failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}