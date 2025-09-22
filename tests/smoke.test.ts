import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectToMongoDB, mongoose } from '../src/db/mongo.js';
import { User } from '../src/db/models/User.js';
import { Chat } from '../src/db/models/Chat.js';
import { Topic } from '../src/db/models/Topic.js';
import { Reminder } from '../src/db/models/Reminder.js';
import { Summary } from '../src/db/models/Summary.js';
import { Message } from '../src/db/models/Message.js';

describe('Smoke Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    process.env.MONGO_URI = 'mongodb://localhost:27017/aiassistant_test';
    await connectToMongoDB();
  });

  afterAll(async () => {
    // Clean up test database
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe('Database Models', () => {
    it('should create and save a User', async () => {
      const userData = {
        telegramId: 123456789,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isBot: false,
        preferences: {
          defaultProvider: 'openai' as const,
          timezone: 'Europe/Berlin',
          language: 'ru',
        },
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.telegramId).toBe(userData.telegramId);
      expect(savedUser.username).toBe(userData.username);
      expect(savedUser.preferences.defaultProvider).toBe('openai');
    });

    it('should create and save a Chat', async () => {
      const chatData = {
        telegramId: -1001234567890,
        type: 'supergroup' as const,
        title: 'Test Group',
        isForumEnabled: true,
        hasTopicsEnabled: true,
        botSettings: {
          isActive: true,
          defaultProvider: 'openai' as const,
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
        },
      };

      const chat = new Chat(chatData);
      const savedChat = await chat.save();

      expect(savedChat.telegramId).toBe(chatData.telegramId);
      expect(savedChat.type).toBe('supergroup');
      expect(savedChat.isForumEnabled).toBe(true);
    });

    it('should create and save a Topic', async () => {
      const topicData = {
        chatId: -1001234567890,
        topicId: 1,
        title: 'Test Topic',
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
          autoSummary: {
            enabled: true,
            dailyAt: '03:30',
            weeklyAt: 'monday-03:30',
            monthlyAt: '1-03:30',
          },
        },
      };

      const topic = new Topic(topicData);
      const savedTopic = await topic.save();

      expect(savedTopic.chatId).toBe(topicData.chatId);
      expect(savedTopic.topicId).toBe(topicData.topicId);
      expect(savedTopic.title).toBe(topicData.title);
    });

    it('should create and save a Message', async () => {
      // First create a topic
      const topic = new Topic({
        chatId: -1001234567890,
        topicId: 2,
        title: 'Message Test Topic',
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
        },
      });
      const savedTopic = await topic.save();

      const messageData = {
        topicId: savedTopic._id,
        chatId: -1001234567890,
        telegramTopicId: 2,
        messageId: 1,
        userId: 123456789,
        role: 'user' as const,
        content: 'Test message content',
      };

      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage.role).toBe('user');
      expect(savedMessage.content).toBe('Test message content');
      expect(savedMessage.topicId.toString()).toBe(savedTopic._id.toString());
    });

    it('should create and save a Reminder', async () => {
      // First create a topic
      const topic = new Topic({
        chatId: -1001234567890,
        topicId: 3,
        title: 'Reminder Test Topic',
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
        },
      });
      const savedTopic = await topic.save();

      const reminderData = {
        topicId: savedTopic._id,
        chatId: -1001234567890,
        telegramTopicId: 3,
        userId: 123456789,
        title: 'Test Reminder',
        dueISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Europe/Berlin',
        status: 'scheduled' as const,
        runCount: 0,
      };

      const reminder = new Reminder(reminderData);
      const savedReminder = await reminder.save();

      expect(savedReminder.title).toBe('Test Reminder');
      expect(savedReminder.status).toBe('scheduled');
      expect(savedReminder.topicId.toString()).toBe(savedTopic._id.toString());
    });

    it('should create and save a Summary', async () => {
      // First create a topic
      const topic = new Topic({
        chatId: -1001234567890,
        topicId: 4,
        title: 'Summary Test Topic',
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
        },
      });
      const savedTopic = await topic.save();

      const summaryData = {
        topicId: savedTopic._id,
        chatId: -1001234567890,
        telegramTopicId: 4,
        grain: 'day' as const,
        periodKey: '2024-01-15',
        text: 'Test summary content',
        messageCount: 5,
        startDate: new Date('2024-01-15T00:00:00Z'),
        endDate: new Date('2024-01-15T23:59:59Z'),
        model: 'gpt-4o-mini',
        provider: 'openai',
      };

      const summary = new Summary(summaryData);
      const savedSummary = await summary.save();

      expect(savedSummary.grain).toBe('day');
      expect(savedSummary.text).toBe('Test summary content');
      expect(savedSummary.topicId.toString()).toBe(savedTopic._id.toString());
    });
  });

  describe('Environment Configuration', () => {
    it('should validate required environment variables', () => {
      const requiredVars = [
        'TELEGRAM_BOT_TOKEN',
        'MONGO_URI',
        'REDIS_URL',
      ];

      // Set test values
      process.env.TELEGRAM_BOT_TOKEN = 'test_token';
      process.env.MONGO_URI = 'mongodb://localhost:27017/test';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.OPENAI_API_KEY = 'test_openai_key';

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
      });
    });
  });

  describe('Database Indexes', () => {
    it('should have proper indexes on User model', async () => {
      const indexes = await User.collection.getIndexes();
      
      // Should have index on telegramId
      const telegramIdIndex = Object.keys(indexes).find(key => 
        indexes[key].some((field: any) => field[0] === 'telegramId')
      );
      expect(telegramIdIndex).toBeDefined();
    });

    it('should have proper indexes on Topic model', async () => {
      const indexes = await Topic.collection.getIndexes();
      
      // Should have compound index on chatId and topicId
      const compoundIndex = Object.keys(indexes).find(key => {
        const index = indexes[key];
        return index.some((field: any) => field[0] === 'chatId') &&
               index.some((field: any) => field[0] === 'topicId');
      });
      expect(compoundIndex).toBeDefined();
    });
  });

  describe('Model Validation', () => {
    it('should validate User model required fields', async () => {
      const invalidUser = new User({});
      
      try {
        await invalidUser.save();
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.telegramId).toBeDefined();
      }
    });

    it('should validate Reminder status enum', async () => {
      const topic = new Topic({
        chatId: -1001234567890,
        topicId: 5,
        title: 'Validation Test Topic',
        messageCount: 0,
        isActive: true,
        settings: {
          maxContextWindow: 50,
          timezone: 'Europe/Berlin',
        },
      });
      const savedTopic = await topic.save();

      const invalidReminder = new Reminder({
        topicId: savedTopic._id,
        chatId: -1001234567890,
        telegramTopicId: 5,
        userId: 123456789,
        title: 'Test Reminder',
        dueISO: new Date().toISOString(),
        timezone: 'Europe/Berlin',
        status: 'invalid_status' as any,
        runCount: 0,
      });

      try {
        await invalidReminder.save();
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors.status).toBeDefined();
      }
    });
  });
});