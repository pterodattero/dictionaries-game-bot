import mongoose from "mongoose";
import Game, { IGame, Status } from "./models/Game";
import MessageInteraction from "./models/MessageInteraction";
import PollInteraction from "./models/PollInteraction";
import Settings from "./models/Settings";



export namespace Controller {
    // constants
    export const MIN_PLAYERS = 4;
    export const MAX_PLAYERS = 10;

    export const VOTE_POINTS = 1;
    export const GUESS_POINTS = 3;
    export const EVERYONE_GUESSED_POINTS = 2;
    export const NOT_EVERYONE_GUESSED_LEADER_POINTS = 3;
    export const EVERYONE_GUESSED_LEADER_POINTS = 0;

    // general DB methods
    export async function connect() {
        if (!process.env.MONGODB_URI)
            throw "Invalid MONGODB_URI environment variable"
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME ?? process.env.NODE_ENV });
        console.log("Connected");
    }

    export async function getLanguange(chatId?: number) {
        if (!chatId) {
            return 'en';
        }
        const result = await Settings.findOne({ chatId });
        return result?.language ?? 'en';
    }

    export async function isChatInitialized(chatId: number) {
        return !!await Settings.findOne({ chatId });
    }

    export async function setLanguange(chatId: number, language: string) {
        await Settings.replaceOne({ chatId }, { chatId, language }, { upsert: true });
    }

    // Interaction methods
    export async function setMessageInteraction(messageId: number, userId: number, chatId: number, groupMessageId: number): Promise<void> {
        await MessageInteraction.create({ messageId, userId, chatId, groupMessageId });
    }

    export async function unsetMessageInteraction(messageId: number, userId: number): Promise<void> {
        if (await getMessageInteraction(messageId, userId))
            await MessageInteraction.deleteOne({ messageId, userId })
    }

    export async function getMessageInteraction(messageId: number, userId: number): Promise<{ chatId: number, groupMessageId: number } | undefined> {
        const interaction = await MessageInteraction.findOne({ messageId, userId });
        if (interaction)
            return {
                chatId: interaction.chatId,
                groupMessageId: interaction.groupMessageId,
            }
    }

    export async function setPollInteraction(pollId: string, chatId: number, messageId: number): Promise<void> {
        await PollInteraction.create({ pollId, chatId, messageId });
    }

    export async function unsetPollInteraction(pollId: string): Promise<void> {
        if (await getPollInteraction(pollId))
            PollInteraction.deleteOne({ pollId });
    }

    export async function getPollInteraction(pollId: string): Promise<{ chatId: number, messageId: number } | undefined> {
        const interaction = await PollInteraction.findOne({ pollId });
        if (interaction) {
            return {
                chatId: interaction.chatId,
                messageId: interaction.messageId,
            };
        }
    }

    // Game methods
    export async function initGame(chatId: number): Promise<void> {
        await Game.replaceOne({ chatId }, { chatId, status: Status.JOIN, players: [] }, { upsert: true });
    }

    export async function getGame(chatId: number) {
        const game = await Game.findOne({ chatId });
        if (!game) {
            throw Error(`Invalid chatId: ${chatId}`);
        }
        return game;
    }

    export async function getGameStatus(chatId: number): Promise<Status> {
        let game;
        try {
            game = await getGame(chatId);
        }
        catch (err) {
            return Status.STOPPED;
        }
        return game?.status;
    }

    export async function setGameStatus(chatId: number, status: Status): Promise<void> {
        await Game.findOneAndUpdate({ chatId }, { status });
    }

    // Player methods
    export async function addPlayer(chatId: number, userId: number): Promise<boolean> {
        const game = await getGame(chatId);
        if (game?.players.find((player) => player.userId === userId))
            return false;
        game.players.push({
            userId,
            score: 0,
        });
        await game.save();
        return true;
    }

    export async function removePlayer(chatId: number, userId: number): Promise<boolean> {
        const game = await getGame(chatId);
        if (!game)
            throw Error('Invalid game');
        const player = game.players.find((player) => player.userId === userId);
        if (player) {
            game.players.pull({ userId: userId });
            await game.save();
            return true;
        }
        return false;
    }

    export async function getCurrentPlayer(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        if (game.round === undefined) {
            throw Error('Game is not running');
        }
        return game.players[game.round].userId;
    }

    export async function getPlayers(chatId: number): Promise<number[]> {
        const game = await getGame(chatId);
        return game.players.map((player) => player.userId);
    }


    export async function numberOfPlayers(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        return game.players.length;
    }

    // Round methods
    export async function getRound(chatId: number): Promise<number | undefined> {
        const game = await getGame(chatId);
        return game.round;
    }

    export async function newRound(chatId: number): Promise<boolean> {
        const game = await getGame(chatId);

        for (const player of game.players) {
            player.definition = undefined;
            player.vote = undefined;
        }

        game.word = undefined;

        if (game.round === undefined)
            game.round = 0;
        else
            game.round += 1;

        if (game.round === await numberOfPlayers(chatId)) {
            game.round = undefined;
            game.status = Status.STOPPED;
            await game.save();
            return false;
        }

        await game.save();
        return true;
    }

    // Word and definition methods
    export async function setWord(chatId: number, word: string): Promise<void> {
        const game = await getGame(chatId);
        game.word = word;
        await game.save();
    }

    export async function getWord(chatId: number): Promise<string | undefined> {
        const game = await getGame(chatId);
        return game.word;
    }

    export async function setDefinition(chatId: number, userId: number, definition: string): Promise<void> {
        const game = await getGame(chatId);
        const playerIndex = game.players.findIndex((player) => player.userId === userId);
        game.players[playerIndex].definition = definition;
        await game.save();
    }

    export async function getDefinitions(chatId: number): Promise<string[]> {
        const game = await getGame(chatId);
        if (!game.indexes)
            throw Error('Indexes not initialized');
        return game.indexes.map((index) => game.players[index].definition ?? '');
    }

    export async function numberOfDefinitions(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        return game.players.filter((player) => player.definition).length;
    }

    export async function shuffleDefinitions(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        if (game.round === undefined)
            throw Error('No round in act');

        const indexes = [...Array(await numberOfPlayers(chatId)).keys()];
        for (let i = indexes.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
        }

        game.indexes = indexes;
        await game.save();
        return indexes.indexOf(game.round);
    }

    export async function getMissingPlayers(chatId: number): Promise<number[]> {
        const game = await getGame(chatId);
        if (game.round === undefined)
            throw Error('No round in act');

        return game.players
            .filter((playerData) => !playerData.definition)
            .map((playerData) => playerData.userId);
    }

    // Vote methods
    export async function addVote(chatId: number, userId: number, index: number): Promise<void> {
        const game = await getGame(chatId);
        if (!game.indexes)
            throw Error('Invalid game');

        const playerIndex = game.players.findIndex((player) => player.userId === userId);

        game.players[playerIndex].vote = game.players[game.indexes[index]].userId;
        await game.save();
    }

    export async function numberOfVotes(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        return game.players.filter((player) => player.vote).length;
    }

    // Score methods
    export async function getRoundPoints(chatId: number): Promise<{ [userId: number]: number }> {
        const game = await getGame(chatId);
        const roundPoints: { [userId: number]: number } = {};
        for (const player of game.players) {
            roundPoints[player.userId] = 0;
        }
        const leaderId = await getCurrentPlayer(chatId);

        // Infer case
        const everyoneGuessed = !game.players.find((player) => player.vote !== leaderId && player.userId !== leaderId);

        // Guess points
        for (const player of game.players) {
            if (player.userId === leaderId) {
                roundPoints[player.userId] += everyoneGuessed ? EVERYONE_GUESSED_LEADER_POINTS : NOT_EVERYONE_GUESSED_LEADER_POINTS;
            } else if (player.vote === leaderId) {
                roundPoints[player.userId] += everyoneGuessed ? EVERYONE_GUESSED_POINTS : GUESS_POINTS;
            }
        }

        // Vote points
        for (const player of game.players) {
            if (player.vote && player.vote !== player.userId && player.vote !== leaderId) {
                roundPoints[player.vote] += VOTE_POINTS;
            }
        }

        return roundPoints;
    }

    export async function getScores(chatId: number) {
        const game = await getGame(chatId);
        const scores: { [userId: number]: number } = {};
        game.players.forEach((player) => { scores[player.userId] = player.score ?? 0 });
        return scores;
    }


    export async function updateScores(chatId: number, roundPoints: { [userId: number]: number }): Promise<void> {
        const game = await getGame(chatId);
        for (const i in game.players) {
            game.players[i].score += roundPoints[game.players[i].userId];
        }
        await game.save();
    }
}