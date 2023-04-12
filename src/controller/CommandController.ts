import { Message } from "node-telegram-bot-api";

import { Model } from "../model/Model";
import { Status } from "../model/Game";
import { Language, LanguageController } from "./LanguageController";
import { PreparationController } from "./PreparationController";
import Constants from "../constants";

export namespace CommandController {

    export const startCommand = async (msg: Message) => {
        if (msg.chat.type !== "group") {
            if (!(await Model.isChatInitialized(msg.chat.id))) {
                return LanguageController.languageCommand(msg, 'start');
            } else {
                return global.bot.sendMessage(msg.chat.id, global.polyglot.t('start.error'));
            }
        }
        else {
            await PreparationController.startPreparation(msg);
        }
    }

    export const stopCommand = async (msg: Message) => {
        if (msg.chat.type !== 'group') {
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('command.stopInGroup'));
        }
        else if (await Model.getGameStatus(msg.chat.id) !== Status.STOPPED) {
            return Promise.all([
                Model.setGameStatus(msg.chat.id, Status.STOPPED),
                Model.cleanMessageInteractions(msg.chat.id),
                global.bot.sendMessage(msg.chat.id, global.polyglot.t('command.stop')),
            ]);
        }
        else {
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('start.noGame'));
        }
    }

    export const helpCommand = async (msg: Message) => {
        const helpText = global.polyglot.t('help', {
            guessPoints: Constants.GUESS_POINTS,
            everyoneGuessedPoints: Constants.EVERYONE_GUESSED_POINTS,
            notEveryoneGuessedLeaderPoints: Constants.NOT_EVERYONE_GUESSED_LEADER_POINTS,
            everyoneGuessedLeaderPoints: Constants.EVERYONE_GUESSED_LEADER_POINTS,
            votePoints: Constants.VOTE_POINTS,
        });
        await global.bot.sendMessage(msg.chat.id, helpText);
    }

    export const aboutCommand = async (msg: Message) => {
        await global.bot.sendMessage(msg.chat.id, global.polyglot.t('about'), { parse_mode: "Markdown" });
    }

    export const donateCommand = async (msg: Message) => {
        return global.bot.sendMessage(msg.chat.id, global.polyglot.t('donate'), {
            reply_markup: {
                inline_keyboard: [[
                    { text: "Paypal", url: process.env.PAYPAL_URL },
                    { text: "Liberapay", url: process.env.LIBERAPAY_URL },
                ]]
            }
        })
    }

}