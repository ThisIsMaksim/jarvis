import { Worker, Job } from 'bullmq';
import { defaultWorkerOptions } from '../queue.js';
import { createChildLogger } from '../../config/logger.js';
import { Reminder } from '../../db/models/Reminder.js';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/bot.js';

const logger = createChildLogger('reminder-worker');

export interface ReminderJobData {
  reminderId: string;
  chatId: number;
  topicId: number;
  title: string;
  description?: string;
  userId: number;
}

export function createReminderWorker(bot: Bot<BotContext>) {
  const worker = new Worker(
    'reminder',
    async (job: Job<ReminderJobData>) => {
      const { reminderId, chatId, topicId, title, description } = job.data;
      
      logger.info(`Processing reminder job: ${reminderId}`);
      
      try {
        // Find the reminder in database
        const reminder = await Reminder.findById(reminderId);
        if (!reminder) {
          throw new Error(`Reminder ${reminderId} not found`);
        }
        
        // Check if reminder is still scheduled
        if (reminder.status !== 'scheduled') {
          logger.info(`Reminder ${reminderId} is no longer scheduled (status: ${reminder.status})`);
          return;
        }
        
        // Prepare reminder message
        let message = `⏰ **Напоминание**\n\n${title}`;
        if (description) {
          message += `\n\n${description}`;
        }
        
        // Send reminder to the topic
        await bot.api.sendMessage(chatId, message, {
          message_thread_id: topicId,
          parse_mode: 'Markdown',
        });
        
        // Update reminder status
        reminder.status = 'sent';
        reminder.lastRun = new Date();
        reminder.runCount += 1;
        
        // Handle recurring reminders
        if (reminder.repeat) {
          const nextRun = calculateNextRun(reminder);
          if (nextRun) {
            reminder.nextRun = nextRun;
            reminder.status = 'scheduled';
            
            // Schedule next occurrence
            await scheduleNextReminder(reminder, bot);
          }
        }
        
        await reminder.save();
        
        logger.info(`Reminder ${reminderId} sent successfully`);
        
      } catch (error) {
        logger.error(`Failed to process reminder ${reminderId}:`, error);
        
        // Update reminder status to failed
        try {
          await Reminder.findByIdAndUpdate(reminderId, {
            status: 'failed',
            'metadata.lastError': error instanceof Error ? error.message : String(error),
          });
        } catch (updateError) {
          logger.error(`Failed to update reminder status:`, updateError);
        }
        
        throw error;
      }
    },
    defaultWorkerOptions
  );
  
  worker.on('completed', (job) => {
    logger.info(`Reminder job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Reminder job ${job?.id} failed:`, err);
  });
  
  return worker;
}

function calculateNextRun(reminder: any): Date | null {
  if (!reminder.repeat) return null;
  
  const now = new Date();
  const { freq, interval = 1, until, count } = reminder.repeat;
  
  // Check if we've reached the limit
  if (until && now > until) return null;
  if (count && reminder.runCount >= count) return null;
  
  const currentDue = new Date(reminder.dueISO);
  let nextRun: Date;
  
  switch (freq) {
    case 'DAILY':
      nextRun = new Date(currentDue);
      nextRun.setDate(nextRun.getDate() + interval);
      break;
      
    case 'WEEKLY':
      nextRun = new Date(currentDue);
      nextRun.setDate(nextRun.getDate() + (7 * interval));
      break;
      
    case 'MONTHLY':
      nextRun = new Date(currentDue);
      nextRun.setMonth(nextRun.getMonth() + interval);
      break;
      
    default:
      return null;
  }
  
  return nextRun;
}

async function scheduleNextReminder(reminder: any, _bot: Bot<BotContext>) {
  // This would be implemented to schedule the next occurrence
  // For now, we'll just log it
  logger.info(`Next reminder scheduled for ${reminder.nextRun}`);
}