import { Bot, Context, session, SessionFlavor } from 'grammy';
import { config } from '../config/env.js';
import { createChildLogger } from '../config/logger.js';
import { User } from '../db/models/User.js';
import { Chat } from '../db/models/Chat.js';
import { Topic } from '../db/models/Topic.js';

const logger = createChildLogger('bot');

// Session data interface
export interface SessionData {
  userId?: number;
  chatId?: number;
  topicId?: number;
  lastMessageId?: number;
  contextWindow?: any[];
  currentProvider?: 'openai' | 'gemini';
  currentModel?: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;

// Create bot instance
export const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

// Session middleware
bot.use(session({
  initial: (): SessionData => ({}),
}));

// User and chat tracking middleware
bot.use(async (ctx, next) => {
  const startTime = Date.now();
  
  try {
    // Update user info
    if (ctx.from) {
      await updateUserInfo(ctx.from);
      ctx.session.userId = ctx.from.id;
    }
    
    // Update chat info
    if (ctx.chat) {
      await updateChatInfo(ctx.chat);
      ctx.session.chatId = ctx.chat.id;
    }
    
    // Handle topic info for forum chats
    if (ctx.message?.message_thread_id) {
      ctx.session.topicId = ctx.message.message_thread_id;
      await updateTopicInfo(ctx.chat!.id, ctx.message.message_thread_id, ctx);
    }
    
    await next();
    
  } catch (error) {
    logger.error('Middleware error:', error);
    await ctx.reply('Произошла ошибка при обработке запроса. Попробуйте позже.');
  } finally {
    const duration = Date.now() - startTime;
    logger.info(`Request processed in ${duration}ms`);
  }
});

// Error handler
bot.catch((err) => {
  logger.error('Bot error:', err);
});

async function updateUserInfo(user: any) {
  try {
    await User.findOneAndUpdate(
      { telegramId: user.id },
      {
        telegramId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
        isBot: user.is_bot || false,
        isPremium: user.is_premium,
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error('Failed to update user info:', error);
  }
}

async function updateChatInfo(chat: any) {
  try {
    const isForumEnabled = chat.is_forum || false;
    
    await Chat.findOneAndUpdate(
      { telegramId: chat.id },
      {
        telegramId: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        firstName: chat.first_name,
        lastName: chat.last_name,
        description: chat.description,
        isForumEnabled,
        hasTopicsEnabled: isForumEnabled,
        lastTopicsCheckAt: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error('Failed to update chat info:', error);
  }
}

async function updateTopicInfo(chatId: number, topicId: number, ctx: BotContext) {
  try {
    // Try to get topic info from Telegram API
    let topicTitle = `Topic ${topicId}`;
    
    try {
      // This would require additional API calls to get forum topic info
      // For now, we'll use a default title
    } catch (apiError) {
      logger.warn('Could not fetch topic info from API:', apiError);
    }
    
    await Topic.findOneAndUpdate(
      { chatId, topicId },
      {
        chatId,
        topicId,
        title: topicTitle,
        lastMessageAt: new Date(),
        $inc: { messageCount: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    logger.error('Failed to update topic info:', error);
  }
}

// Bot startup
export async function startBot() {
  try {
    logger.info('Starting Telegram bot...');
    
    // Get bot info
    const me = await bot.api.getMe();
    logger.info(`Bot started: @${me.username} (${me.first_name})`);
    
    // Start polling or webhook based on configuration
    if (config.WEBHOOK_URL) {
      logger.info('Bot will use webhook mode');
      // Webhook setup will be handled by the HTTP server
    } else {
      logger.info('Starting bot in polling mode...');
      await bot.start();
    }
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Bot shutdown
export async function stopBot() {
  try {
    logger.info('Stopping bot...');
    await bot.stop();
    logger.info('Bot stopped successfully');
  } catch (error) {
    logger.error('Error stopping bot:', error);
  }
}