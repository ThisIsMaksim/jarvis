import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/env.js';
import { createChildLogger } from '../../config/logger.js';
import { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from '../types.js';

const logger = createChildLogger('gemini-provider');

export class GeminiProvider implements LLMProvider {
  public readonly name = 'gemini';
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor() {
    if (!config.GEMINI_API_KEY) {
      throw new Error('Gemini API key is required');
    }

    this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.defaultModel = 'gemini-1.5-flash';
  }

  isAvailable(): boolean {
    return !!config.GEMINI_API_KEY;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making Gemini chat request with ${messages.length} messages`);

      const model = this.client.getGenerativeModel({ 
        model: this.defaultModel,
        tools: tools ? [{
          functionDeclarations: tools.map(tool => ({
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
          }))
        }] : undefined,
      });

      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGemini(messages);
      
      const chat = model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);

      const response = await result.response;
      const text = response.text();

      const processingTime = Date.now() - startTime;

      // Handle function calls if present
      const functionCalls = response.functionCalls();
      const tool_calls = functionCalls?.map((call, index) => ({
        id: `call_${index}`,
        type: 'function' as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      }));

      return {
        content: text,
        tool_calls,
        usage: {
          prompt_tokens: 0, // Gemini doesn't provide token counts in the same way
          completion_tokens: 0,
          total_tokens: 0,
        },
        model: this.defaultModel,
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('Gemini chat error:', error);
      throw new Error(`Gemini chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transcribe(audioBuffer: Buffer, format: string): Promise<string> {
    try {
      logger.info(`Transcribing audio with Gemini (format: ${format})`);

      // Gemini doesn't have a dedicated transcription API like Whisper
      // This would need to be implemented using a different approach
      // For now, we'll throw an error indicating it's not supported
      throw new Error('Audio transcription is not directly supported by Gemini. Use OpenAI Whisper instead.');

    } catch (error) {
      logger.error('Gemini transcription error:', error);
      throw error;
    }
  }

  async vision(messages: LLMMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making Gemini vision request with ${messages.length} messages`);

      const model = this.client.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
      });

      // Convert messages to Gemini format for vision
      const geminiMessages = this.convertMessagesToGemini(messages);
      
      const chat = model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);

      const response = await result.response;
      const text = response.text();

      const processingTime = Date.now() - startTime;

      return {
        content: text,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        model: 'gemini-1.5-flash',
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('Gemini vision error:', error);
      throw new Error(`Gemini vision failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private convertMessagesToGemini(messages: LLMMessage[]): any[] {
    return messages.map(msg => {
      if (msg.role === 'system') {
        // Gemini doesn't have a system role, so we convert it to user message
        return {
          role: 'user',
          parts: [{ text: `System: ${msg.content}` }],
        };
      }

      if (msg.role === 'assistant') {
        return {
          role: 'model',
          parts: [{ text: msg.content }],
        };
      }

      if (msg.role === 'tool') {
        return {
          role: 'function',
          parts: [{
            functionResponse: {
              name: msg.name || 'unknown',
              response: { result: msg.content },
            },
          }],
        };
      }

      // Default to user role
      return {
        role: 'user',
        parts: [{ text: msg.content }],
      };
    });
  }
}