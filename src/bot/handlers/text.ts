import { BotContext } from '../bot.js';
import { createChildLogger } from '../../config/logger.js';
import { Chat } from '../../db/models/Chat.js';
import { Topic } from '../../db/models/Topic.js';
import { Message } from '../../db/models/Message.js';
import { llmRouter } from '../../index.js';

const logger = createChildLogger('text-handler');

export async function handleText(ctx: BotContext) {
  const chatType = ctx.chat?.type;
  const text = ctx.message?.text;
  
  if (!text) return;
  
  logger.info(`Processing text message: "${text.substring(0, 50)}..."`);
  
  // Handle private chat
  if (chatType === 'private') {
    await handlePrivateMessage(ctx, text);
    return;
  }
  
  // Handle group chat
  if (chatType === 'group' || chatType === 'supergroup') {
    await handleGroupMessage(ctx, text);
    return;
  }
}

async function handlePrivateMessage(ctx: BotContext, _text: string) {
  // In private chat, always suggest adding to group
  await ctx.reply(
    '💡 **Добавьте меня в групповой чат с топиками**\n\n' +
    'Я работаю лучше всего в групповых чатах с включёнными Topics (Forum), ' +
    'где каждый топик становится отдельным контекстом для разных задач.\n\n' +
    '**Как начать:**\n' +
    '1. Добавьте меня в групповой чат\n' +
    '2. Включите Topics в настройках чата\n' +
    '3. Создайте топики для разных целей\n' +
    '4. Начните общение!',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '➕ Добавить в групповой чат',
            url: `https://t.me/${ctx.me.username}?startgroup=true`
          }
        ]]
      }
    }
  );
}

async function handleGroupMessage(ctx: BotContext, text: string) {
  const chat = await Chat.findOne({ telegramId: ctx.chat!.id });
  
  // Check if topics are enabled
  if (!chat?.isForumEnabled || !chat?.hasTopicsEnabled) {
    // Check if we already sent a warning today
    const lastCheck = chat?.lastTopicsCheckAt;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (!lastCheck || lastCheck < oneDayAgo) {
      await ctx.reply(
        '⚠️ **Для полноценной работы включите Topics (Forum)**\n\n' +
        '**Инструкция для администратора:**\n' +
        '1. Откройте настройки чата\n' +
        '2. Найдите раздел "Topics" или "Темы"\n' +
        '3. Включите "Enable Topics"\n' +
        '4. Дайте боту права на управление топиками\n\n' +
        'После этого создайте топики для разных задач и начните общение в них!',
        { parse_mode: 'Markdown' }
      );
      
      // Update last check time
      if (chat) {
        chat.lastTopicsCheckAt = now;
        await chat.save();
      }
    }
    return;
  }
  
  // Check if message is in a topic
  if (!ctx.message?.message_thread_id) {
    await ctx.reply(
      '💡 **Создайте топик для начала работы**\n\n' +
      'Каждый топик — это отдельный контекст. Создайте топики для:\n' +
      '• Планирования проектов\n' +
      '• Напоминаний и задач\n' +
      '• Обсуждения идей\n' +
      '• Анализа документов\n\n' +
      'Создайте топик и напишите в нём!',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Process message in topic
  await processTopicMessage(ctx, text);
}

async function processTopicMessage(ctx: BotContext, text: string) {
  const chatId = ctx.chat!.id;
  const topicId = ctx.message!.message_thread_id!;
  const userId = ctx.from!.id;
  const messageId = ctx.message!.message_id;
  
  try {
    // Find or create topic
    let topic = await Topic.findOne({ chatId, topicId });
    if (!topic) {
      topic = new Topic({
        chatId,
        topicId,
        title: `Topic ${topicId}`,
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
          autoSummary: {
            enabled: true,
            dailyAt: '03:30',
            weeklyAt: 'monday-03:30',
            monthlyAt: '1-03:30',
          },
        },
      });
      await topic.save();
    }
    
    // Save user message
    const userMessage = new Message({
      topicId: topic._id,
      chatId,
      telegramTopicId: topicId,
      messageId,
      userId,
      role: 'user',
      content: text,
    });
    await userMessage.save();
    
    // Update topic stats
    topic.lastMessageAt = new Date();
    topic.messageCount += 1;
    await topic.save();
    
    // Check for special commands or patterns
    if (await handleSpecialCommands(ctx, text, topic)) {
      return;
    }
    
    // Get AI response using LLM router
    try {
      // Get recent messages for context
      const recentMessages = await Message.find({
        topicId: topic._id
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
      
      // Prepare messages for LLM
      const llmMessages = recentMessages.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
      
      // Add system message
      llmMessages.unshift({
        role: 'system',
        content: `Ты AI-ассистент в топике "${topic.title}". Отвечай полезно и по делу на русском языке.`,
      });
      
      // Get AI response
      const aiResponse = await llmRouter.chat(llmMessages);
      
      // Send AI response
      const sentMessage = await ctx.reply(aiResponse.content, { parse_mode: 'Markdown' });
      
      // Save assistant response
      const assistantMessage = new Message({
        topicId: topic._id,
        chatId,
        telegramTopicId: topicId,
        messageId: sentMessage.message_id,
        userId: ctx.me.id,
        role: 'assistant',
        content: aiResponse.content,
        metadata: {
          model: aiResponse.model,
          provider: aiResponse.provider,
          usage: aiResponse.usage,
          processingTime: aiResponse.processingTime,
        },
      });
      await assistantMessage.save();
      
    } catch (error) {
      logger.error('Error getting AI response:', error);
      
      // Fallback response
      await ctx.reply(
        '❌ Извините, произошла ошибка при обработке вашего сообщения. ' +
        'Попробуйте еще раз или обратитесь к администратору.',
        { parse_mode: 'Markdown' }
      );
    }
    
  } catch (error) {
    logger.error('Error processing topic message:', error);
    await ctx.reply('❌ Произошла ошибка при обработке сообщения');
  }
}

async function handleSpecialCommands(ctx: BotContext, text: string, _topic: any): Promise<boolean> {
  const lowerText = text.toLowerCase();
  
  // Check for reminder patterns
  if (lowerText.includes('напоминание') || lowerText.includes('напомни')) {
    await ctx.reply(
      '⏰ **Создание напоминания**\n\n' +
      'Обнаружен запрос на создание напоминания!\n' +
      'В полной версии здесь будет:\n' +
      '• Парсинг даты и времени\n' +
      '• Создание напоминания в БД\n' +
      '• Постановка задачи в очередь\n\n' +
      'Пример: "Поставь напоминание завтра в 10:00 позвонить клиенту"',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  
  // Check for summary patterns
  if (lowerText.includes('саммари') || lowerText.includes('сводка')) {
    await ctx.reply(
      '📊 **Генерация саммари**\n\n' +
      'Обнаружен запрос на саммари!\n' +
      'В полной версии здесь будет:\n' +
      '• Анализ сообщений за период\n' +
      '• Генерация краткой сводки\n' +
      '• Выделение ключевых моментов\n\n' +
      'Используйте команду /summary для быстрого доступа',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  
  // Check for note patterns
  if (lowerText.includes('заметка') || lowerText.includes('запиши')) {
    await ctx.reply(
      '📝 **Сохранение заметки**\n\n' +
      'Обнаружен запрос на сохранение заметки!\n' +
      'В полной версии здесь будет:\n' +
      '• Извлечение текста заметки\n' +
      '• Сохранение с тегами\n' +
      '• Возможность поиска\n\n' +
      'Пример: "Запиши заметку: встреча с клиентом 15 числа"',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  
  return false;
}