import TelegramBot, { CallbackQuery, Message } from "node-telegram-bot-api";
import { PreparationUtils } from "../utils/PreparationUtils";
import { RoundUtils } from "../utils/RoundUtils";
import Handler from "./Handler";

export default class InlineQueryHandler implements Handler {

    public static async handlerFunction(query: CallbackQuery): Promise<void> {
        try {
            switch (query.data) {
                case 'prepare:join':
                    await PreparationUtils.join(query);
                    break;
                case 'prepare:withdraw':
                    await PreparationUtils.withdraw(query);
                    break;
                case 'prepare:continue':
                    await RoundUtils.startGame(query);
                    break;
                default:
                    await global.bot.sendMessage(query.chat_instance, "Unrecognized query data");
            }
        }
        catch (err) {
            console.error(err);
        }
    }

}