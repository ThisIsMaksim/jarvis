import { Schema, model, Document } from 'mongoose';

export interface ITopic extends Document {
  chatId: number;
  topicId: number;
  title: string;
  iconColor?: number;
  iconCustomEmojiId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  messageCount: number;
  isActive: boolean;
  settings: {
    providerPrefs?: {
      provider: 'openai' | 'gemini';
      model: string;
    };
    systemPromptOverride?: string;
    maxContextWindow?: number;
    timezone?: string;
    autoSummary?: {
      enabled: boolean;
      dailyAt?: string; // HH:mm format
      weeklyAt?: string; // day-HH:mm format (e.g., "monday-09:00")
      monthlyAt?: string; // day-HH:mm format (e.g., "1-09:00")
    };
  };
}

const topicSchema = new Schema<ITopic>({
  chatId: {
    type: Number,
    required: true,
    index: true,
  },
  topicId: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  iconColor: {
    type: Number,
  },
  iconCustomEmojiId: {
    type: String,
  },
  lastMessageAt: {
    type: Date,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  settings: {
    providerPrefs: {
      provider: {
        type: String,
        enum: ['openai', 'gemini'],
      },
      model: {
        type: String,
      },
    },
    systemPromptOverride: {
      type: String,
    },
    maxContextWindow: {
      type: Number,
      default: 50,
    },
    timezone: {
      type: String,
      default: 'Europe/Berlin',
    },
    autoSummary: {
      enabled: {
        type: Boolean,
        default: true,
      },
      dailyAt: {
        type: String,
        default: '03:30',
      },
      weeklyAt: {
        type: String,
        default: 'monday-03:30',
      },
      monthlyAt: {
        type: String,
        default: '1-03:30',
      },
    },
  },
}, {
  timestamps: true,
});

// Compound index for unique topic per chat
topicSchema.index({ chatId: 1, topicId: 1 }, { unique: true });
topicSchema.index({ lastMessageAt: -1 });
topicSchema.index({ isActive: 1 });

export const Topic = model<ITopic>('Topic', topicSchema);