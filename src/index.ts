import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { connectToMongoDB } from './db/mongo.js';
import { startBot } from './bot/bot.js';
import { startServer } from './server/http.js';
import { createReminderWorker } from './jobs/workers/reminder.worker.js';
import { createSummaryWorker } from './jobs/workers/summary.worker.js';
import { bot } from './bot/bot.js';

// Import handlers
import { handleStart, handleHelp, handleModel, handleReminders, handleSummary, handleTopic } from './bot/handlers/commands.js';
import { handleText } from './bot/handlers/text.js';

async function main() {
  try {
    logger.info('🚀 Starting Telegram AI Bot...');
    logger.info(`Environment: ${config.NODE_ENV}`);
    logger.info(`Default provider: ${config.DEFAULT_PROVIDER}`);
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Register bot handlers
    registerBotHandlers();
    
    // Start workers
    const reminderWorker = createReminderWorker(bot);
    const summaryWorker = createSummaryWorker();
    
    logger.info('✅ Workers started');
    
    // Start HTTP server (includes webhook setup if configured)
    await startServer();
    
    // Start bot (polling mode if no webhook)
    if (!config.WEBHOOK_URL) {
      await startBot();
    }
    
    logger.info('🎉 Telegram AI Bot is running!');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      
      try {
        // Stop workers
        await reminderWorker.close();
        await summaryWorker.close();
        
        // Stop bot
        await bot.stop();
        
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      
      try {
        await reminderWorker.close();
        await summaryWorker.close();
        await bot.stop();
        
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    logger.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

function registerBotHandlers() {
  // Command handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('model', handleModel);
  bot.command('reminders', handleReminders);
  bot.command('summary', handleSummary);
  bot.command('topic', handleTopic);
  
  // Text message handler
  bot.on('message:text', handleText);
  
  // TODO: Add handlers for:
  // - Photos/images
  // - Voice messages
  // - Documents
  // - Callback queries (inline buttons)
  
  logger.info('✅ Bot handlers registered');
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});