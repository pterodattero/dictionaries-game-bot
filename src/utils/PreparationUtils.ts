import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api"
import { Controller } from "../controller"
import { Status } from "../models/Game"
import { RoundUtils } from "./RoundUtils";

export class PreparationUtils {

    // Start a new game, asking players to join
    public static async startPreparation(msg: Message) {
        // Notify if game has already started
        if (await Controller.getGameStatus(msg.chat.id) !== Status.STOPPED)
            await global.bot.sendMessage(msg.chat.id, 'A game is already going on in this chat.');

        // Start joining stage
        else {
            await Controller.initGame(msg.chat.id);
            await global.bot.sendMessage(
                msg.chat.id,
                await PreparationUtils.getJoinMessage(msg),
                { reply_markup: await PreparationUtils.getJoinKeyboard(msg) }
            )
        }

    }

    // Handle join keyboard button press
    public static async join(query: CallbackQuery) {
        if (!query.message?.chat.id) {
            throw 'Invalid query'
        }
        try {
            const message = await global.bot.sendMessage(query.from.id, "Trying to interact with you...");
            await global.bot.deleteMessage(query.from.id, message.message_id);
        }
        catch (err) {
            await global.bot.answerCallbackQuery(query.id, { text: 'Please register before joining' });
            return
        }

        if (await Controller.addPlayer(query.message.chat.id, query.from.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await PreparationUtils.getJoinKeyboard(query.message);
            await global.bot.editMessageText(await PreparationUtils.getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, });

            // When maximum nuber of players is reached start first round
            if ((await Controller.numberOfPlayers(query.message.chat.id)) >= Controller.MAX_PLAYERS) {
                await RoundUtils.startGame(query);
            }
        }
        else {
            await global.bot.answerCallbackQuery(query.id, { text: 'You have already joined' });
        }
    }

    // Handle withraw button press
    public static async withdraw(query: CallbackQuery) {
        if (!query.message?.chat.id || !query.message.from?.id) {
            throw 'Invalid query';
        }
        if (await Controller.removePlayer(query.message.chat.id, query.from?.id)) {
            const messageKey = { chat_id: query.message.chat.id, message_id: query.message.message_id }
            const replyMarkup = await PreparationUtils.getJoinKeyboard(query.message);
            await global.bot.editMessageText(await PreparationUtils.getJoinMessage(query.message), { reply_markup: replyMarkup, ...messageKey, });
        }
        else {
            await global.bot.answerCallbackQuery(query.id, { text: "You haven't joined yet" });
        }
    }


    // Auxiliary method to draw join keyboard
    private static async getJoinKeyboard(msg: Message): Promise<TelegramBot.InlineKeyboardMarkup> {
        const numberOfPlayers = await Controller.numberOfPlayers(msg.chat.id);
        const botInviteLink = `https://t.me/${(await global.bot.getMe()).username}`;
        const keyboard: TelegramBot.InlineKeyboardMarkup = {
            inline_keyboard: [
                [
                    { text: `Join (${Controller.MAX_PLAYERS - numberOfPlayers})`, callback_data: 'prepare:join' },
                    { text: 'Withdraw', callback_data: 'prepare:withdraw' }
                ]
            ]
        };

        if ((numberOfPlayers >= Controller.MIN_PLAYERS) || (process.env.NODE_ENV === 'development')) {
            keyboard.inline_keyboard[0].push({ text: 'Continue', callback_data: 'prepare:continue' })
        }

        if (botInviteLink) {
            keyboard.inline_keyboard.push([{ text: 'Register for PM', url: botInviteLink }])
        }

        return keyboard;
    }


    // Auxiliary method to draw join keyboard
    private static async getJoinMessage(msg: Message) {
        let message = 'Heads up! Up to 10 players are accepted.';
        const playerIds = await Controller.getPlayers(msg.chat.id);
        const members = await Promise.all(playerIds.map(((userId) => global.bot.getChatMember(msg.chat.id, userId))));
        const playerNames = members.map(((member) => member.user.username));
        if (playerNames.length) {
            message += `\n${playerNames.join(', ')} already joined.`;
        }
        return message;
    }

}