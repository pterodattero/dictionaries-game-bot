import { Message } from "node-telegram-bot-api";
import { Controller } from "../controller";
import { Status } from "../models/Game";
import { PreparationUtils } from "../utils/PreparationUtils";
import Handler from "./Handler";

export default class CommandHandler implements Handler {

    public static async startCommand(msg: Message): Promise<void> {
        // If chat is not a group tell the player to add it to a group
        if ( msg.chat.type !== "group" && msg.chat.type !== "supergroup" ) {
            await global.bot.sendMessage(msg.chat.id, 'Please add me to a group chat to play.');
        }
        else {
            await PreparationUtils.startPreparation(msg);
        }
    }

    public static async stopCommand(msg: Message): Promise<void> {
        // If chat is not a group tell the player to add it to a group
        if ( await Controller.getGameStatus(msg.chat.id) !== Status.STOPPED ) {
            await Controller.setGameStatus(msg.chat.id, Status.STOPPED);
            await global.bot.sendMessage(msg.chat.id, 'Game stopped');
        }
        else {
            await global.bot.sendMessage(msg.chat.id, 'No game is going on');
        }
    }

    public static async handlerFunction(msg: Message): Promise<void> {
        try {
            switch (msg.text?.substring(1)) {
                case 'start':
                    console.log("Start command");
                    await CommandHandler.startCommand(msg);
                    break;
                    case 'stop':
                    console.log("Stop command");
                    await CommandHandler.stopCommand(msg);
                    break;
                case 'help':
                case 'rules':
                case 'about':
                default:
                    await global.bot.sendMessage(msg.chat.id, "Unrecognized command");
            }
        }
        catch (err) {
            console.error(err);
        }
    }

}