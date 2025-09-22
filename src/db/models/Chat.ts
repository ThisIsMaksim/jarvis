import { Schema, model, Document } from 'mongoose';

export interface IChat extends Document {
  telegramId: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  description?: string;
  inviteLink?: string;
  pinnedMessage?: number;
  permissions?: Record<string, boolean>;
  slowModeDelay?: number;
  messageAutoDeleteTime?: number;
  hasProtectedContent?: boolean;
  stickerSetName?: string;
  canSetStickerSet?: boolean;
  linkedChatId?: number;
  location?: {
    longitude: number;
    latitude: number;
    title: string;
    address: string;
  };
  isForumEnabled: boolean;
  hasTopicsEnabled: boolean;
  lastTopicsCheckAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  botSettings: {
    isActive: boolean;
    defaultProvider?: 'openai' | 'gemini';
    defaultModel?: string;
    systemPromptOverride?: string;
    maxContextWindow?: number;
    timezone?: string;
  };
}

const chatSchema = new Schema<IChat>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['private', 'group', 'supergroup', 'channel'],
  },
  title: {
    type: String,
  },
  username: {
    type: String,
    sparse: true,
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  description: {
    type: String,
  },
  inviteLink: {
    type: String,
  },
  pinnedMessage: {
    type: Number,
  },
  permissions: {
    type: Schema.Types.Mixed,
  },
  slowModeDelay: {
    type: Number,
  },
  messageAutoDeleteTime: {
    type: Number,
  },
  hasProtectedContent: {
    type: Boolean,
  },
  stickerSetName: {
    type: String,
  },
  canSetStickerSet: {
    type: Boolean,
  },
  linkedChatId: {
    type: Number,
  },
  location: {
    longitude: Number,
    latitude: Number,
    title: String,
    address: String,
  },
  isForumEnabled: {
    type: Boolean,
    default: false,
  },
  hasTopicsEnabled: {
    type: Boolean,
    default: false,
  },
  lastTopicsCheckAt: {
    type: Date,
  },
  botSettings: {
    isActive: {
      type: Boolean,
      default: true,
    },
    defaultProvider: {
      type: String,
      enum: ['openai', 'gemini'],
    },
    defaultModel: {
      type: String,
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
  },
}, {
  timestamps: true,
});

chatSchema.index({ telegramId: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ isForumEnabled: 1, hasTopicsEnabled: 1 });

export const Chat = model<IChat>('Chat', chatSchema);