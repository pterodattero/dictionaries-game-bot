import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";

import { Controller } from "../controller"
import { Status } from "../models/Game"
import { RoundUtils } from "./RoundUtils";
import { GenericUtils } from "./GenericUtils";

export namespace PreparationUtils {

    // Start a new game, asking players to join
    export const startPreparation = async (msg: Message) => {
        // Notify if game has already started
        if (await Controller.getGameStatus(msg.chat.id) !== Status.STOPPED)
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('prepare.refuse'));

        // Start joining stage
        else {
            await Controller.initGame(msg.chat.id);
            await global.bot.sendMessage(
                msg.chat.id,
                await getJoinMessage(msg),
                { reply_markup: await getJoinKeyboard(msg) }
            )
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
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.interactionError') });
            return;
        }

        if (await Controller.addPlayer(query.message.chat.id, query.from.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(await getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, });

            // When maximum nuber of players is reached start first round
            if ((await Controller.numberOfPlayers(query.message.chat.id)) >= Controller.MAX_PLAYERS) {
                await RoundUtils.startGame(query);
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
        if (await Controller.removePlayer(query.message.chat.id, query.from?.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await getJoinKeyboard(query.message);
            await global.bot.editMessageText(await getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, });
        }
        else {
            await global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.notJoined') });
        }
    }


    // Auxiliary method to draw join keyboard
    const getJoinKeyboard = async (msg: Message) => {
        const numberOfPlayers = await Controller.numberOfPlayers(msg.chat.id);
        const botInviteLink = `https://t.me/${(await global.bot.getMe()).username}`;
        const keyboard: TelegramBot.InlineKeyboardMarkup = {
            inline_keyboard: [
                [
                    { text: global.polyglot.t('prepare.keyboard.join', { availableSlots: Controller.MAX_PLAYERS - numberOfPlayers }), callback_data: 'prepare:join' },
                    { text: global.polyglot.t('prepare.keyboard.withdraw'), callback_data: 'prepare:withdraw' }
                ]
            ]
        };

        if ((numberOfPlayers >= Controller.MIN_PLAYERS) || (process.env.NODE_ENV === 'development')) {
            keyboard.inline_keyboard[0].push({ text: global.polyglot.t('prepare.keyboard.continue'), callback_data: 'prepare:continue' })
        }

        if (botInviteLink) {
            keyboard.inline_keyboard.push([{ text: global.polyglot.t('prepare.keyboard.register'), url: botInviteLink }])
        }

        return keyboard;
    }


    // Auxiliary method to get preparation message
    const getJoinMessage = async (msg: Message) => {
        let message = global.polyglot.t('prepare.start', { minPlayers: Controller.MIN_PLAYERS, maxPlayers: Controller.MAX_PLAYERS });
        const playerIds = await Controller.getPlayers(msg.chat.id);
        const members = await Promise.all(playerIds.map(((userId) => global.bot.getChatMember(msg.chat.id, userId))));
        const playerNames = members.map(((member) => GenericUtils.getUserLabel(member.user)));
        if (playerNames.length) {
            message += `\n${global.polyglot.t('prepare.playersAlreadyJoined', { playersList: playerNames.join(', ') })}`;
        }
        return message;
    }

}