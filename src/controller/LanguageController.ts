import { Message, CallbackQuery } from 'node-telegram-bot-api';
import { Model } from '../model/Model';
import * as I18n from '../i18n';


export enum Language {
    ENGLISH = 'en',
    ITALIAN = 'it',
}


export namespace LanguageController {

    export const languageCommand = async (msg: Message, callbackPrefix: string = 'language') => {
        const text = global.polyglot.t('language.select');
        await global.bot.sendMessage(
            msg.chat.id, text,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "English", callback_data: `${callbackPrefix}:${Language.ENGLISH}` },
                            { text: "Italiano", callback_data: `${callbackPrefix}:${Language.ITALIAN}` }
                        ],
                    ]
                }
            }
        );
    }

    export const languageCallback = async (query: CallbackQuery) => {
        const chatId = query.message?.chat.id;
        const language = query.data?.substring(query.data.indexOf(':') + 1) ?? 'en';
        if (chatId) {
            await Model.setLanguange(chatId, language);
            await global.bot.answerCallbackQuery(query.id);
            await I18n.init(language);
            const isGroup = query.message?.chat.type === 'group' || query.message?.chat.type === 'supergroup';
            await global.bot.editMessageText(
                global.polyglot.t(isGroup ? 'language.doneGroup' : 'language.donePrivate'),
                { chat_id: chatId, message_id: query.message?.message_id }
            );
        }
    }

}