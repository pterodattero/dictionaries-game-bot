import { CallbackQuery, Message, PollAnswer, Update } from "node-telegram-bot-api";

import { CommandController } from "./CommandController";
import { PreparationController } from "./PreparationController";
import { RoundController } from "./RoundController";
import { Model } from "../model/Model";
import { Status } from "../model/Game";
import * as I18n from "../i18n";
import { LanguageController } from "./LanguageController";


const handleCommand = async (msg: Message, language: string) => {
    try {
        switch (msg.text?.substring(1)) {
            case 'start':
                await CommandController.startCommand(msg);
                break;
            case 'stop':
                await CommandController.stopCommand(msg);
                break;
            case 'help':
                await CommandController.helpCommand(msg);
                break;
            case 'language':
                await LanguageController.languageCommand(msg);
                break;
            case 'about':
                await CommandController.aboutCommand(msg);
                break;
            case 'donate':
                await CommandController.donateCommand(msg);
                break;
            default:
        }
    }
    catch (err) {
        console.error(err);
    }
};

const handleCallbackQuery = async (query: CallbackQuery) => {
    if (query.data && query.message) {
        try {
            const [ prefix, suffix ] = query.data.split(':');
            switch (prefix) {
                case 'prepare':
                    switch (suffix) {
                        case 'join':
                            return PreparationController.join(query);
                        case 'withdraw':
                            return PreparationController.withdraw(query);
                        case 'continue':
                            return RoundController.startGame(query);
                    }
                case 'language':
                    return LanguageController.languageCallback(query);
                case 'start':
                    await LanguageController.languageCallback(query);
                    return global.bot.sendMessage(query.message.chat.id, global.polyglot.t('start.welcome'), { parse_mode: 'Markdown' });
                case 'poll':
                    return RoundController.answer(query);
                default:
                    throw 'Unrecognized query data';
            }
        }
        catch (err) {
            console.error(err);
        }
    }
}


const handleText = async (msg: Message) => {
    try {
        // text interaction are allowed only in private chats
        if (msg.chat.type !== 'private') {
            return;
        }

        // only replies are valid, otherwise it is not possible to uniquely reconduce text to group chats
        if (!msg.reply_to_message) {
            await global.bot.sendMessage(msg.chat.id, global.polyglot.t('replyAlert'), { reply_to_message_id: msg.message_id });
            return;
        }
    
        if (!msg.from) {
            throw "Invalid message";
        }
    
        const res = await Model.getMessageInteraction(msg.reply_to_message.message_id,  msg.from.id);
        if (!res) {
            global.bot.sendMessage(msg.from.id, global.polyglot.t('round.invalidInteraction'));
            return;
        }
    
        const status = await Model.getGameStatus(res.chatId);
        if (status === Status.QUESTION) {
            await RoundController.word(msg);
        }
        else if (status === Status.ANSWER) {
            await RoundController.definition(msg);
        }
    }
    catch (err) {
        console.error(err);
    }
}


const inferLanguageFromUpdate = async (update: Update) => {
    const chatId = update.message?.chat.type === 'group' ? update.message?.chat.id
        : update.callback_query ? update.callback_query.message?.chat.id
        : update.message?.reply_to_message?.from && update.message.from ? (await Model.getMessageInteraction(update.message.reply_to_message.message_id, update.message.from.id))?.chatId
        : update.message?.from?.id;
    const language = await Model.getLanguange(chatId);
    return language;
}


const handleUpdate = async (update: Update) => {
    // infer chat context
    const language = await inferLanguageFromUpdate(update);
    await I18n.init(language);

    if (update.message?.text && update.message.text.match(/^\/\w+$/)) {
        await handleCommand(update.message, language);
    } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
        await handleText(update.message);
    }
};

export default handleUpdate;