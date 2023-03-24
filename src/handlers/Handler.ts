import TelegramBot, { Message } from "node-telegram-bot-api";

export default abstract class Handler {
    public static async handlerFunction(msg: Message): Promise<void> {
        return;
    };
}