import { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from '../types.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger('ollama-provider');

export class OllamaProvider implements LLMProvider {
  public readonly name = 'ollama';
  private baseURL: string;
  private chatModel: string;
  private visionModel: string;

  constructor(baseURL: string = 'http://localhost:11434', chatModel: string = 'qwen2.5:14b-instruct', visionModel: string = 'llava:7b') {
    this.baseURL = baseURL;
    this.chatModel = chatModel;
    this.visionModel = visionModel;
  }

  isAvailable(): boolean {
    return true; // Ollama is always available if configured
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making Ollama chat request with ${messages.length} messages using model ${this.chatModel}`);

      // Convert messages to Ollama format
      const ollamaMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      }));

      const requestBody: any = {
        model: this.chatModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        },
      };

      // Note: Ollama doesn't support function calling in the same way as OpenAI
      // We'll handle tools by including them in the system message
      if (tools && tools.length > 0) {
        const toolsDescription = tools.map(tool => 
          `${tool.function.name}: ${tool.function.description}`
        ).join('\n');
        
        const systemMessage = `You have access to the following tools:\n${toolsDescription}\n\nTo use a tool, respond with JSON in this format: {"tool_call": {"name": "tool_name", "arguments": {...}}}`;
        
        requestBody.messages.unshift({
          role: 'system',
          content: systemMessage,
        });
      }

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const processingTime = Date.now() - startTime;

      // Parse tool calls from response if present
      let toolCalls: any[] = [];
      let content = data.message?.content || '';

      if (tools && tools.length > 0) {
        try {
          // Try to parse JSON tool call from response
          const jsonMatch = content.match(/\{[^}]*"tool_call"[^}]*\}/);
          if (jsonMatch) {
            const toolCall = JSON.parse(jsonMatch[0]);
            if (toolCall.tool_call) {
              toolCalls = [{
                id: `call_${Date.now()}`,
                type: 'function' as const,
                function: {
                  name: toolCall.tool_call.name,
                  arguments: JSON.stringify(toolCall.tool_call.arguments || {}),
                },
              }];
              // Remove tool call JSON from content
              content = content.replace(jsonMatch[0], '').trim();
            }
          }
        } catch (error) {
          logger.debug('No valid tool call found in response');
        }
      }

      return {
        content,
        tool_calls: toolCalls,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        model: this.chatModel,
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('Ollama chat error:', error);
      throw new Error(`Ollama chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transcribe(_audioBuffer: Uint8Array, _format: string): Promise<string> {
    throw new Error('Ollama provider does not support audio transcription');
  }

  async vision(messages: LLMMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making Ollama vision request with ${messages.length} messages using model ${this.visionModel}`);

      // Convert messages to Ollama format
      const ollamaMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      }));

      const requestBody = {
        model: this.visionModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        },
      };

      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama Vision API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const processingTime = Date.now() - startTime;

      return {
        content: data.message?.content || '',
        tool_calls: [],
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        model: this.visionModel,
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('Ollama vision error:', error);
      throw new Error(`Ollama vision failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to check if Ollama is running and models are available
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) return false;
      
      const data = await response.json() as any;
      const models = data.models?.map((m: any) => m.name) || [];
      
      const chatModelName = this.chatModel.split(':')[0] || this.chatModel;
      const visionModelName = this.visionModel.split(':')[0] || this.visionModel;
      
      const hasChatModel = models.some((name: string) => name.includes(chatModelName));
      const hasVisionModel = models.some((name: string) => name.includes(visionModelName));
      
      logger.info(`Ollama health check: chat model ${this.chatModel} ${hasChatModel ? 'available' : 'missing'}, vision model ${this.visionModel} ${hasVisionModel ? 'available' : 'missing'}`);
      
      return hasChatModel && hasVisionModel;
    } catch (error) {
      logger.error('Ollama health check failed:', error);
      return false;
    }
  }
}