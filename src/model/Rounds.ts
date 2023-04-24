import { Schema, model } from "mongoose";

interface IRound {
    chatId: number,
    startMessageId: number,
    pollMessageId: number,
    votes: {
        userId: number,
        votes: number[]
    }[]
}

const RoundSchema = new Schema<IRound>({
    chatId: { type: Number, required: true },
    startMessageId: { type: Number, required: true },
    pollMessageId: { type: Number, required: true },
    votes: [{
        userId: Number,
        votes: [Number]
    }],
})
RoundSchema.index({ chatId: 1, startMessageId: 1, pollMessageId: 1 }, { unique: true });

export default model('Round', RoundSchema);