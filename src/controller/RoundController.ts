import { CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, PollAnswer } from "node-telegram-bot-api";

import { Model } from "../model/Model"
import { Status } from "../model/Game";
import { TextUtils } from "../TextUtils";
import Constants from "../constants";

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
        if (!(await Model.initRound(chatId))) {
            return continueOrTerminate(chatId);
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
                        leader: TextUtils.getUserLabel(leader),
                    })
                ].join('\n'),
                { reply_markup: await TextUtils.getCheckBotChatReplyMarkup(), parse_mode: 'HTML' }
            );

            // Contact privately the leader
            const chatTitle = (await global.bot.getChat(chatId)).title ?? '';
            const keyboard = await TextUtils.getResourcesKeyboard(chatId);
            const message = await global.bot.sendMessage(
                leader.id,
                global.polyglot.t('round.leader.word', { chat: TextUtils.escapeHtml(chatTitle) }),
                {
                    reply_markup: {
                        inline_keyboard: keyboard,
                    }
                }
            );
            await Model.setMessageInteraction(leader.id, message.message_id, chatId, groupMessage.message_id);
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
        for (const i in orderedScoreGroups) {
            const currentMedalNames = (await Promise.all(orderedScoreGroups[i][1].map((userId) => global.bot.getChatMember(chatId, userId))))
                .map(member => TextUtils.getUserLabel(member.user));
            message += `\n${medals[i] ?? ''} ${currentMedalNames.join(', ')}: ${orderedScoreGroups[i][0]} `;
        }
        await global.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    // ask the users wheter to do another lap or not
    const continueOrTerminate = async (chatId: number) => {
        const keyboard: InlineKeyboardButton[][] = [[
            { text: global.polyglot.t('round.lapEnd.continue'), callback_data: 'lapEnd:continue' },
            { text: global.polyglot.t('round.lapEnd.end'), callback_data: 'lapEnd:end' },
        ]]
        const message = await global.bot.sendMessage(
            chatId,
            global.polyglot.t('round.lapEnd.message'),
            { reply_markup: { inline_keyboard: keyboard } }
        );
        await Model.setLapEndMessageId(chatId, message.message_id);
    }

    // Give prizes and reset message interactions
    export const endGame = async (chatId: number) => {
        return Promise.all([
            finalScoreboard(chatId),
            Model.cleanMessageInteractions(chatId),
            Model.setGameStatus(chatId, Status.STOPPED),
        ])
    }

    // Receive the round word from leader and notify players
    export const word = async (msg: Message) => {
        if (!msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Model.getMessageInteraction(msg.from.id, msg.reply_to_message?.message_id);
        await Model.unsetMessageInteraction(msg.from.id, msg.reply_to_message?.message_id);

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
                ? global.polyglot.t('round.leader.definition', { word: TextUtils.escapeHtml(word) })
                : global.polyglot.t('round.player.definition', { word: TextUtils.escapeHtml(word), leader: TextUtils.getUserLabel(msg.from) });
            const message = await global.bot.sendMessage(
                userId,
                text,
                { parse_mode: 'HTML' }
            );
            await Model.setMessageInteraction(userId, message.message_id, chatId, groupMessageId);
        }

        // Update round message on group chat
        await editGroupMessage(chatId, groupMessageId);
    }

    // Receive the definitions from players and send poll when done
    export const definition = async (msg: Message) => {
        if (!msg.from || !msg.text) {
            throw "Invalid message";
        }
        const res = await Model.getMessageInteraction(msg.from.id, msg.reply_to_message?.message_id);
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
                        leader: TextUtils.getUserLabel(leader),
                    })
                ].join('\n'),
                { chat_id: chatId, message_id: groupMessageId, parse_mode: 'HTML' }
            );
        }
        else {
            await editGroupMessage(chatId, groupMessageId);
        }

        await Model.unsetMessageInteraction(msg.from.id, msg.reply_to_message?.message_id);
    }

    const editGroupMessage = async (chatId: number, groupMessageId: number) => {
        // Update round message on group chat
        const missingPlayers = await Model.getMissingPlayers(chatId);
        await global.bot.editMessageText(
            [
                global.polyglot.t('round.group.round', {
                    round: (await Model.getRound(chatId) ?? 0) + 1,
                    totalRounds: await Model.numberOfPlayers(chatId),
                }),
                global.polyglot.t('round.group.definition', {
                    missingPlayers: await TextUtils.getPlayersString(chatId, missingPlayers),
                    smart_count: missingPlayers.length,
                })
            ].join('\n'),
            { reply_markup: await TextUtils.getCheckBotChatReplyMarkup(), chat_id: chatId, message_id: groupMessageId, parse_mode: 'HTML' }
        );
    }

    // Send poll with definitions
    export const sendPoll = async (chatId: number) => {
        await Model.shuffleDefinitions(chatId);
        const [ text, keyboard ] = await Promise.all([
            await TextUtils.getPollMessage(chatId),
            await TextUtils.getPollKeyboard(chatId),
        ])

        const message = await global.bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'HTML' });
        await Model.setPollMessageId(chatId, message.message_id);
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
        if (!players.includes(query.from.id) && process.env.VERCEL_ENV !== 'development') {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.intermission'), show_alert: true })
        }
        if (query.from.id === leader && process.env.VERCEL_ENV !== 'development') {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.leaderIntermission'), show_alert: true })
        }
        const vote = Number(query.data.split(':')[1]);
        if (query.from.id === vote && process.env.VERCEL_ENV !== 'development') {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.autoVote'), show_alert: true })
        }
        const updated = await Model.addVote(chatId, query.from.id, vote);
        if (updated) {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.voteUpdated') })
        } else {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.voteRegistered') })
        }

        if ((await Model.numberOfVotes(chatId)) >= (await Model.numberOfPlayers(chatId)) - 1) {
            // close poll
            const [ text, keyboard, round, lap ] = await Promise.all([
                TextUtils.getPollMessage(chatId, true),
                TextUtils.getPollKeyboard(chatId),
                Model.getRound(chatId),
                Model.getLap(chatId),
            ])
            await global.bot.editMessageText(
                text,
                { reply_markup: { inline_keyboard: keyboard }, chat_id: chatId, message_id: query.message?.message_id, parse_mode: 'HTML' },
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
                const playerName = TextUtils.getUserLabel(member.user);
                message += `\n${playerName} `
                if (round || lap) {
                    message += `${oldScore[Number(userId)]} + ${roundPoints[Number(userId)]} = `
                }
                message += newScore[Number(userId)];
            }
            await global.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });

            // start new round
            await Model.archiveCurrentRound(chatId);
            return new Promise((resolve, reject) => {
                setTimeout(
                    () => newRound(chatId).then(resolve).catch(reject),
                    Constants.NEXT_ROUND_WAIT
                );
            })
        } else if (!updated) {
            // only update message
            const [ text, keyboard ] = await Promise.all([
                await TextUtils.getPollMessage(chatId),
                await TextUtils.getPollKeyboard(chatId),
            ])
    
            await global.bot.editMessageText(text, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: keyboard }, parse_mode: 'HTML' });
        }
    }


    export const seeVotes = async (query: CallbackQuery) => {
        try {
            if (!query.message || !query.data) {
                return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.invalidButton') });
            };
            const chatId = query.message.chat.id;
            const votes = await Model.getRoundVotes(chatId, query.message.message_id);
            const userId = Number(query.data.split(':')[1]);
            const userVotes = votes.find((el) => el.userId === userId);
            const text = userVotes
                ? global.polyglot.t('round.poll.votedBy', { players: await TextUtils.getPlayersString(chatId, userVotes.votes, false) })
                : global.polyglot.t('round.poll.noVotes');
            return global.bot.answerCallbackQuery(query.id, { text, show_alert: true });
        }
        catch {
            return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('round.poll.notFound') });
        }
    }

}