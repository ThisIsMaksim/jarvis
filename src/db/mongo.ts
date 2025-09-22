import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { createChildLogger } from '../config/logger.js';

const logger = createChildLogger('mongodb');

export async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info('✅ Connected to MongoDB');
    
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export { mongoose };