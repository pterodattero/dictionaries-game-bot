import { Schema, model } from "mongoose";

interface IMessageInteraction {
    messageId: number,
    userId: number,
    chatId: number,
    groupMessageId?: number,
}

const MessageInteractionSchema = new Schema<IMessageInteraction>({
    messageId: { type: Number, required: true },
    userId: { type: Number, required: true },
    chatId: { type: Number, required: true },
    groupMessageId: Number,
})
MessageInteractionSchema.index({ messageId: 1, userId: 1, chatId: 1 }, { unique: true });

export default model('MessageInteraction', MessageInteractionSchema);