import { Schema, model } from "mongoose";

interface IPollInteraction {
    pollId: string,
    chatId: number,
}

const PollInteractionSchema = new Schema<IPollInteraction>({
    pollId: { type: String, required: true },
    chatId: { type: Number, required: true },
})
PollInteractionSchema.index({ pollId: 1, chatId: 1}, { unique: true });

export default model('PollInteraction', PollInteractionSchema);