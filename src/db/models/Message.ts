import { Schema, model, Document } from 'mongoose';

export interface IMessage extends Document {
  topicId: Schema.Types.ObjectId;
  chatId: number;
  telegramTopicId: number;
  messageId: number;
  userId: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  media?: {
    type: 'image' | 'audio' | 'document' | 'video' | 'voice' | 'photo';
    fileId: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    url?: string;
    transcription?: string; // For audio/voice messages
    description?: string; // For images analyzed by vision
  };
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  toolCallId?: string; // For tool response messages
  metadata?: {
    model?: string;
    provider?: string;
    tokensUsed?: number;
    processingTime?: number;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
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
  messageId: {
    type: Number,
    required: true,
  },
  userId: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant', 'tool', 'system'],
  },
  content: {
    type: String,
    required: true,
  },
  media: {
    type: {
      type: String,
      enum: ['image', 'audio', 'document', 'video', 'voice', 'photo'],
    },
    fileId: String,
    fileName: String,
    mimeType: String,
    fileSize: Number,
    url: String,
    transcription: String,
    description: String,
  },
  toolCalls: [{
    id: String,
    type: {
      type: String,
      enum: ['function'],
    },
    function: {
      name: String,
      arguments: String,
    },
  }],
  toolCallId: {
    type: String,
  },
  metadata: {
    model: String,
    provider: String,
    tokensUsed: Number,
    processingTime: Number,
    error: String,
  },
}, {
  timestamps: true,
});

messageSchema.index({ topicId: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, telegramTopicId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ role: 1 });

export const Message = model<IMessage>('Message', messageSchema);