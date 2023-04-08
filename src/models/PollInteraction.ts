import { Schema, model } from "mongoose";

interface IPollInteraction {
    pollId: string,
    chatId: number,
    messageId: number,
}

const PollInteractionSchema = new Schema<IPollInteraction>({
    pollId: { type: String, required: true },
    chatId: { type: Number, required: true },
    messageId: { type: Number, required: true },
})
PollInteractionSchema.index({ pollId: 1, chatId: 1}, { unique: true });

export default model('PollInteraction', PollInteractionSchema);