import { Schema, model, Document } from 'mongoose';

export interface ISummary extends Document {
  topicId: Schema.Types.ObjectId;
  chatId: number;
  telegramTopicId: number;
  grain: 'day' | 'week' | 'month' | 'year';
  periodKey: string; // YYYY-MM-DD | GGGG-[W]WW | YYYY-MM | YYYY
  text: string;
  messageCount: number;
  startDate: Date;
  endDate: Date;
  model: string;
  provider: string;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
    sourceMessages?: number;
    keyTopics?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
  createdAt: Date;
  updatedAt: Date;
}

const summarySchema = new Schema<ISummary>({
  topicId: {
    type: Schema.Types.ObjectId,
    ref: 'Topic',
    required: true,
    index: true,
  },
  chatId: {
    type: Number,
    required: true,
    index: true,
  },
  telegramTopicId: {
    type: Number,
    required: true,
  },
  grain: {
    type: String,
    required: true,
    enum: ['day', 'week', 'month', 'year'],
  },
  periodKey: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  messageCount: {
    type: Number,
    required: true,
    default: 0,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  provider: {
    type: String,
    required: true,
  },
  metadata: {
    tokensUsed: Number,
    processingTime: Number,
    sourceMessages: Number,
    keyTopics: [String],
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
  },
}, {
  timestamps: true,
});

// Compound index for unique summary per topic/grain/period
summarySchema.index({ topicId: 1, grain: 1, periodKey: 1 }, { unique: true });
summarySchema.index({ chatId: 1, telegramTopicId: 1, grain: 1, periodKey: 1 });
summarySchema.index({ createdAt: -1 });

export const Summary = model<ISummary>('Summary', summarySchema);