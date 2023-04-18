import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";

import { Model } from "../model/Model"
import { Status } from "../model/Game"
import { RoundController } from "./RoundController";
import { Utils } from "./Utils";
import Constants from "../constants";

export namespace PreparationController {

    // Start a new game, asking players to join
    export const startPreparation = async (msg: Message) => {
        const chatId = msg.chat.id;
        // Notify if game has already started
        if (await Model.getGameStatus(chatId) !== Status.STOPPED)
            await global.bot.sendMessage(chatId, global.polyglot.t('prepare.refuse'));

        // Start joining stage
        else {
            await Model.initGame(chatId);
            const message = await global.bot.sendMessage(
                chatId,
                await getJoinMessage(msg),
                { reply_markup: await getJoinKeyboard(msg), parse_mode: 'Markdown' }
            )
            await Model.setStartMessageId(chatId, message.message_id);
        }

    }


    // Handle join keyboard button press
    export const join = async (query: CallbackQuery) => {
        if (!query.message?.chat.id) {
            throw 'Invalid query';
        }
        try {
            const message = await global.bot.sendMessage(query.from.id, global.polyglot.t('prepare.interactionTry'));
            await global.bot.deleteMessage(query.from.id, message.message_id);
        }
        catch (err) {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.interactionError'), show_alert: true });
            return;
        }

        if (await Model.addPlayer(query.message.chat.id, query.from.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(await getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, parse_mode: 'Markdown' });

            // When maximum nuber of players is reached start first round
            if ((await Model.numberOfPlayers(query.message.chat.id)) >= Constants.MAX_PLAYERS) {
                await RoundController.startGame(query);
            }
        }
        else {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.alreadyJoined') });
        }
    }


    // Handle withraw button press
    export const withdraw = async (query: CallbackQuery) => {
        if (!query.message?.chat.id || !query.message.from?.id) {
            throw 'Invalid query';
        }
        if (await Model.removePlayer(query.message.chat.id, query.from?.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(await getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, parse_mode: 'Markdown'});
        }
        else {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.notJoined') });
        }
    }


    // Auxiliary method to draw join keyboard
    const getJoinKeyboard = async (msg: Message) => {
        const numberOfPlayers = await Model.numberOfPlayers(msg.chat.id);
        const botInviteLink = `https://t.me/${(await global.bot.getMe()).username}`;
        const keyboard: TelegramBot.InlineKeyboardMarkup = {
            inline_keyboard: [
                [
                    { text: global.polyglot.t('prepare.keyboard.join', { availableSlots: Constants.MAX_PLAYERS - numberOfPlayers }), callback_data: 'prepare:join' },
                    { text: global.polyglot.t('prepare.keyboard.withdraw'), callback_data: 'prepare:withdraw' }
                ]
            ]
        };

        if ((numberOfPlayers >= Constants.MIN_PLAYERS) || (process.env.VERCEL_ENV === 'development')) {
            keyboard.inline_keyboard[0].push({ text: global.polyglot.t('prepare.keyboard.continue'), callback_data: 'prepare:continue' })
        }

        if (botInviteLink) {
            keyboard.inline_keyboard.push([{ text: global.polyglot.t('prepare.keyboard.register'), url: botInviteLink }])
        }

        return keyboard;
    }


    // Auxiliary method to get preparation message
    const getJoinMessage = async (msg: Message) => {
        let message = global.polyglot.t('prepare.start', { minPlayers: Constants.MIN_PLAYERS, maxPlayers: Constants.MAX_PLAYERS });
        const playerIds = await Model.getPlayers(msg.chat.id);
        const members = await Promise.all(playerIds.map(((userId) => global.bot.getChatMember(msg.chat.id, userId))));
        const playerNames = members.map(((member) => Utils.getUserLabel(member.user)));
        if (playerNames.length) {
            message += `\n${global.polyglot.t('prepare.playersAlreadyJoined', { playersList: playerNames.join(', ') })}`;
        }
        return message;
    }

}