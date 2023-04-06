import { CallbackQuery, Message, PollAnswer, Update } from "node-telegram-bot-api";

import { CommandUtils } from "./utils/CommandUtils";
import { PreparationUtils } from "./utils/PreparationUtils";
import { RoundUtils } from "./utils/RoundUtils";
import { Controller } from "./controller";
import { Status } from "./models/Game";

const handleCommand = async (msg: Message) => {
    try {
        switch (msg.text?.substring(1)) {
            case 'start':
                console.log("Start command");
                await CommandUtils.startCommand(msg);
                break;
            case 'stop':
                console.log("Stop command");
                await CommandUtils.stopCommand(msg);
                break;
            case 'help':
            case 'rules':
            case 'about':
            default:
                await global.bot.sendMessage(msg.chat.id, "Unrecognized command");
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
                await global.bot.sendMessage(query.chat_instance, "Unrecognized query data");
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
            await global.bot.sendMessage(msg.chat.id, "If you want to interact with me please reply to my messages (swipe left)", { reply_to_message_id: msg.message_id });
            return;
        }
    
        if (!msg.from) {
            throw "Invalid message";
        }
    
        const chatId = await Controller.getMessageInteraction(msg.reply_to_message.message_id,  msg.from.id);
        if (!chatId) {
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


const handleUpdate = async (update: Update) => {

    if (update.message?.text && update.message.text.match(/^\/\w+$/)) {
        await handleCommand(update.message);
    } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
    } else if (update.poll_answer) {
        await handlePollAnswer(update.poll_answer);
    } else if (update.message) {
        await handleText(update.message);
    }
};

export default handleUpdate;