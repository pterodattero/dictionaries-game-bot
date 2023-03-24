import TelegramBot, { CallbackQuery, InlineKeyboardMarkup, Message, PollAnswer } from "node-telegram-bot-api"
import { Controller } from "../controller"
import { Status } from "../models/Game";


const MAX_POLL_DESCRIPTION_LENGTH = 255;
const MAX_POLL_OPTION_LENGTH = 100;

export class RoundUtils {

    // Check if game is ready and start the first round
    public static async startGame(query: CallbackQuery) {
        const chatId = query.message?.chat.id;
        if (!chatId) {
            throw "Invalid query";
        }
        await global.bot.answerCallbackQuery(query.id);
        await global.bot.editMessageText('Game started!', { chat_id: chatId, message_id: query.message?.message_id });
        await Controller.setGameStatus(chatId, Status.QUESTION);
        await RoundUtils.newRound(chatId);
    }

    // Start a new round
    public static async newRound(chatId: number) {
        if (!(await Controller.newRound(chatId))) {
            // Give prizes
            const scores = await Controller.getScores(chatId);
            const scoreGroups: { [score: number]: number[] } = {};
            for (const userId in scores) {
                if (!scoreGroups[scores[userId]]) {
                    scoreGroups[scores[userId]] = [];
                }
                scoreGroups[scores[userId]].push(Number(userId));
            }

            const orderedScoreGroups = Object.fromEntries(Object.entries(scoreGroups).sort(entry => Number(entry[0])));
            let message = 'Game finished!';
            const medals = Array.from('🥇🥈🥉');
            for (const i in medals) {
                if (Number(i) >= Object.keys(orderedScoreGroups).length) {
                    break;
                }
                const currentMedalNames = (await Promise.all(orderedScoreGroups[i].map((userId) => global.bot.getChatMember(chatId, userId))))
                    .map(member => member.user.username);
                message += `\n${medals[i]} ${currentMedalNames.join(', ')}: ${Object.keys(orderedScoreGroups)[i]}`;
            }
            await global.bot.sendMessage(chatId, message);
        }
        else {

            // Notify on group who is the leader
            const leader = (await global.bot.getChatMember(chatId, await Controller.getCurrentPlayer(chatId))).user;
            const replyMarkup: InlineKeyboardMarkup = {
                inline_keyboard: [[{ text: 'Check bot chat', url: `https://t.me/${(await global.bot.getMe()).username}` }]]
            };
            await global.bot.sendMessage(
                chatId,
                `Round ${await Controller.getRound(chatId) ?? 0 + 1}/${await Controller.numberOfPlayers(chatId)}\n${leader.username} has to pick a word!`,
                { reply_markup: replyMarkup }
            );

            // Contact privately the leader
            const message = await global.bot.sendMessage(
                leader.id,
                `It is your turn to pick a word for the game in chat ${(await global.bot.getChat(chatId)).title}. Reply to this message with your answer.`,
                { reply_markup: { force_reply: true, input_field_placeholder: `max ${ MAX_POLL_DESCRIPTION_LENGTH } characters` } }
            );
            await Controller.setMessageInteraction(message.message_id, leader.id, chatId);
        }
    }

    // Receive the round word from leader and notify players
    public static async word(msg: Message) {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const chatId = await Controller.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!chatId) {
            global.bot.sendMessage(msg.from.id, "Sorry, this message is not active anymore.");
            return;
        }

        // Get new word
        const word = msg.text;
        if (word.length > MAX_POLL_DESCRIPTION_LENGTH) {
            global.bot.sendMessage(msg.from.id, `A word can be at most ${MAX_POLL_DESCRIPTION_LENGTH} long.`);
            return;
        }
        await Controller.setWord(chatId, word);
        await Controller.setGameStatus(chatId, Status.ANSWER);

        // Notify all users of new word
        const players = await Controller.getPlayers(chatId);

        for (const userId of players) {
            const text = (userId == msg.from.id)
                ? `Reply to this message with the correct definition of "${word}"`
                : `{update.effectiveUser.name} chose "${word}". Reply to this message with your fake definition`;
            const message = await global.bot.sendMessage(userId, text, { reply_markup: { force_reply: true, input_field_placeholder: `max ${ MAX_POLL_OPTION_LENGTH } characters` } });
            await Controller.setMessageInteraction(message.message_id, userId, chatId);
        }
        await Controller.unsetMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
    }

    // Receive the definitions from players and send poll when done
    public static async definition(msg: Message) {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const chatId = await Controller.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!chatId) {
            global.bot.sendMessage(msg.from.id, "Sorry, this message is not active anymore.");
            return;
        }

        // Get new definition
        const definition = msg.text;
        if (definition.length > MAX_POLL_OPTION_LENGTH) {
            global.bot.sendMessage(msg.from.id, `A definition can be at most ${MAX_POLL_OPTION_LENGTH} long.`);
            return;
        }
        await Controller.setDefinition(chatId, msg.from.id, definition);
        await Controller.setGameStatus(chatId, Status.ANSWER);

        // Reply
        let replyMarkup: InlineKeyboardMarkup | undefined;
        const chat = await global.bot.getChat(chatId);
        if (chat.invite_link) {
            replyMarkup = {
                inline_keyboard: [[
                    { text: 'Check group chat', url: chat.invite_link }
                ]]
            };
        }
        await global.bot.sendMessage(msg.chat.id, 'Got it!', { reply_markup: replyMarkup });

        if ((await Controller.numberOfDefinitions(chatId)) === (await Controller.numberOfPlayers(chatId))) {
            await Controller.setGameStatus(chatId, Status.POLL);
            await RoundUtils.sendPoll(chatId);
        }

        await Controller.unsetMessageInteraction(msg.message_id, msg.from.id);
    }

    // Send poll with definitions
    public static async sendPoll(chatId: number) {
        // shuffle and retrieve definitions
        const word = await Controller.getWord(chatId);
        const correctOptionId = await Controller.shuffleDefinitions(chatId);
        const definitions = await Controller.getDefinitions(chatId);

        if (process.env.NODE_ENV === 'development') {
            definitions.push('Stub definition');
        }

        // send poll
        const message = await global.bot.sendPoll(
            chatId,
            `Which is the correct definition of "${word}"?`,
            definitions,
            {
                correct_option_id: correctOptionId,
                is_anonymous: false,
                type: "quiz",
            }
        );
        if (!message.poll?.id) {
            throw "Error during poll creation";
        }

        await Controller.setPollInteraction(message.poll.id, chatId);
    }


    // Read poll answers and when completed post scores
    public static async answer(pollAnswer: PollAnswer) {
        const chatId = await Controller.getPollInteraction(pollAnswer.poll_id);
        if (!chatId) {
            return;
        }

        // ignore votes of non playing members and leader
        const players = await Controller.getPlayers(chatId);
        if (!players.includes(pollAnswer.user.id) || (pollAnswer.user.id == (await Controller.getCurrentPlayer(chatId)) && process.env.NODE_ENV !== 'development')) {
            try {
                await global.bot.sendMessage(pollAnswer.user.id, "You're not playing in this game, so your vote won't be considered.");
            }
            catch (err) {
                // do nothing
            }
            return;
        }

        await Controller.addVote(chatId, pollAnswer.user.id, pollAnswer.option_ids[0]);

        if ((await Controller.numberOfVotes(chatId)) >= (await Controller.numberOfPlayers(chatId)) - 1) {
            // update scores
            const roundPoints = await Controller.getRoundPoints(chatId);
            const oldScore = await Controller.getScores(chatId);
            await Controller.updateScores(chatId, roundPoints);
            const newScore = Object.fromEntries(Object.entries(await Controller.getScores(chatId)).sort((entry) => entry[1]).reverse());

            // send result
            let message = 'Scoreboard:'
            for (const userId in newScore) {
                const playerName = (await global.bot.getChatMember(chatId, Number(userId))).user.username;
                message += `\n${ playerName }\t${ oldScore[Number(userId)] }\t+ ${ roundPoints[Number(userId)] }\t = ${ newScore[Number(userId)] }`;
            }
            await global.bot.sendMessage(chatId, message);

            // start new round
            await RoundUtils.newRound(chatId);
            await Controller.unsetPollInteraction(pollAnswer.poll_id);
        }
    }

}