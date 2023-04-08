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
    try {
        switch (query.data) {
            case 'prepare:join':
                await PreparationUtils.join(query);
                break;
            case 'prepare:withdraw':
                await PreparationUtils.withdraw(query);
                break;
            case 'prepare:continue':
                await RoundUtils.startGame(query);
                break;
            default:
                if (query.data?.startsWith('language:')) {
                    await LanguageUtils.languageCallback(query);
                } else {
                    await global.bot.sendMessage(query.chat_instance, "Unrecognized query data");
                }
        }
    }
    catch (err) {
        console.error(err);
    }
}


const handlePollAnswer = async (pollAnswer: PollAnswer) => {
    try {
        const res = await Controller.getPollInteraction(pollAnswer.poll_id);
        if (!res) {
            return;
        }
        const { chatId } = res;
    
        const status = await Controller.getGameStatus(chatId);
        if (status === Status.POLL) {
            await RoundUtils.answer(pollAnswer);
        }
    }
    catch (err) {
        console.error(err);
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
    
        const chatId = await Controller.getMessageInteraction(msg.reply_to_message.message_id,  msg.from.id);
        if (!chatId) {
            global.bot.sendMessage(msg.from.id, global.polyglot.t('round.invalidInteraction'));
            return;
        }
    
        const status = await Controller.getGameStatus(chatId);
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
        : update.poll_answer ? (await Controller.getPollInteraction(update.poll_answer.poll_id))?.chatId
        : update.message?.reply_to_message?.from && update.message.from ? await Controller.getMessageInteraction(update.message.reply_to_message.message_id, update.message.from.id)
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
    } else if (update.poll_answer) {
        await handlePollAnswer(update.poll_answer);
    } else if (update.message) {
        await handleText(update.message);
    }
};

export default handleUpdate;