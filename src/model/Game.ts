import { Schema, model, InferSchemaType, Types } from "mongoose";

export enum Status {
    STOPPED = 'stopped',
    JOIN = 'join',
    QUESTION = 'question',
    ANSWER = 'answer',
    POLL = 'poll',
}

export interface IPlayer {
    userId: number,
    score: number,
    definition?: string,
    vote?: number,
}


export interface IGame {
    chatId: string,
    players: Types.Array<IPlayer>,
    status: Status,
    round?: number,
    lap?: number,
    word?: string,
    indexes: number[], // index map: pollPosition -> playerIndex
    startMessageId?: number,
    pollMessageId?: number,
    lapEndMessageId?: number,
}

const PlayerSchema = new Schema<IPlayer>({
    userId: { type: Number, required: true },
    score: Number,
    definition: String,
    vote: Number,
})

const GameSchema = new Schema<IGame>({
    chatId: { type: String, required: true, unique: true },
    players: [PlayerSchema],
    status: { type: String, default: Status.STOPPED },
    round: Number,
    lap: Number,
    word: String,
    indexes: [Number],
    startMessageId: Number,
    pollMessageId: Number,
    lapEndMessageId: Number,
})

export default model('Game', GameSchema);