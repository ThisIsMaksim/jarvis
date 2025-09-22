import { ToolDefinition, ToolExecutionResult } from '../types.js';
import { reminderTools, executeReminderTool } from './reminders.js';
import { summaryTools, executeSummaryTool } from './summaries.js';
import { noteTools, executeNoteTool } from './notes.js';
import { createChildLogger } from '../../config/logger.js';

const logger = createChildLogger('tools');

// Combine all tool definitions
export const allTools: ToolDefinition[] = [
  ...reminderTools,
  ...summaryTools,
  ...noteTools,
];

// Tool execution router
export async function executeTools(
  toolCalls: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>,
  userId: number,
  chatId: number,
  telegramTopicId: number
): Promise<Array<{
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}>> {
  const results = [];

  for (const toolCall of toolCalls) {
    try {
      logger.info(`Executing tool: ${toolCall.function.name}`);
      
      // Parse arguments
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        logger.error(`Failed to parse tool arguments: ${toolCall.function.arguments}`);
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          name: toolCall.function.name,
          content: JSON.stringify({
            success: false,
            error: 'Invalid tool arguments format',
          }),
        });
        continue;
      }

      // Execute the appropriate tool
      let result: ToolExecutionResult;
      
      if (reminderTools.some(tool => tool.function.name === toolCall.function.name)) {
        result = await executeReminderTool(
          toolCall.function.name,
          args,
          userId,
          chatId,
          telegramTopicId
        );
      } else if (summaryTools.some(tool => tool.function.name === toolCall.function.name)) {
        result = await executeSummaryTool(
          toolCall.function.name,
          args,
          userId,
          chatId,
          telegramTopicId
        );
      } else if (noteTools.some(tool => tool.function.name === toolCall.function.name)) {
        result = await executeNoteTool(
          toolCall.function.name,
          args,
          userId,
          chatId,
          telegramTopicId
        );
      } else {
        logger.error(`Unknown tool: ${toolCall.function.name}`);
        result = {
          success: false,
          result: null,
          error: `Unknown tool: ${toolCall.function.name}`,
        };
      }

      // Add result to response
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        name: toolCall.function.name,
        content: JSON.stringify(result),
      });

      logger.info(`Tool ${toolCall.function.name} executed: ${result.success ? 'success' : 'failed'}`);

    } catch (error) {
      logger.error(`Error executing tool ${toolCall.function.name}:`, error);
      
      results.push({
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        name: toolCall.function.name,
        content: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  }

  return results;
}

// Get tools by category
export function getReminderTools(): ToolDefinition[] {
  return reminderTools;
}

export function getSummaryTools(): ToolDefinition[] {
  return summaryTools;
}

export function getNoteTools(): ToolDefinition[] {
  return noteTools;
}

// Get tool by name
export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find(tool => tool.function.name === name);
}

// Check if tool exists
export function isValidTool(name: string): boolean {
  return allTools.some(tool => tool.function.name === name);
}