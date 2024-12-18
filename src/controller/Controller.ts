import { CallbackQuery, Message, PollAnswer, Update } from "node-telegram-bot-api";

import { CommandController } from "./CommandController";
import { PreparationController } from "./PreparationController";
import { RoundController } from "./RoundController";
import { Model } from "../model/Model";
import { Status } from "../model/Game";
import * as I18n from "../i18n";
import { LanguageController } from "./LanguageController";


const handleCommand = async (msg: Message) => {
    try {
        if (!msg.text) {
            return;
        }
        const [ command, scope ] = msg.text?.substring(1).split('@');
        if (scope && scope !== (await global.bot.getMe()).username) {
            return;
        }

        switch (command) {
            case 'start':
                await CommandController.startCommand(msg);
                break;
            case 'stop':
                await CommandController.stopCommand(msg);
                break;
            case 'repeat':
                await CommandController.repeatCommand(msg);
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
            const chatId = query.message.chat.id;
            switch (prefix) {
                case 'prepare':
                    if (query.message.message_id !== await Model.getStartMessageId(chatId)) {
                        return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.keyboard.inactive') });
                    }
                    switch (suffix) {
                        case 'join':
                            return PreparationController.join(query);
                        case 'withdraw':
                            return PreparationController.withdraw(query);
                        case 'continue':
                            // developer has to play in the game when not in production
                            if ((!process.env.VERCEL_ENV || process.env.VERCEL_ENV !== 'production') && process.env.DEVELOPER_USER_ID) {
                                const playerIds = await Model.getPlayers(chatId);
                                if (!playerIds.includes(Number(process.env.DEVELOPER_USER_ID))) {
                                    return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.keyboard.testVersionError'), show_alert: true });
                                }
                            }
                            return RoundController.startGame(query);
                    }
                case 'language':
                    return LanguageController.languageCallback(query);
                case 'start':
                    await LanguageController.languageCallback(query);
                    if (query.message.chat.type === 'group') {
                        return PreparationController.startPreparation(query.message);
                    }
                    return global.bot.sendMessage(chatId, global.polyglot.t('start.welcome'), { parse_mode: 'HTML' });
                case 'poll':
                    const pollMessageId = query.message.message_id;
                    // round is still open
                    if (pollMessageId === await Model.getPollMessageId(chatId)) {
                        return RoundController.answer(query);
                    }
                    else {
                        return RoundController.seeVotes(query);
                    }
                case 'lapEnd':
                    if (query.message.message_id !== await Model.getLapEndMessageId(chatId)) {
                        return global.bot.answerCallbackQuery(query.id, { text: global.polyglot.t('prepare.keyboard.inactive') });
                    }
                    await global.bot.answerCallbackQuery(query.id);
                    switch (suffix) {
                        case 'end':
                            return Promise.all([
                                global.bot.deleteMessage(chatId, query.message.message_id),
                                RoundController.endGame(chatId),
                            ]);
                        case 'continue':
                            return Promise.all([
                                global.bot.editMessageText(
                                    global.polyglot.t('round.lapEnd.newLap'),
                                    { chat_id: chatId, message_id: query.message.message_id}
                                ),
                                RoundController.newRound(chatId),
                            ]);
                    }
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
    
        if (!msg.from) {
            throw "Invalid message";
        }
    
        const res = await Model.getMessageInteraction(msg.from.id, msg.reply_to_message?.message_id);
        if (!res) {
            return global.bot.sendMessage(msg.from.id, global.polyglot.t('replyAlert'));
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
        msg.from && await global.bot.sendMessage(msg.from.id, global.polyglot.t('invalidInteraction'));
    }
}


const inferLanguageFromUpdate = async (update: Update) => {
    const safeGetMessageInteraction = async () => {
        try {
            if (update.message?.from) {
                const interaction = await Model.getMessageInteraction(update.message?.from?.id, update.message.reply_to_message?.message_id);
                return interaction?.chatId;
            }
        }
        catch { }
    }
    const chatId = update.message?.chat.type === 'group' ? update.message?.chat.id
        : update.callback_query ? update.callback_query.message?.chat.id
        : await safeGetMessageInteraction() ?? update.message?.from?.id;
    const language = await Model.getLanguange(chatId);
    return language;
}


const handleUpdate = async (update: Update) => {
    // infer chat context
    const language = await inferLanguageFromUpdate(update);
    await I18n.init(language);

    const commandRegex = /^\/[A-Za-z_]+(\@[A-Za-z_]+){0,1}$/; 
    if (update.message?.text && update.message.text.match(commandRegex)) {
        await handleCommand(update.message);
    } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    } else if (update.message) {
        await handleText(update.message);
    }
};

export default handleUpdate;