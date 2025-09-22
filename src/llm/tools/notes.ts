import { z } from 'zod';
import { createChildLogger } from '../../config/logger.js';
import { Message } from '../../db/models/Message.js';
import { Topic } from '../../db/models/Topic.js';
import { ToolDefinition, ToolExecutionResult } from '../types.js';

const logger = createChildLogger('notes-tool');

// Zod schemas for validation
const appendNoteSchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
  text: z.string().min(1, 'Note text is required'),
  tags: z.array(z.string()).optional(),
});

const getContextWindowSchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
  limit: z.number().int().positive().max(100).default(20),
});

// Tool definitions
export const noteTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'append_note',
      description: 'Save a note to the topic',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'Topic ID where the note belongs',
          },
          text: {
            type: 'string',
            description: 'Note content',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Optional tags for the note',
          },
        },
        required: ['topicId', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_context_window',
      description: 'Get recent messages from the topic for context',
      parameters: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            description: 'Topic ID to get messages from',
          },
          limit: {
            type: 'number',
            description: 'Number of recent messages to retrieve (max 100, default 20)',
          },
        },
        required: ['topicId'],
      },
    },
  },
];

// Tool execution functions
export async function executeNoteTool(
  toolName: string,
  args: any,
  userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case 'append_note':
        return await appendNote(args, userId, chatId, telegramTopicId);
      case 'get_context_window':
        return await getContextWindow(args);
      default:
        return {
          success: false,
          result: null,
          error: `Unknown note tool: ${toolName}`,
        };
    }
  } catch (error) {
    logger.error(`Error executing note tool ${toolName}:`, error);
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function appendNote(
  args: any,
  userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<ToolExecutionResult> {
  const validatedArgs = appendNoteSchema.parse(args);
  
  // Find the topic
  const topic = await Topic.findById(validatedArgs.topicId);
  if (!topic) {
    return {
      success: false,
      result: null,
      error: 'Topic not found',
    };
  }
  
  // Create a system message with the note
  const noteMessage = new Message({
    topicId: topic._id,
    chatId,
    telegramTopicId,
    messageId: 0, // System message
    userId,
    role: 'system',
    content: `📝 Заметка: ${validatedArgs.text}${validatedArgs.tags ? `\n\nТеги: ${validatedArgs.tags.join(', ')}` : ''}`,
    metadata: {
      type: 'note',
      tags: validatedArgs.tags,
    },
  });
  
  await noteMessage.save();
  
  // Update topic stats
  topic.messageCount += 1;
  topic.lastMessageAt = new Date();
  await topic.save();
  
  logger.info(`Saved note to topic ${topic.title}: ${validatedArgs.text.substring(0, 50)}...`);
  
  return {
    success: true,
    result: {
      noteId: (noteMessage as any)._id.toString(),
      text: validatedArgs.text,
      tags: validatedArgs.tags,
      message: `📝 **Заметка сохранена**\n\n${validatedArgs.text}${validatedArgs.tags ? `\n\n🏷️ Теги: ${validatedArgs.tags.join(', ')}` : ''}`,
    },
  };
}

async function getContextWindow(args: any): Promise<ToolExecutionResult> {
  const validatedArgs = getContextWindowSchema.parse(args);
  
  // Find the topic
  const topic = await Topic.findById(validatedArgs.topicId);
  if (!topic) {
    return {
      success: false,
      result: null,
      error: 'Topic not found',
    };
  }
  
  // Get recent messages
  const messages = await Message.find({
    topicId: topic._id,
    role: { $in: ['user', 'assistant', 'system'] },
  })
    .sort({ createdAt: -1 })
    .limit(validatedArgs.limit);
  
  // Reverse to get chronological order
  messages.reverse();
  
  const contextMessages = messages.map(msg => ({
    id: (msg as any)._id.toString(),
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt,
    userId: msg.userId,
    metadata: msg.metadata,
  }));
  
  return {
    success: true,
    result: {
      topicId: validatedArgs.topicId,
      topicTitle: topic.title,
      messageCount: contextMessages.length,
      messages: contextMessages,
      message: `💬 **Контекст топика "${topic.title}"**\n\nПоследние ${contextMessages.length} сообщений загружены`,
    },
  };
}