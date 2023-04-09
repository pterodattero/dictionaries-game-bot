import { CallbackQuery, Message, PollAnswer, Update } from "node-telegram-bot-api";

import { CommandUtils } from "./utils/CommandUtils";
import { PreparationUtils } from "./utils/PreparationUtils";
import { RoundUtils } from "./utils/RoundUtils";
import { Controller } from "./controller";
import { Status } from "./models/Game";
import * as I18n from "./i18n";
import { LanguageUtils } from "./utils/LanguageUtils";


const handleCommand = async (msg: Message, language: string) => {
    try {
        switch (msg.text?.substring(1)) {
            case 'start':
                await CommandUtils.startCommand(msg);
                break;
            case 'stop':
                await CommandUtils.stopCommand(msg);
                break;
            case 'help':
                await CommandUtils.helpCommand(msg);
                break;
            case 'language':
                await LanguageUtils.languageCommand(msg);
                break;
            case 'about':
                await CommandUtils.aboutCommand(msg);
                break;
            case 'donate':
                await CommandUtils.donateCommand(msg);
                break;
            default:
        }
    }
    catch (err) {
        console.error(err);
    }

};

const handleCallbackQuery = async (query: CallbackQuery) => {
    if (query.data) {
        try {
            const [ prefix, suffix ] = query.data.split(':');
            switch (prefix) {
                case 'prepare':
                    switch (suffix) {
                        case 'join':
                            return PreparationUtils.join(query);
                        case 'withdraw':
                            return PreparationUtils.withdraw(query);
                        case 'continue':
                            return RoundUtils.startGame(query);
                    }
                case 'language':
                    return LanguageUtils.languageCallback(query);
                case 'poll':
                    return RoundUtils.answer(query);
                default:
                    return global.bot.sendMessage(query.chat_instance, "Unrecognized query data");
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
    
        const res = await Controller.getMessageInteraction(msg.reply_to_message.message_id,  msg.from.id);
        if (!res) {
            global.bot.sendMessage(msg.from.id, global.polyglot.t('round.invalidInteraction'));
            return;
        }
    
        const status = await Controller.getGameStatus(res.chatId);
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


const inferLanguageFromUpdate = async (update: Update) => {
    const chatId = update.message?.chat.type === 'group' ? update.message?.chat.id
        : update.callback_query ? update.callback_query.message?.chat.id
        : update.message?.reply_to_message?.from && update.message.from ? (await Controller.getMessageInteraction(update.message.reply_to_message.message_id, update.message.from.id))?.chatId
        : update.message?.from?.id;
    const language = await Controller.getLanguange(chatId);
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