import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";

import { Model } from "../model/Model"
import { Status } from "../model/Game"
import { RoundController } from "./RoundController";
import { TextUtils } from "../TextUtils";
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
                await TextUtils.getJoinMessage(chatId),
                { reply_markup: await getJoinKeyboard(msg), parse_mode: 'HTML' }
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
            const chatId = query.message.chat.id;
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(
                await TextUtils.getJoinMessage(chatId),
                { reply_markup: replyMarkup, chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML' }
            );

            // When maximum nuber of players is reached start first round
            if ((await Model.numberOfPlayers(chatId)) >= Constants.MAX_PLAYERS) {
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
        const chatId = query.message.chat.id;
        if (await Model.removePlayer(chatId, query.from?.id)) {
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(
                await TextUtils.getJoinMessage(chatId),
                { reply_markup: replyMarkup, chat_id: chatId, message_id: query.message.message_id, parse_mode: 'HTML'}
            );
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

}