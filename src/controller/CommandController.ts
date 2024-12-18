import { Message } from "node-telegram-bot-api";

import { Model } from "../model/Model";
import { Status } from "../model/Game";
import { LanguageController } from "./LanguageController";
import { PreparationController } from "./PreparationController";
import { RoundController } from "./RoundController";
import Constants from "../constants";

export namespace CommandController {

    export const startCommand = async (msg: Message) => {
        if (!(await Model.isChatInitialized(msg.chat.id))) {
            return LanguageController.languageCommand(msg, 'start');
        }
        if (msg.chat.type !== "group") {
            return global.bot.sendMessage(msg.chat.id, global.polyglot.t('start.error'));
        }
        else {
            return PreparationController.startPreparation(msg);
        }
    }

    export const stopCommand = async (msg: Message) => {
        const chatId = msg.chat.id;
        if (msg.chat.type !== 'group') {
            await global.bot.sendMessage(chatId, global.polyglot.t('command.groupOnly'));
        }
        else if (await Model.getGameStatus(chatId) !== Status.STOPPED) {
            return Promise.all([
                Model.setStartMessageId(chatId),
                Model.setLapEndMessageId(chatId),
                Model.setGameStatus(chatId, Status.STOPPED),
                Model.cleanMessageInteractions(chatId),
                global.bot.sendMessage(chatId, global.polyglot.t('command.stop')),
            ]);
        }
        else {
            await global.bot.sendMessage(chatId, global.polyglot.t('start.noGame'));
        }
    }

    export const repeatCommand = async (msg: Message) => {
        const chatId = msg.chat.id;
        if (msg.chat.type !== 'group') {
            await global.bot.sendMessage(chatId, global.polyglot.t('command.groupOnly'));
        }
        else if (await Model.getCurrentPlayer(chatId) != msg.from?.id)
        {
            await global.bot.sendMessage(chatId, global.polyglot.t('command.repeat.onlyCurrentPlayer'));
        }
        else if (await Model.getGameStatus(chatId) != Status.ANSWER) {
            await global.bot.sendMessage(chatId, global.polyglot.t('command.repeat.noAnswer'));
        }
        else {
            await RoundController.newRound(chatId, {repeatRound: true});
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
        await global.bot.sendMessage(msg.chat.id, global.polyglot.t('about'), { parse_mode: "HTML" });
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