import TelegramBot, { CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, PollAnswer } from "node-telegram-bot-api";
import Fs from 'fs/promises';
import Path from 'path';

import { Model } from "../model/Model"
import { Status } from "../model/Game";
import { Utils } from "./Utils";


export namespace RoundController {

    // Check if game is ready and start the first round
    export const startGame = async (query: CallbackQuery) => {
        const chatId = query.message?.chat.id;
        if (!chatId) {
            throw "Invalid query";
        }
        if (!(await Model.getPlayers(chatId)).includes(query.from.id)) {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.nonJoinedContinue'), show_alert: true });
        }
        await global.bot.answerCallbackQuery(query.id);
        await global.bot.editMessageText(global.polyglot.t('prepare.gameStarted'), { chat_id: chatId, message_id: query.message?.message_id });
        await newRound(chatId);
    }

    // Start a new round
    export const newRound = async (chatId: number) => {
        if (!(await Model.newRound(chatId))) {
            // Give prizes
            await finalScoreboard(chatId);
        }
        else {
            await Model.setGameStatus(chatId, Status.QUESTION);

            // Notify on group who is the leader
            const leader = (await global.bot.getChatMember(chatId, await Model.getCurrentPlayer(chatId))).user;
            const groupMessage = await global.bot.sendMessage(
                chatId,
                [
                    global.polyglot.t('round.group.round', {
                        round: (await Model.getRound(chatId) ?? 0) + 1,
                        totalRounds: await Model.numberOfPlayers(chatId),
                    }),
                    global.polyglot.t('round.group.word', {
                        leader: Utils.getUserLabel(leader),
                    })
                ].join('\n'),
                { reply_markup: await getCheckBotChatReplyMarkup() }
            );

            // Contact privately the leader
            const language = await Model.getLanguange(chatId);
            const resources: { text: string, url: string }[] = JSON.parse((await Fs.readFile(Path.resolve(__dirname, '../i18n', `resources.${language}.json`))).toString());
            const message = await global.bot.sendMessage(
                leader.id,
                global.polyglot.t('round.leader.word', { chat: (await global.bot.getChat(chatId)).title }),
                {
                    reply_markup: {
                        force_reply: true,
                        inline_keyboard: [resources],
                    }
                }
            );
            await Model.setMessageInteraction(message.message_id, leader.id, chatId, groupMessage.message_id);
        }
    }

    const finalScoreboard = async (chatId: number) => {
        const scores = await Model.getScores(chatId);
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
                .map(member => Utils.getUserLabel(member.user));
            message += `\n${medals[i]} ${currentMedalNames.join(', ')}: ${orderedScoreGroups[i][0]} `;
        }
        await global.bot.sendMessage(chatId, message);
    }

    // Receive the round word from leader and notify players
    export const word = async (msg: Message) => {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Model.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!res) {
            return;
        }
        const { chatId, groupMessageId } = res;

        // Get new word
        const word = msg.text;
        await Model.setWord(chatId, word);
        await Model.setGameStatus(chatId, Status.ANSWER);

        // Notify all users of new word
        const players = await Model.getPlayers(chatId);

        for (const userId of players) {
            const text = (userId == msg.from.id)
                ? global.polyglot.t('round.leader.definition', { word })
                : global.polyglot.t('round.player.definition', { word, leader: Utils.getUserLabel(msg.from) });
            const message = await global.bot.sendMessage(
                userId,
                text,
                {
                    reply_markup: {
                        force_reply: true,
                    }
                }
            );
            await Model.setMessageInteraction(message.message_id, userId, chatId, groupMessageId);
        }

        // Update round message on group chat
        await editGroupMessage(chatId, groupMessageId);

        await Model.unsetMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
    }

    // Receive the definitions from players and send poll when done
    export const definition = async (msg: Message) => {
        if (!msg.reply_to_message || !msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Model.getMessageInteraction(msg.reply_to_message.message_id, msg.from.id);
        if (!res) {
            return;
        }
        const { chatId, groupMessageId } = res;

        // Get new definition
        const definition = msg.text;
        await Model.setDefinition(chatId, msg.from.id, definition);
        await Model.setGameStatus(chatId, Status.ANSWER);

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

        if ((await Model.numberOfDefinitions(chatId)) === (await Model.numberOfPlayers(chatId))) {
            await Model.setGameStatus(chatId, Status.POLL);
            await sendPoll(chatId);

            const leader = (await global.bot.getChatMember(chatId, await Model.getCurrentPlayer(chatId))).user;
            await global.bot.editMessageText(
                [
                    global.polyglot.t('round.group.round', {
                        round: (await Model.getRound(chatId) ?? 0) + 1,
                        totalRounds: await Model.numberOfPlayers(chatId),
                    }),
                    global.polyglot.t('round.group.end', {
                        leader: Utils.getUserLabel(leader),
                    })
                ].join('\n'),
                { chat_id: chatId, message_id: groupMessageId }
            );
        }
        else {
            await editGroupMessage(chatId, groupMessageId);
        }

        await Model.unsetMessageInteraction(msg.message_id, msg.from.id);
    }

    const editGroupMessage = async (chatId: number, groupMessageId: number) => {
        // Update round message on group chat
        const missingPlayersString = 
        await global.bot.editMessageText(
            [
                global.polyglot.t('round.group.round', {
                    round: (await Model.getRound(chatId) ?? 0) + 1,
                    totalRounds: await Model.numberOfPlayers(chatId),
                }),
                global.polyglot.t('round.group.definition', {
                    missingPlayers: await getMissingPlayersString(chatId)
                })
            ].join('\n'),
            { reply_markup: await getCheckBotChatReplyMarkup(), chat_id: chatId, message_id: groupMessageId }
        );
    }

    // Send poll with definitions
    export const sendPoll = async (chatId: number) => {
        await Model.shuffleDefinitions(chatId);
        const definitions = await Model.getDefinitions(chatId);

        const MAX_BUTTONS_IN_ROW = 5;

        const keyboard: InlineKeyboardButton[][] = [];
        for (let i = 0; i < definitions.length; i++) {
            if (i % MAX_BUTTONS_IN_ROW === 0) {
                keyboard.push([]);
            }
            keyboard[keyboard.length - 1].push({ text: String(i + 1), callback_data: `poll:${definitions[i].userId}` })
        }

        global.bot.sendMessage(
            chatId,
            await getPollMessage(chatId),
            { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' }
        )
    }


    // Read poll answers and when completed post scores
    export const answer = async (query: CallbackQuery) => {
        const chatId = query.message?.chat.id;
        if (!chatId || !query.data) {
            throw "Invalid query";
        }
        const [ players, leader ] = await Promise.all([
            Model.getPlayers(chatId),
            Model.getCurrentPlayer(chatId),
        ]);
        
        // ignore votes of non playing members and leader
        if (!players.includes(query.from.id)) {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.pollIntermission'), show_alert: true })
        }
        if (query.from.id === leader) {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.pollLeaderIntermission'), show_alert: true })
        }
        const vote = Number(query.data.split(':')[1]);
        if (query.from.id === vote) {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.autoVote'), show_alert: true })
        }
        await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.voteRegistered') })
        await Model.addVote(chatId, query.from.id, vote);

        if ((await Model.numberOfVotes(chatId)) >= (await Model.numberOfPlayers(chatId)) - 1) {
            // close poll
            await global.bot.editMessageText(
                await getPollMessage(chatId, true),
                { chat_id: chatId, message_id: query.message?.message_id, parse_mode: 'Markdown' },
            );            

            // update scores
            const roundPoints = await Model.getRoundPoints(chatId);
            const oldScore = await Model.getScores(chatId);
            await Model.updateScores(chatId, roundPoints);
            const newScore = Object.fromEntries(Object.entries(await Model.getScores(chatId)).sort((entry) => entry[1]).reverse());

            // send result
            let message = global.polyglot.t('round.scoreboard');
            for (const userId in newScore) {
                const member = await global.bot.getChatMember(chatId, Number(userId));
                const playerName = Utils.getUserLabel(member.user);
                message += `\n${playerName} ${oldScore[Number(userId)]} + ${roundPoints[Number(userId)]} = ${newScore[Number(userId)]}`;
            }
            await global.bot.sendMessage(chatId, message);

            // start new round
            await newRound(chatId);
        }
    }


    const getCheckBotChatReplyMarkup = async () => {
        return {
            inline_keyboard: [[{ text: global.polyglot.t('round.group.checkBotChat'), url: `https://t.me/${(await global.bot.getMe()).username}` }]]
        } as InlineKeyboardMarkup;
    }

    const getPollMessage = async (chatId: number, solution: boolean = false) => {
        const [ definitions, round, word ] = await Promise.all([
            Model.getDefinitions(chatId),
            Model.getRound(chatId),
            Model.getWord(chatId),
        ]) 

        let text = global.polyglot.t('round.poll', { word });
        for (let i = 0; i < definitions.length; i++) {
            const isLeader = i === round;
            text += '\n';
            if (solution) {
                text += isLeader ? '✔️ ' : '❌ ';
            } else {
                text += `${i + 1}. `;
            }
            
            text += definitions[i].definition;
            if (solution) {
                text += ` - **${ Utils.getUserLabel((await global.bot.getChatMember(chatId, definitions[i].userId)).user) }**`;
            }
        }

        if (!solution) {
            text += `\n\n ${global.polyglot.t('round.group.voteMissing', {
                missingPlayers: await getMissingPlayersString(chatId)
            })}`;
        }

        return text;
    }

    const getMissingPlayersString = async (chatId: number) => {
        const missingPlayersIds = await Model.getMissingPlayers(chatId);
        const members = await Promise.all(missingPlayersIds.map(((userId) => global.bot.getChatMember(chatId, userId))));
        const missingPlayers = members.map((member) => Utils.getUserLabel(member.user));
        return missingPlayers.join(', ');
    }

}