import TelegramBot, { CallbackQuery, InlineKeyboardMarkup, Message, PollAnswer } from "node-telegram-bot-api";
import Fs from 'fs/promises';
import Path from 'path';

import { Controller } from "../controller"
import { Status } from "../models/Game";
import { GenericUtils } from "./GenericUtils";


const MAX_POLL_DESCRIPTION_LENGTH = 255;
const MAX_POLL_OPTION_LENGTH = 100;

export namespace RoundUtils {

    // Check if game is ready and start the first round
    export const startGame = async (query: CallbackQuery) => {
        const chatId = query.message?.chat.id;
        if (!chatId) {
            throw "Invalid query";
        }
        if (!(await Controller.getPlayers(chatId)).includes(query.from.id)) {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.nonJoinedContinue') });
        }
        await global.bot.answerCallbackQuery(query.id);
        await global.bot.editMessageText(global.polyglot.t('prepare.gameStarted'), { chat_id: chatId, message_id: query.message?.message_id });
        await newRound(chatId);
    }

    // Start a new round
    export const newRound = async (chatId: number) => {
        if (!(await Controller.newRound(chatId))) {
            // Give prizes
            await finalScoreboard(chatId);
        }
        else {
            await Controller.setGameStatus(chatId, Status.QUESTION);

            // Notify on group who is the leader
            const leader = (await global.bot.getChatMember(chatId, await Controller.getCurrentPlayer(chatId))).user;
            const groupMessage = await global.bot.sendMessage(
                chatId,
                [
                    global.polyglot.t('round.group.round', {
                        round: (await Controller.getRound(chatId) ?? 0) + 1,
                        totalRounds: await Controller.numberOfPlayers(chatId),
                    }),
                    global.polyglot.t('round.group.word', {
                        leader: GenericUtils.getUserLabel(leader),
                    })
                ].join('\n'),
                { reply_markup: await getCheckBotChatReplyMarkup() }
            );

            // Contact privately the leader
            const language = await Controller.getLanguange(chatId);
            const resources: { text: string, url: string }[] = JSON.parse((await Fs.readFile(Path.resolve(__dirname, '../i18n', `resources.${language}.json`))).toString());
            const message = await global.bot.sendMessage(
                leader.id,
                global.polyglot.t('round.leader.word', { chat: (await global.bot.getChat(chatId)).title }),
                {
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: global.polyglot.t('round.maxLength', { maxLength: MAX_POLL_DESCRIPTION_LENGTH }),
                        inline_keyboard: [resources],
                    }
                }
            );
            await Controller.setMessageInteraction(message.message_id, leader.id, chatId, groupMessage.message_id);
        }
    }

    const finalScoreboard = async (chatId: number) => {
        const scores = await Controller.getScores(chatId);
        const scoreGroups: { [score: number]: number[]; } = {};
        for (const userId in scores) {
            if (!scoreGroups[scores[userId]]) {
                scoreGroups[scores[userId]] = [];
            }
            scoreGroups[scores[userId]].push(Number(userId));
        }

        const orderedScoreGroups = Object.entries(scoreGroups).sort(entry => Number(entry[0])).reverse();
        let message = global.polyglot.t('end');
        const medals = Array.from('🥇🥈🥉');
        for (const i in medals) {
            if (Number(i) >= Object.keys(orderedScoreGroups).length) {
                break;
            }
            const currentMedalNames = (await Promise.all(orderedScoreGroups[i][1].map((userId) => global.bot.getChatMember(chatId, userId))))
                .map(member => member.user.username);
            message += `\n${medals[i]} ${currentMedalNames.join(', ')}: ${orderedScoreGroups[i][0]} `;
        }
        await global.bot.sendMessage(chatId, message);
    }

    // Receive the round word from leader and notify players
    export const word = async (msg: Message) => {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Controller.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!res) {
            return;
        }
        const { chatId, groupMessageId } = res;

        // Get new word
        const word = msg.text;
        if (word.length > MAX_POLL_DESCRIPTION_LENGTH) {
            global.bot.sendMessage(msg.from.id, global.polyglot.t('tooLongWordError', { maxLength: MAX_POLL_DESCRIPTION_LENGTH }));
            return;
        }
        await Controller.setWord(chatId, word);
        await Controller.setGameStatus(chatId, Status.ANSWER);

        // Notify all users of new word
        const players = await Controller.getPlayers(chatId);

        for (const userId of players) {
            const text = (userId == msg.from.id)
                ? global.polyglot.t('round.leader.definition', { word })
                : global.polyglot.t('round.player.definition', { word, leader: msg.from.username });
            const message = await global.bot.sendMessage(
                userId,
                text,
                {
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: global.polyglot.t('round.maxLength', { maxLength: MAX_POLL_OPTION_LENGTH })
                    }
                }
            );
            await Controller.setMessageInteraction(message.message_id, userId, chatId, groupMessageId);
        }

        // Update round message on group chat
        await editGroupMessage(chatId, groupMessageId);

        await Controller.unsetMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
    }

    // Receive the definitions from players and send poll when done
    export const definition = async (msg: Message) => {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Controller.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!res) {
            return;
        }
        const { chatId, groupMessageId } = res;

        // Get new definition
        const definition = msg.text;
        if (definition.length > MAX_POLL_OPTION_LENGTH) {
            global.bot.sendMessage(msg.from.id, global.polyglot.t('tooLongDefinitionError', { maxLength: MAX_POLL_OPTION_LENGTH }));
            return;
        }
        await Controller.setDefinition(chatId, msg.from.id, definition);
        await Controller.setGameStatus(chatId, Status.ANSWER);

        // Reply in private
        let replyMarkup: InlineKeyboardMarkup | undefined;
        const chat = await global.bot.getChat(chatId);
        if (chat.invite_link) {
            replyMarkup = {
                inline_keyboard: [[
                    { text: global.polyglot.t('round.checkGroup'), url: chat.invite_link }
                ]]
            };
        }
        await global.bot.sendMessage(msg.chat.id, global.polyglot.t('round.end'), { reply_markup: replyMarkup });

        if ((await Controller.numberOfDefinitions(chatId)) === (await Controller.numberOfPlayers(chatId))) {
            await Controller.setGameStatus(chatId, Status.POLL);
            await sendPoll(chatId);

            const leader = (await global.bot.getChatMember(chatId, await Controller.getCurrentPlayer(chatId))).user;
            await global.bot.editMessageText(
                [
                    global.polyglot.t('round.group.round', {
                        round: (await Controller.getRound(chatId) ?? 0) + 1,
                        totalRounds: await Controller.numberOfPlayers(chatId),
                    }),
                    global.polyglot.t('round.group.end', {
                        leader: GenericUtils.getUserLabel(leader),
                    })
                ].join('\n'),
                { reply_markup: await getCheckBotChatReplyMarkup(), chat_id: chatId, message_id: groupMessageId }
            );
        }
        else {
            await editGroupMessage(chatId, groupMessageId);
        }

        await Controller.unsetMessageInteraction(msg.message_id, msg.from.id);
    }

    const editGroupMessage = async (chatId: number, groupMessageId: number) => {
        // Update round message on group chat
        const missingPlayersIds = await Controller.getMissingPlayers(chatId);
        const members = await Promise.all(missingPlayersIds.map(((userId) => global.bot.getChatMember(chatId, userId))));
        const missingPlayers = members.map((member) => GenericUtils.getUserLabel(member.user));
        await global.bot.editMessageText(
            [
                global.polyglot.t('round.group.round', {
                    round: (await Controller.getRound(chatId) ?? 0) + 1,
                    totalRounds: await Controller.numberOfPlayers(chatId),
                }),
                global.polyglot.t('round.group.definition', {
                    missingPlayers: missingPlayers.join(', ')
                })
            ].join('\n'),
            { reply_markup: await getCheckBotChatReplyMarkup(), chat_id: chatId, message_id: groupMessageId }
        );
    }

    // Send poll with definitions
    export const sendPoll = async (chatId: number) => {
        // shuffle and retrieve definitions
        const word = await Controller.getWord(chatId);
        const correctOptionId = await Controller.shuffleDefinitions(chatId);
        const definitions = await Controller.getDefinitions(chatId);

        if (process.env.NODE_ENV === 'development' && await Controller.numberOfPlayers(chatId) == 1) {
            definitions.push('Stub definition');
        }

        // send poll
        const message = await global.bot.sendPoll(
            chatId,
            global.polyglot.t('round.poll', { word }),
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

        await Controller.setPollInteraction(message.poll.id, chatId, message.message_id);
    }


    // Read poll answers and when completed post scores
    export const answer = async (pollAnswer: PollAnswer) => {
        const res = await Controller.getPollInteraction(pollAnswer.poll_id);
        if (!res) {
            return;
        }
        const { chatId, messageId } = res;

        // ignore votes of non playing members and leader
        const players = await Controller.getPlayers(chatId);
        if (!players.includes(pollAnswer.user.id) || (pollAnswer.user.id == (await Controller.getCurrentPlayer(chatId)) && process.env.NODE_ENV !== 'development')) {
            try {
                await global.bot.sendMessage(pollAnswer.user.id, global.polyglot.t('round.pollIntermission'));
            }
            catch (err) {
                // do nothing
            }
            return;
        }

        await Controller.addVote(chatId, pollAnswer.user.id, pollAnswer.option_ids[0]);

        if ((await Controller.numberOfVotes(chatId)) >= (await Controller.numberOfPlayers(chatId)) - 1) {
            // close poll
            await global.bot.stopPoll(chatId, messageId);

            // update scores
            const roundPoints = await Controller.getRoundPoints(chatId);
            const oldScore = await Controller.getScores(chatId);
            await Controller.updateScores(chatId, roundPoints);
            const newScore = Object.fromEntries(Object.entries(await Controller.getScores(chatId)).sort((entry) => entry[1]).reverse());

            // send result
            let message = global.polyglot.t('round.scoreboard');
            for (const userId in newScore) {
                const playerName = (await global.bot.getChatMember(chatId, Number(userId))).user.username;
                message += `\n${playerName} \t${oldScore[Number(userId)]} \t + ${roundPoints[Number(userId)]} \t = ${newScore[Number(userId)]} `;
            }
            await global.bot.sendMessage(chatId, message);

            // start new round
            await newRound(chatId);
            await Controller.unsetPollInteraction(pollAnswer.poll_id);
        }
    }


    const getCheckBotChatReplyMarkup = async () => {
        return {
            inline_keyboard: [[{ text: 'Check bot chat', url: `https://t.me/${(await global.bot.getMe()).username}` }]]
        } as InlineKeyboardMarkup;
    }

}