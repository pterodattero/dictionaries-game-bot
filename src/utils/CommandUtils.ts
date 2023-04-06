import { Message } from "node-telegram-bot-api";

import { Controller } from "../controller";
import { Status } from "../models/Game";
import { PreparationUtils } from "./PreparationUtils";

export namespace CommandUtils {

    export const startCommand = async (msg: Message) => {
        // If chat is not a group tell the player to add it to a group
        if ( msg.chat.type !== "group" && msg.chat.type !== "supergroup" ) {
            await global.bot.sendMessage(msg.chat.id, 'Please add me to a group chat to play.');
        }
        else {
            await PreparationUtils.startPreparation(msg);
        }
    }

    export const stopCommand = async (msg: Message) => {
        // If chat is not a group tell the player to add it to a group
        if ( await Controller.getGameStatus(msg.chat.id) !== Status.STOPPED ) {
            await Controller.setGameStatus(msg.chat.id, Status.STOPPED);
            await global.bot.sendMessage(msg.chat.id, 'Game stopped');
        }
        else {
            await global.bot.sendMessage(msg.chat.id, 'No game is going on');
        }
    }

}