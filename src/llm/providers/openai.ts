import OpenAI from 'openai';
import { config } from '../../config/env.js';
import { createChildLogger } from '../../config/logger.js';
import { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from '../types.js';

const logger = createChildLogger('openai-provider');

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });

    this.defaultModel = config.DEFAULT_MODEL || 'gpt-4o-mini';
  }

  isAvailable(): boolean {
    return !!config.OPENAI_API_KEY;
  }

  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making OpenAI chat request with ${messages.length} messages`);

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: messages.map(msg => ({
          role: msg.role as any,
          content: msg.content,
          name: msg.name,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
        })),
        tools: tools?.map(tool => ({
          type: 'function',
          function: tool.function,
        })),
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 4000,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      const processingTime = Date.now() - startTime;

      return {
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('OpenAI chat error:', error);
      throw new Error(`OpenAI chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transcribe(audioBuffer: Buffer, format: string): Promise<string> {
    try {
      logger.info(`Transcribing audio with OpenAI Whisper (format: ${format})`);

      // Create a File-like object from buffer
      const file = new File([audioBuffer], `audio.${format}`, {
        type: `audio/${format}`,
      });

      const response = await this.client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'ru', // Russian language
        response_format: 'text',
      });

      logger.info('Audio transcription completed');
      return response;

    } catch (error) {
      logger.error('OpenAI transcription error:', error);
      throw new Error(`OpenAI transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async vision(messages: LLMMessage[]): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Making OpenAI vision request with ${messages.length} messages`);

      // Use GPT-4 Vision model for image analysis
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages.map(msg => ({
          role: msg.role as any,
          content: msg.content,
        })),
        max_tokens: 4000,
        temperature: 0.7,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI Vision');
      }

      const processingTime = Date.now() - startTime;

      return {
        content: choice.message.content || '',
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        provider: this.name,
        processingTime,
      };

    } catch (error) {
      logger.error('OpenAI vision error:', error);
      throw new Error(`OpenAI vision failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}