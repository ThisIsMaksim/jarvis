import fastify from 'fastify';
import { config } from '../config/env.js';
import { createChildLogger } from '../config/logger.js';
import { bot } from '../bot/bot.js';

const logger = createChildLogger('http-server');

export async function createServer() {
  const server = fastify({
    logger: false, // We use our own logger
  });

  // Health check endpoint
  server.get('/healthz', async (request, reply) => {
    try {
      // Check if bot is running
      const me = await bot.api.getMe();
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        bot: {
          id: me.id,
          username: me.username,
          first_name: me.first_name,
        },
        uptime: process.uptime(),
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      reply.code(503);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Webhook endpoint for Telegram
  if (config.WEBHOOK_URL) {
    server.post('/bot/webhook', async (request, reply) => {
      try {
        logger.debug('Received webhook update');
        
        // Handle the update
        await bot.handleUpdate(request.body as any);
        
        reply.code(200).send('OK');
      } catch (error) {
        logger.error('Webhook error:', error);
        reply.code(500).send('Internal Server Error');
      }
    });

    logger.info(`Webhook endpoint configured: ${config.WEBHOOK_URL}/bot/webhook`);
  }

  // Root endpoint
  server.get('/', async (request, reply) => {
    return {
      name: 'Telegram AI Bot',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error('HTTP server error:', error);
    reply.code(500).send({
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
    });
  });

  return server;
}

export async function startServer() {
  try {
    const server = await createServer();
    
    await server.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    
    logger.info(`🚀 HTTP server started on port ${config.PORT}`);
    
    // Set webhook if configured
    if (config.WEBHOOK_URL) {
      try {
        await bot.api.setWebhook(`${config.WEBHOOK_URL}/bot/webhook`);
        logger.info(`✅ Webhook set: ${config.WEBHOOK_URL}/bot/webhook`);
      } catch (error) {
        logger.error('Failed to set webhook:', error);
      }
    }
    
    return server;
  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    process.exit(1);
  }
}