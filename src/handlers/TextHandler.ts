import { Message } from "node-telegram-bot-api";
import { Controller } from "../controller";
import { Status } from "../models/Game";
import { RoundUtils } from "../utils/RoundUtils";
import Handler from "./Handler";

export default class TextHandler implements Handler {

    // Dispatch text interactions
    public static async handlerFunction(msg: Message): Promise<void> {
        try {
            // text interaction are allowed only in private chats
            if (msg.chat.type !== 'private') {
                return;
            }

            // only replies are valid, otherwise it is not possible to uniquely reconduce text to group chats
            if (!msg.reply_to_message) {
                await global.bot.sendMessage(msg.chat.id, "If you want to interact with me please reply to my messages (swipe left)", { reply_to_message_id: msg.message_id });
                return;
            }
        
            if (!msg.from) {
                throw "Invalid message";
            }
        
            const chatId = await Controller.getMessageInteraction(msg.reply_to_message.message_id,  msg.from.id);
            if (!chatId) {
                return;
            }
        
            const status = await Controller.getGameStatus(chatId);
            if (status === Status.QUESTION) {
                await RoundUtils.word(msg);
            }
            else if (status === Status.ANSWER) {
                await RoundUtils.definition(msg);
            }
        }
        catch (err) {
            console.error(err);
        }
    }

}