import { BotContext } from '../bot.js';
import { createChildLogger } from '../../config/logger.js';
import { Chat } from '../../db/models/Chat.js';
import { Topic } from '../../db/models/Topic.js';
import { Reminder } from '../../db/models/Reminder.js';
import { Summary } from '../../db/models/Summary.js';

const logger = createChildLogger('commands');

export async function handleStart(ctx: BotContext) {
  const chatType = ctx.chat?.type;
  
  if (chatType === 'private') {
    // Private chat - show onboarding
    const message = `👋 **Добро пожаловать в AI-ассистента!**

Я работаю в групповых чатах с включёнными топиками (Forum Topics) для разделения контекстов.

**Что я умею:**
• Понимаю текст, изображения и голосовые сообщения
• Создаю напоминания и веду заметки
• Генерирую саммари по дням/неделям/месяцам
• Выполняю различные задачи через команды

**Как начать:**
1. Добавьте меня в групповой чат
2. Включите Topics (Forum) в настройках чата
3. Создайте топики для разных задач
4. Начните общение в любом топике!

Каждый топик — это отдельный контекст с собственной памятью.`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '➕ Добавить в групповой чат',
            url: `https://t.me/${ctx.me.username}?startgroup=true`
          }
        ]]
      }
    });
    
  } else {
    // Group chat
    const chat = await Chat.findOne({ telegramId: ctx.chat!.id });
    
    if (!chat?.isForumEnabled) {
      await ctx.reply(
        '⚠️ **Для работы бота необходимо включить Topics (Forum)**\n\n' +
        '**Как включить:**\n' +
        '1. Откройте настройки чата\n' +
        '2. Найдите раздел "Topics"\n' +
        '3. Включите "Enable Topics"\n' +
        '4. Дайте боту права на управление топиками\n\n' +
        'После этого создайте топики и начните общение!',
        { parse_mode: 'Markdown' }
      );
    } else if (!ctx.message?.message_thread_id) {
      await ctx.reply(
        '💡 **Создайте топик для начала работы**\n\n' +
        'Каждый топик — это отдельный контекст для разных задач:\n' +
        '• Подготовка к выступлению\n' +
        '• Фитнес-ассистент\n' +
        '• Напоминания\n' +
        '• Планирование проектов\n\n' +
        'Создайте топик и напишите в нём!',
        { parse_mode: 'Markdown' }
      );
    } else {
      // In a topic
      const topic = await Topic.findOne({
        chatId: ctx.chat!.id,
        topicId: ctx.message.message_thread_id
      });
      
      await ctx.reply(
        `🎯 **Топик активирован!**\n\n` +
        `**Название:** ${topic?.title || 'Неизвестно'}\n` +
        `**Сообщений:** ${topic?.messageCount || 0}\n\n` +
        `Этот топик — ваш отдельный контекст. Я помню всё, что здесь происходит, и могу:\n` +
        `• Отвечать на вопросы\n` +
        `• Создавать напоминания\n` +
        `• Анализировать изображения\n` +
        `• Генерировать саммари\n\n` +
        `Попробуйте: "Поставь напоминание завтра в 10:00 позвонить клиенту"`,
        { parse_mode: 'Markdown' }
      );
    }
  }
}

export async function handleHelp(ctx: BotContext) {
  const message = `🤖 **Справка по командам**

**Основные команды:**
/start - Начать работу с ботом
/help - Показать эту справку
/model - Выбрать AI модель
/topic - Информация о текущем топике

**Команды напоминаний:**
/reminders - Показать активные напоминания
"Поставь напоминание..." - Создать напоминание
"Отмени напоминание..." - Отменить напоминание

**Команды саммари:**
/summary - Быстрые кнопки саммари
"Дай саммари за день/неделю/месяц" - Получить саммари

**Возможности:**
• 📝 Обработка текста, изображений, голоса
• ⏰ Умные напоминания с повторами
• 📊 Автоматические саммари
• 🧠 Память по топикам
• 🔧 Выполнение задач через команды

**Примеры запросов:**
• "Поставь напоминание каждый понедельник в 9:00 - планёрка"
• "Дай саммари за неделю"
• "Сохрани заметку: важная встреча завтра"
• "Покажи мои напоминания"`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleModel(ctx: BotContext) {
  const message = `🤖 **Выбор AI модели**

**Доступные провайдеры:**
• OpenAI (GPT-4o-mini) - быстро и качественно
• Google Gemini - мультимодальность

**Текущая модель:** OpenAI GPT-4o-mini

Для смены модели используйте кнопки ниже:`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 OpenAI GPT-4o-mini', callback_data: 'model_openai_gpt-4o-mini' },
          { text: 'Google Gemini 1.5', callback_data: 'model_gemini_1.5-flash' }
        ]
      ]
    }
  });
}

export async function handleReminders(ctx: BotContext) {
  if (!ctx.session.topicId) {
    await ctx.reply('⚠️ Команда доступна только в топиках');
    return;
  }

  const topic = await Topic.findOne({
    chatId: ctx.chat!.id,
    topicId: ctx.session.topicId
  });

  if (!topic) {
    await ctx.reply('❌ Топик не найден');
    return;
  }

  const reminders = await Reminder.find({
    topicId: topic._id,
    status: 'scheduled'
  }).sort({ dueISO: 1 });

  if (reminders.length === 0) {
    await ctx.reply('📅 Активных напоминаний нет');
    return;
  }

  let message = `⏰ **Активные напоминания (${reminders.length}):**\n\n`;
  
  reminders.forEach((reminder, index) => {
    const dueDate = new Date(reminder.dueISO);
    const dateStr = dueDate.toLocaleString('ru-RU', {
      timeZone: reminder.timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    message += `${index + 1}. **${reminder.title}**\n`;
    message += `   📅 ${dateStr}`;
    if (reminder.repeat) {
      message += ` (повторяется ${reminder.repeat.freq.toLowerCase()})`;
    }
    message += '\n\n';
  });

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleSummary(ctx: BotContext) {
  if (!ctx.session.topicId) {
    await ctx.reply('⚠️ Команда доступна только в топиках');
    return;
  }

  const message = `📊 **Саммари топика**

Выберите период для генерации саммари:`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 За день', callback_data: 'summary_day' },
          { text: '📆 За неделю', callback_data: 'summary_week' }
        ],
        [
          { text: '🗓 За месяц', callback_data: 'summary_month' },
          { text: '📋 За год', callback_data: 'summary_year' }
        ]
      ]
    }
  });
}

export async function handleTopic(ctx: BotContext) {
  if (!ctx.session.topicId) {
    await ctx.reply('⚠️ Команда доступна только в топиках');
    return;
  }

  const topic = await Topic.findOne({
    chatId: ctx.chat!.id,
    topicId: ctx.session.topicId
  });

  if (!topic) {
    await ctx.reply('❌ Топик не найден');
    return;
  }

  const remindersCount = await Reminder.countDocuments({
    topicId: topic._id,
    status: 'scheduled'
  });

  const summariesCount = await Summary.countDocuments({
    topicId: topic._id
  });

  const message = `🎯 **Информация о топике**

**Название:** ${topic.title}
**ID:** ${topic.topicId}
**Сообщений:** ${topic.messageCount}
**Создан:** ${topic.createdAt.toLocaleDateString('ru-RU')}
**Последняя активность:** ${topic.lastMessageAt?.toLocaleDateString('ru-RU') || 'Неизвестно'}

**Статистика:**
• Активных напоминаний: ${remindersCount}
• Саммари создано: ${summariesCount}

**Настройки:**
• Провайдер: ${topic.settings.providerPrefs?.provider || 'По умолчанию'}
• Модель: ${topic.settings.providerPrefs?.model || 'По умолчанию'}
• Часовой пояс: ${topic.settings.timezone}
• Авто-саммари: ${topic.settings.autoSummary?.enabled ? '✅' : '❌'}`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}