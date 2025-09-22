import { config } from '../config/env.js';
import { createChildLogger } from '../config/logger.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { LLMProvider, ProviderType, LLMMessage, LLMResponse, ToolDefinition } from './types.js';

const logger = createChildLogger('llm-router');

export class LLMRouter {
  private providers: Map<ProviderType, LLMProvider> = new Map();
  private defaultProvider: ProviderType;

  constructor() {
    this.defaultProvider = config.DEFAULT_PROVIDER;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize OpenAI provider if API key is available
    if (config.OPENAI_API_KEY) {
      try {
        const openaiProvider = new OpenAIProvider();
        this.providers.set('openai', openaiProvider);
        logger.info('OpenAI provider initialized');
      } catch (error) {
        logger.error('Failed to initialize OpenAI provider:', error);
      }
    }

    // Initialize Gemini provider if API key is available
    if (config.GEMINI_API_KEY) {
      try {
        const geminiProvider = new GeminiProvider();
        this.providers.set('gemini', geminiProvider);
        logger.info('Gemini provider initialized');
      } catch (error) {
        logger.error('Failed to initialize Gemini provider:', error);
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No LLM providers available. Please configure at least one API key.');
    }

    logger.info(`Initialized ${this.providers.size} LLM providers`);
  }

  getProvider(providerType?: ProviderType): LLMProvider {
    const targetProvider = providerType || this.defaultProvider;
    const provider = this.providers.get(targetProvider);

    if (!provider) {
      logger.warn(`Provider ${targetProvider} not available, falling back to default`);
      
      // Try to get any available provider
      const availableProvider = Array.from(this.providers.values())[0];
      if (!availableProvider) {
        throw new Error('No LLM providers available');
      }
      
      return availableProvider;
    }

    return provider;
  }

  async chat(
    messages: LLMMessage[], 
    tools?: ToolDefinition[], 
    providerType?: ProviderType
  ): Promise<LLMResponse> {
    const provider = this.getProvider(providerType);
    
    logger.info(`Using ${provider.name} for chat completion`);
    
    try {
      return await provider.chat(messages, tools);
    } catch (error) {
      logger.error(`Chat completion failed with ${provider.name}:`, error);
      
      // Try fallback to another provider if available
      if (providerType && this.providers.size > 1) {
        logger.info('Attempting fallback to another provider');
        const fallbackProvider = this.getFallbackProvider(providerType);
        if (fallbackProvider) {
          return await fallbackProvider.chat(messages, tools);
        }
      }
      
      throw error;
    }
  }

  async transcribe(
    audioBuffer: Buffer, 
    format: string, 
    providerType?: ProviderType
  ): Promise<string> {
    // For transcription, prefer OpenAI (Whisper) if available
    const preferredProvider = this.providers.get('openai') || this.getProvider(providerType);
    
    logger.info(`Using ${preferredProvider.name} for audio transcription`);
    
    try {
      return await preferredProvider.transcribe(audioBuffer, format);
    } catch (error) {
      logger.error(`Transcription failed with ${preferredProvider.name}:`, error);
      
      // Try fallback if it's not OpenAI
      if (preferredProvider.name !== 'openai' && this.providers.has('openai')) {
        logger.info('Attempting fallback to OpenAI for transcription');
        const openaiProvider = this.providers.get('openai')!;
        return await openaiProvider.transcribe(audioBuffer, format);
      }
      
      throw error;
    }
  }

  async vision(
    messages: LLMMessage[], 
    providerType?: ProviderType
  ): Promise<LLMResponse> {
    const provider = this.getProvider(providerType);
    
    logger.info(`Using ${provider.name} for vision analysis`);
    
    try {
      return await provider.vision(messages);
    } catch (error) {
      logger.error(`Vision analysis failed with ${provider.name}:`, error);
      
      // Try fallback to another provider if available
      if (providerType && this.providers.size > 1) {
        logger.info('Attempting fallback to another provider for vision');
        const fallbackProvider = this.getFallbackProvider(providerType);
        if (fallbackProvider) {
          return await fallbackProvider.vision(messages);
        }
      }
      
      throw error;
    }
  }

  private getFallbackProvider(excludeProvider: ProviderType): LLMProvider | null {
    for (const [type, provider] of this.providers) {
      if (type !== excludeProvider) {
        return provider;
      }
    }
    return null;
  }

  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  isProviderAvailable(providerType: ProviderType): boolean {
    return this.providers.has(providerType);
  }

  setDefaultProvider(providerType: ProviderType): void {
    if (!this.providers.has(providerType)) {
      throw new Error(`Provider ${providerType} is not available`);
    }
    
    this.defaultProvider = providerType;
    logger.info(`Default provider changed to ${providerType}`);
  }

  getDefaultProvider(): ProviderType {
    return this.defaultProvider;
  }
}

// Global instance
export const llmRouter = new LLMRouter();