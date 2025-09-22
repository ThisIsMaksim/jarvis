import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isBot: boolean;
  isPremium?: boolean;
  addedToAttachmentMenu?: boolean;
  allowsWriteToPm?: boolean;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  preferences: {
    defaultProvider?: 'openai' | 'gemini';
    defaultModel?: string;
    timezone?: string;
    language?: string;
  };
}

const userSchema = new Schema<IUser>({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
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
  languageCode: {
    type: String,
  },
  isBot: {
    type: Boolean,
    required: true,
    default: false,
  },
  isPremium: {
    type: Boolean,
  },
  addedToAttachmentMenu: {
    type: Boolean,
  },
  allowsWriteToPm: {
    type: Boolean,
  },
  photoUrl: {
    type: String,
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
  },
  preferences: {
    defaultProvider: {
      type: String,
      enum: ['openai', 'gemini'],
    },
    defaultModel: {
      type: String,
    },
    timezone: {
      type: String,
      default: 'Europe/Berlin',
    },
    language: {
      type: String,
      default: 'ru',
    },
  },
}, {
  timestamps: true,
});

userSchema.index({ telegramId: 1 });
userSchema.index({ username: 1 }, { sparse: true });

export const User = model<IUser>('User', userSchema);