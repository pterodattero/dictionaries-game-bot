import { Message, CallbackQuery } from 'node-telegram-bot-api';
import { Controller } from '../controller';
import * as I18n from '../i18n';


export enum Language {
    ENGLISH = 'en',
    ITALIAN = 'it',
}


export namespace LanguageUtils {

    export const languageCommand = async (msg: Message) => {
        const text = global.polyglot.t(msg.chat.type === 'group' ? 'language.selectGroup' : 'language.selectPrivate');
        await global.bot.sendMessage(
            msg.chat.id, text,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "English", callback_data: `language:${Language.ENGLISH}` }, { text: "Italiano", callback_data: `language:${Language.ITALIAN}` }],
                    ]
                }
            }
        );
    }

    export const languageCallback = async (query: CallbackQuery) => {
        const chatId = query.message?.chat.id;
        const language = query.data?.substring(query.data.indexOf(':') + 1) ?? 'en';
        if (chatId) {
            await Controller.setLanguange(chatId, language);
            await global.bot.answerCallbackQuery(query.id);
            await I18n.init(language);
            await global.bot.editMessageText(global.polyglot.t('language.done'), { chat_id: chatId, message_id: query.message?.message_id });
        }
    }

}