import mongoose from "mongoose";

import Constants from "../constants";
import Game, { IGame, Status } from "./Game";
import MessageInteraction from "./MessageInteraction";
import Rounds from "./Rounds";
import Settings from "./Settings";


export namespace Model {

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
    export async function setMessageInteraction(userId: number, messageId: number, chatId: number, groupMessageId: number): Promise<void> {
        await MessageInteraction.create({ userId, messageId, chatId, groupMessageId });
    }

    export async function unsetMessageInteraction(userId: number, messageId?: number): Promise<void> {
        if (await getMessageInteraction(userId, messageId))
            await MessageInteraction.deleteOne(messageId ? { userId, messageId } : { userId });
    }

    export async function cleanMessageInteractions(chatId: number) {
        await MessageInteraction.deleteMany({ chatId });
    }

    export async function getMessageInteraction(userId: number, messageId?: number): Promise<{ chatId: number, groupMessageId: number } | undefined> {
        if (!messageId && await MessageInteraction.countDocuments({ userId }) > 1) {
            return;
        }
        const interaction = await MessageInteraction.findOne(messageId ? { userId, messageId } : { userId });
        if (!interaction) {
            throw "Interaction not found";
        }

        return {
            chatId: interaction.chatId,
            groupMessageId: interaction.groupMessageId,
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

    export async function getGameStatus(chatId: number) {
        try {
            const game = await getGame(chatId);
            return game.status;
        }
        catch {
            return Status.STOPPED;
        }
    }

    export async function setGameStatus(chatId: number, status: Status) {
        const game = await getGame(chatId);
        game.status = status;
        await game.save();
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

    export async function initRound(chatId: number): Promise<boolean> {
        const game = await getGame(chatId);
        game.pollMessageId = undefined;

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

    export async function getDefinitions(chatId: number): Promise<{ userId: number, definition: string }[]> {
        const game = await getGame(chatId);
        if (!game.indexes)
            throw Error('Indexes not initialized');
        return game.indexes.map((index) => ({ userId: game.players[index].userId, definition: game.players[index].definition ?? '' }));
    }

    export async function numberOfDefinitions(chatId: number): Promise<number> {
        const game = await getGame(chatId);
        return game.players.filter((player) => player.definition).length;
    }

    export async function shuffleDefinitions(chatId: number) {
        const game = await getGame(chatId);
        const indexes = [...Array(await numberOfPlayers(chatId)).keys()];
        for (let i = indexes.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
        }

        game.indexes = indexes;
        await game.save();
    }

    export async function getMissingPlayers(chatId: number): Promise<number[]> {
        const game = await getGame(chatId);
        if (game.round === undefined)
            throw Error('No round in act');

        const leaderId = await getCurrentPlayer(chatId);
        return game.players
            .filter((playerData) => (game.status === Status.ANSWER) ? !playerData.definition : (!playerData.vote && playerData.userId !== leaderId))
            .map((playerData) => playerData.userId);
    }

    // Vote methods
    export async function addVote(chatId: number, userId: number, vote: number): Promise<void> {
        const game = await getGame(chatId);
        const playerIndex = game.players.findIndex((player) => player.userId === userId);
        game.players[playerIndex].vote = vote;
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
                roundPoints[player.userId] += everyoneGuessed ? Constants.EVERYONE_GUESSED_LEADER_POINTS : Constants.NOT_EVERYONE_GUESSED_LEADER_POINTS;
            } else if (player.vote === leaderId) {
                roundPoints[player.userId] += everyoneGuessed ? Constants.EVERYONE_GUESSED_POINTS : Constants.GUESS_POINTS;
            }
        }

        // Vote points
        for (const player of game.players) {
            if (player.vote && player.vote !== player.userId && player.vote !== leaderId) {
                roundPoints[player.vote] += Constants.VOTE_POINTS;
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


    // message ID methods
    export async function setStartMessageId(chatId: number, messageId: number) {
        const game = await getGame(chatId);
        game.startMessageId = messageId;
        await game.save();
    }    

    export async function getStartMessageId(chatId: number) {
        const game = await getGame(chatId);
        return game.startMessageId;
    }    

    export async function setPollMessageId(chatId: number, messageId: number) {
        const game = await getGame(chatId);
        game.pollMessageId = messageId;
        await game.save();
    }    

    export async function getPollMessageId(chatId: number) {
        const game = await getGame(chatId);
        return game.pollMessageId;
    }    


    // archive methods
    export async function archiveCurrentRound(chatId: number) {
        const game = await getGame(chatId);
        const userVotes: { [userId: number]: number[]} = {};
        for (const playerData of game.players) {
            if (playerData.vote) {
                userVotes[playerData.vote] ??= [];
                userVotes[playerData.vote].push(playerData.userId);
            }
        }
        await Rounds.create({
            chatId,
            pollMessageId: game.pollMessageId,
            votes: Object.entries(userVotes).map(([ userId, votes ]) => ({ userId, votes })),
        });
    }

    export async function getRoundVotes(chatId: number, pollMessageId: number) {
        const round = await Rounds.findOne({ chatId, pollMessageId });
        if (!round) {
            throw 'Round not found';
        }
        return round.votes;
    }
}