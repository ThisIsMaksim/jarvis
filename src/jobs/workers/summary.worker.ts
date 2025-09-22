import { Worker, Job } from 'bullmq';
import { defaultWorkerOptions } from '../queue.js';
import { createChildLogger } from '../../config/logger.js';
import { Summary } from '../../db/models/Summary.js';
import { Message } from '../../db/models/Message.js';
import { Topic } from '../../db/models/Topic.js';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const logger = createChildLogger('summary-worker');

export interface SummaryJobData {
  topicId: string;
  chatId: number;
  telegramTopicId: number;
  grain: 'day' | 'week' | 'month' | 'year';
  date: string; // ISO date string
  timezone: string;
}

export function createSummaryWorker() {
  const worker = new Worker(
    'summary',
    async (job: Job<SummaryJobData>) => {
      const { topicId, chatId, telegramTopicId, grain, date, timezone } = job.data;
      
      logger.info(`Processing summary job: ${grain} for topic ${topicId} on ${date}`);
      
      try {
        // Find the topic
        const topic = await Topic.findById(topicId);
        if (!topic) {
          throw new Error(`Topic ${topicId} not found`);
        }
        
        // Calculate date range
        const targetDate = new Date(date);
        const zonedDate = utcToZonedTime(targetDate, timezone);
        
        let startDate: Date;
        let endDate: Date;
        let periodKey: string;
        
        switch (grain) {
          case 'day':
            startDate = zonedTimeToUtc(startOfDay(zonedDate), timezone);
            endDate = zonedTimeToUtc(endOfDay(zonedDate), timezone);
            periodKey = format(zonedDate, 'yyyy-MM-dd');
            break;
            
          case 'week':
            startDate = zonedTimeToUtc(startOfWeek(zonedDate, { weekStartsOn: 1 }), timezone);
            endDate = zonedTimeToUtc(endOfWeek(zonedDate, { weekStartsOn: 1 }), timezone);
            periodKey = format(zonedDate, 'RRRR-[W]II');
            break;
            
          case 'month':
            startDate = zonedTimeToUtc(startOfMonth(zonedDate), timezone);
            endDate = zonedTimeToUtc(endOfMonth(zonedDate), timezone);
            periodKey = format(zonedDate, 'yyyy-MM');
            break;
            
          case 'year':
            startDate = zonedTimeToUtc(startOfYear(zonedDate), timezone);
            endDate = zonedTimeToUtc(endOfYear(zonedDate), timezone);
            periodKey = format(zonedDate, 'yyyy');
            break;
            
          default:
            throw new Error(`Invalid grain: ${grain}`);
        }
        
        // Check if summary already exists
        const existingSummary = await Summary.findOne({
          topicId,
          grain,
          periodKey,
        });
        
        if (existingSummary) {
          logger.info(`Summary already exists for ${grain} ${periodKey} in topic ${topicId}`);
          return;
        }
        
        // Get messages for the period
        const messages = await Message.find({
          topicId,
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
          role: { $in: ['user', 'assistant'] },
        }).sort({ createdAt: 1 });
        
        if (messages.length === 0) {
          logger.info(`No messages found for ${grain} ${periodKey} in topic ${topicId}`);
          return;
        }
        
        // Generate summary text
        const summaryText = await generateSummaryText(messages, grain, topic.title);
        
        // Create summary document
        const summary = new Summary({
          topicId,
          chatId,
          telegramTopicId,
          grain,
          periodKey,
          text: summaryText,
          messageCount: messages.length,
          startDate,
          endDate,
          model: 'gpt-4o-mini', // This should come from the LLM provider
          provider: 'openai',
          metadata: {
            sourceMessages: messages.length,
            processingTime: Date.now() - job.processedOn!,
          },
        });
        
        await summary.save();
        
        logger.info(`Summary created for ${grain} ${periodKey} in topic ${topicId}`);
        
      } catch (error) {
        logger.error(`Failed to process summary job:`, error);
        throw error;
      }
    },
    defaultWorkerOptions
  );
  
  worker.on('completed', (job) => {
    logger.info(`Summary job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Summary job ${job?.id} failed:`, err);
  });
  
  return worker;
}

async function generateSummaryText(messages: any[], grain: string, topicTitle: string): Promise<string> {
  // This is a simplified version - in real implementation, this would use the LLM provider
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  let summary = `📊 **Саммари ${grain === 'day' ? 'за день' : grain === 'week' ? 'за неделю' : grain === 'month' ? 'за месяц' : 'за год'}**\n\n`;
  summary += `**Топик:** ${topicTitle}\n`;
  summary += `**Всего сообщений:** ${messages.length}\n`;
  summary += `**От пользователей:** ${userMessages.length}\n`;
  summary += `**От ассистента:** ${assistantMessages.length}\n\n`;
  
  // Extract key topics (simplified)
  const allContent = messages.map(m => m.content).join(' ');
  const words = allContent.toLowerCase().split(/\s+/);
  const wordCount = words.reduce((acc: Record<string, number>, word) => {
    if (word.length > 3) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {});
  
  const topWords = Object.entries(wordCount)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([word]) => word);
  
  if (topWords.length > 0) {
    summary += `**Ключевые темы:** ${topWords.join(', ')}\n\n`;
  }
  
  summary += `**Основные моменты:**\n`;
  summary += `• Активное обсуждение в топике "${topicTitle}"\n`;
  summary += `• Обработано ${messages.length} сообщений\n`;
  summary += `• Период активности зафиксирован\n`;
  
  return summary;
}