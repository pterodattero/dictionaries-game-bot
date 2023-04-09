import { Message } from "node-telegram-bot-api";

import { Controller } from "../controller";
import { Status } from "../models/Game";
import { Language, LanguageUtils } from "./LanguageUtils";
import { PreparationUtils } from "./PreparationUtils";

export namespace CommandUtils {

    export const startCommand = async (msg: Message) => {
        if (msg.chat.type !== "group") {
            if (!(await Controller.isChatInitialized(msg.chat.id))) {
                return LanguageUtils.languageCommand(msg);
            } else {
                return global.bot.sendMessage(msg.chat.id, global.polyglot.t('command.startError'));
            }
        }
        else {
            await PreparationUtils.startPreparation(msg);
        }
    }

    export const stopCommand = async (msg: Message) => {
        // If chat is not a group tell the player to add it to a group
        if (await Controller.getGameStatus(msg.chat.id) !== Status.STOPPED) {
            await Controller.setGameStatus(msg.chat.id, Status.STOPPED);
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('command.stop'));
        }
        else {
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('command.startNoGame'));
        }
    }

    export const helpCommand = async (msg: Message) => {
        const helpText = global.polyglot.t('help', {
            guessPoints: Controller.GUESS_POINTS,
            everyoneGuessedPoints: Controller.EVERYONE_GUESSED_POINTS,
            notEveryoneGuessedLeaderPoints: Controller.NOT_EVERYONE_GUESSED_LEADER_POINTS,
            everyoneGuessedLeaderPoints: Controller.EVERYONE_GUESSED_LEADER_POINTS,
            votePoints: Controller.VOTE_POINTS,
        });
        await global.bot.sendMessage(msg.chat.id, helpText);
    }

    export const aboutCommand = async (msg: Message) => {
        await global.bot.sendMessage(msg.chat.id, global.polyglot.t('about'), { parse_mode: "Markdown" });
    }

    export const donateCommand = async (msg: Message) => {
        await global.bot.sendMessage(msg.chat.id, global.polyglot.t('donate'));
    }

}