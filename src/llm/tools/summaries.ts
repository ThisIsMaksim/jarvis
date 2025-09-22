import { z } from 'zod';
import { createChildLogger } from '../../config/logger.js';
import { Summary } from '../../db/models/Summary.js';
import { Topic } from '../../db/models/Topic.js';
import { summaryQueue } from '../../jobs/queue.js';
import { ToolDefinition, ToolExecutionResult } from '../types.js';
import { format, parseISO } from 'date-fns';

const logger = createChildLogger('summaries-tool');

// Zod schemas for validation
const getSummarySchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
  grain: z.enum(['day', 'week', 'month', 'year']),
  date: z.string().optional(), // ISO date string, defaults to current date
});

// Tool definitions
export const summaryTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_summary',
      description: 'Get or generate a summary for a topic for a specific time period',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'Topic ID to get summary for',
          },
          grain: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year'],
            description: 'Time period granularity for the summary',
          },
          date: {
            type: 'string',
            description: 'Target date in ISO format (YYYY-MM-DD). Defaults to current date.',
          },
        },
        required: ['topicId', 'grain'],
      },
    },
  },
];

// Tool execution functions
export async function executeSummaryTool(
  toolName: string,
  args: any,
  _userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case 'get_summary':
        return await getSummary(args, chatId, telegramTopicId);
      default:
        return {
          success: false,
          result: null,
          error: `Unknown summary tool: ${toolName}`,
        };
    }
  } catch (error) {
    logger.error(`Error executing summary tool ${toolName}:`, error);
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getSummary(
  args: any,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  const validatedArgs = getSummarySchema.parse(args);
  
  // Find the topic
  const topic = await Topic.findById(validatedArgs.topicId);
  if (!topic) {
    return {
      success: false,
      result: null,
      error: 'Topic not found',
    };
  }
  
  // Use current date if not provided
  const targetDate = validatedArgs.date ? parseISO(validatedArgs.date) : new Date();
  const timezone = topic.settings.timezone || 'Europe/Berlin';
  
  // Generate period key based on grain
  let periodKey: string;
  switch (validatedArgs.grain) {
    case 'day':
      periodKey = format(targetDate, 'yyyy-MM-dd');
      break;
    case 'week':
      periodKey = format(targetDate, 'RRRR-[W]II');
      break;
    case 'month':
      periodKey = format(targetDate, 'yyyy-MM');
      break;
    case 'year':
      periodKey = format(targetDate, 'yyyy');
      break;
  }
  
  // Check if summary already exists
  let summary = await Summary.findOne({
    topicId: topic._id,
    grain: validatedArgs.grain,
    periodKey: periodKey!,
  });
  
  if (summary) {
    logger.info(`Found existing summary for ${validatedArgs.grain} ${periodKey}`);
    
    return {
      success: true,
      result: {
        summary: {
          id: (summary as any)._id.toString(),
          grain: (summary as any).grain,
          periodKey: (summary as any).periodKey,
          text: (summary as any).text,
          messageCount: (summary as any).messageCount,
          createdAt: (summary as any).createdAt,
          model: (summary as any).llmModel,
          provider: (summary as any).provider,
        },
        message: `📊 **Саммари за ${getGrainDisplayName(validatedArgs.grain)}** (${periodKey})\n\n${(summary as any).text}`,
      },
    };
  }
  
  // Summary doesn't exist, initiate generation
  logger.info(`Initiating summary generation for ${validatedArgs.grain} ${periodKey}`);
  
  try {
    await summaryQueue.add(
      'generate-summary',
      {
        topicId: validatedArgs.topicId,
        chatId,
        telegramTopicId,
        grain: validatedArgs.grain,
        date: targetDate.toISOString(),
        timezone,
      },
      {
        jobId: `summary-${validatedArgs.topicId}-${validatedArgs.grain}-${periodKey}`,
      }
    );
    
    return {
      success: true,
      result: {
        summary: null,
        generating: true,
        message: `🔄 **Генерирую саммари за ${getGrainDisplayName(validatedArgs.grain)}** (${periodKey})\n\nСаммари будет готово через несколько секунд. Попробуйте запросить его снова через минуту.`,
      },
    };
    
  } catch (error) {
    logger.error('Failed to queue summary generation:', error);
    
    return {
      success: false,
      result: null,
      error: 'Failed to initiate summary generation',
    };
  }
}

function getGrainDisplayName(grain: string): string {
  switch (grain) {
    case 'day':
      return 'день';
    case 'week':
      return 'неделю';
    case 'month':
      return 'месяц';
    case 'year':
      return 'год';
    default:
      return grain;
  }
}