import { z } from 'zod';
import { createChildLogger } from '../../config/logger.js';
import { Reminder } from '../../db/models/Reminder.js';
import { Topic } from '../../db/models/Topic.js';
import { reminderQueue } from '../../jobs/queue.js';
import { ToolDefinition, ToolExecutionResult } from '../types.js';

const logger = createChildLogger('reminders-tool');

// Zod schemas for validation
const createReminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due: z.string().datetime('Invalid ISO datetime'),
  topicId: z.string().min(1, 'Topic ID is required'),
  repeat: z.object({
    freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CRON']),
    interval: z.number().int().positive().optional(),
    byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
    cron: z.string().optional(),
    until: z.string().datetime().optional(),
    count: z.number().int().positive().optional(),
  }).optional(),
  description: z.string().optional(),
  timezone: z.string().default('Europe/Berlin'),
});

const listRemindersSchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
  range: z.object({
    fromISO: z.string().datetime().optional(),
    toISO: z.string().datetime().optional(),
  }).optional(),
});

const cancelReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
});

// Tool definitions
export const reminderTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: 'Create a new reminder (one-time or recurring)',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Reminder title/description',
          },
          due: {
            type: 'string',
            description: 'Due date/time in ISO 8601 format (e.g., "2024-01-15T10:00:00Z")',
          },
          topicId: {
            type: 'string',
            description: 'Topic ID where the reminder belongs',
          },
          repeat: {
            type: 'object',
            description: 'Repeat configuration for recurring reminders',
            properties: {
              freq: {
                type: 'string',
                enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CRON'],
                description: 'Frequency of repetition',
              },
              interval: {
                type: 'number',
                description: 'Interval between repetitions (default: 1)',
              },
              byDay: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
                },
                description: 'Days of week for weekly repetition',
              },
              cron: {
                type: 'string',
                description: 'Cron expression for complex schedules',
              },
              until: {
                type: 'string',
                description: 'End date for recurring reminders (ISO 8601)',
              },
              count: {
                type: 'number',
                description: 'Maximum number of occurrences',
              },
            },
          },
          description: {
            type: 'string',
            description: 'Additional description for the reminder',
          },
          timezone: {
            type: 'string',
            description: 'Timezone for the reminder (default: Europe/Berlin)',
          },
        },
        required: ['title', 'due', 'topicId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: 'List active reminders for a topic',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'Topic ID to list reminders for',
          },
          range: {
            type: 'object',
            description: 'Date range filter',
            properties: {
              fromISO: {
                type: 'string',
                description: 'Start date in ISO 8601 format',
              },
              toISO: {
                type: 'string',
                description: 'End date in ISO 8601 format',
              },
            },
          },
        },
        required: ['topicId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reminder',
      description: 'Cancel an active reminder',
      parameters: {
        type: 'object',
        properties: {
          reminderId: {
            type: 'string',
            description: 'ID of the reminder to cancel',
          },
        },
        required: ['reminderId'],
      },
    },
  },
];

// Tool execution functions
export async function executeReminderTool(
  toolName: string,
  args: any,
  userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case 'create_reminder':
        return await createReminder(args, userId, chatId, telegramTopicId);
      case 'list_reminders':
        return await listReminders(args);
      case 'cancel_reminder':
        return await cancelReminder(args);
      default:
        return {
          success: false,
          result: null,
          error: `Unknown reminder tool: ${toolName}`,
        };
    }
  } catch (error) {
    logger.error(`Error executing reminder tool ${toolName}:`, error);
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createReminder(
  args: any,
  userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  const validatedArgs = createReminderSchema.parse(args);
  
  // Find the topic
  const topic = await Topic.findById(validatedArgs.topicId);
  if (!topic) {
    return {
      success: false,
      result: null,
      error: 'Topic not found',
    };
  }
  
  // Create reminder document
  const reminder = new Reminder({
    topicId: topic._id,
    chatId,
    telegramTopicId,
    userId,
    title: validatedArgs.title,
    description: validatedArgs.description,
    dueISO: validatedArgs.due,
    timezone: validatedArgs.timezone,
    status: 'scheduled',
    repeat: validatedArgs.repeat,
    runCount: 0,
  });
  
  await reminder.save();
  
  // Schedule the reminder job
  const dueDate = new Date(validatedArgs.due);
  const delay = dueDate.getTime() - Date.now();
  
  if (delay > 0) {
    const job = await reminderQueue.add(
      'send-reminder',
      {
        reminderId: (reminder as any)._id.toString(),
        chatId,
        topicId: telegramTopicId,
        title: validatedArgs.title,
        description: validatedArgs.description,
        userId,
      },
      {
        delay,
        jobId: `reminder-${reminder._id}`,
      }
    );
    
    reminder.jobId = job.id || '';
    reminder.nextRun = dueDate;
    await reminder.save();
  }
  
  logger.info(`Created reminder: ${validatedArgs.title} for ${validatedArgs.due}`);
  
  return {
    success: true,
    result: {
      id: (reminder as any)._id.toString(),
      title: validatedArgs.title,
      due: validatedArgs.due,
      timezone: validatedArgs.timezone,
      repeat: validatedArgs.repeat,
      message: `✅ Напоминание создано: "${validatedArgs.title}" на ${new Date(validatedArgs.due).toLocaleString('ru-RU', { timeZone: validatedArgs.timezone })}`,
    },
  };
}

async function listReminders(args: any): Promise<ToolExecutionResult> {
  const validatedArgs = listRemindersSchema.parse(args);
  
  // Find the topic
  const topic = await Topic.findById(validatedArgs.topicId);
  if (!topic) {
    return {
      success: false,
      result: null,
      error: 'Topic not found',
    };
  }
  
  // Build query
  const query: any = {
    topicId: topic._id,
    status: 'scheduled',
  };
  
  if (validatedArgs.range) {
    query.dueISO = {};
    if (validatedArgs.range.fromISO) {
      query.dueISO.$gte = validatedArgs.range.fromISO;
    }
    if (validatedArgs.range.toISO) {
      query.dueISO.$lte = validatedArgs.range.toISO;
    }
  }
  
  const reminders = await Reminder.find(query).sort({ dueISO: 1 });
  
  const reminderList = reminders.map(reminder => ({
    id: (reminder as any)._id.toString(),
    title: reminder.title,
    due: reminder.dueISO,
    timezone: reminder.timezone,
    repeat: reminder.repeat,
    description: reminder.description,
  }));
  
  return {
    success: true,
    result: {
      count: reminderList.length,
      reminders: reminderList,
      message: `📅 Найдено ${reminderList.length} активных напоминаний`,
    },
  };
}

async function cancelReminder(args: any): Promise<ToolExecutionResult> {
  const validatedArgs = cancelReminderSchema.parse(args);
  
  const reminder = await Reminder.findById(validatedArgs.reminderId);
  if (!reminder) {
    return {
      success: false,
      result: null,
      error: 'Reminder not found',
    };
  }
  
  if (reminder.status !== 'scheduled') {
    return {
      success: false,
      result: null,
      error: 'Reminder is not active',
    };
  }
  
  // Cancel the job if it exists
  if (reminder.jobId) {
    try {
      const job = await reminderQueue.getJob(reminder.jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      logger.warn('Failed to remove job from queue:', error);
    }
  }
  
  // Update reminder status
  reminder.status = 'cancelled';
  await reminder.save();
  
  logger.info(`Cancelled reminder: ${reminder.title}`);
  
  return {
    success: true,
    result: {
      id: (reminder as any)._id.toString(),
      title: reminder.title,
      message: `❌ Напоминание отменено: "${reminder.title}"`,
    },
  };
}