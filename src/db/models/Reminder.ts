import { Schema, model, Document } from 'mongoose';

export interface IReminder extends Document {
  topicId: Schema.Types.ObjectId;
  chatId: number;
  telegramTopicId: number;
  userId: number;
  title: string;
  description?: string;
  dueISO: string; // ISO 8601 datetime string
  timezone: string;
  status: 'scheduled' | 'sent' | 'cancelled' | 'failed';
  repeat?: {
    freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CRON';
    interval?: number;
    byDay?: string[]; // ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
    cron?: string; // For complex schedules
    until?: Date; // End date for recurring reminders
    count?: number; // Max number of occurrences
  };
  jobId?: string; // BullMQ job ID
  nextRun?: Date; // Next scheduled run for recurring reminders
  lastRun?: Date; // Last execution time
  runCount: number; // Number of times this reminder has been executed
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    originalMessage?: string;
    createdBy?: string; // Username who created the reminder
    lastError?: string;
  };
}

const reminderSchema = new Schema<IReminder>({
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
  userId: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  dueISO: {
    type: String,
    required: true,
  },
  timezone: {
    type: String,
    required: true,
    default: 'Europe/Berlin',
  },
  status: {
    type: String,
    required: true,
    enum: ['scheduled', 'sent', 'cancelled', 'failed'],
    default: 'scheduled',
  },
  repeat: {
    freq: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'CRON'],
    },
    interval: {
      type: Number,
      default: 1,
    },
    byDay: [{
      type: String,
      enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
    }],
    cron: {
      type: String,
    },
    until: {
      type: Date,
    },
    count: {
      type: Number,
    },
  },
  jobId: {
    type: String,
    index: true,
  },
  nextRun: {
    type: Date,
    index: true,
  },
  lastRun: {
    type: Date,
  },
  runCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    originalMessage: String,
    createdBy: String,
    lastError: String,
  },
}, {
  timestamps: true,
});

reminderSchema.index({ topicId: 1, status: 1 });
reminderSchema.index({ chatId: 1, telegramTopicId: 1, status: 1 });
reminderSchema.index({ userId: 1, status: 1 });
reminderSchema.index({ nextRun: 1, status: 1 });
reminderSchema.index({ dueISO: 1 });

export const Reminder = model<IReminder>('Reminder', reminderSchema);