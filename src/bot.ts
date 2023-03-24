import TelegramBot from 'node-telegram-bot-api';
import CommandHandler from './handlers/CommandHandler';
import InlineQueryHandler from './handlers/InlineQueryHandler';
import PollAnswerHandler from './handlers/PollAnswerHandler';
import TextHandler from './handlers/TextHandler';

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token as string);


global = {
    ...global,
    bot: bot,
}

// Commands
bot.onText(/^\/\w+$/, CommandHandler.handlerFunction);

// Callback queries
bot.on('callback_query', InlineQueryHandler.handlerFunction);

// Text answers
bot.onText(/.+/, TextHandler.handlerFunction);

// Poll answers
bot.on('poll_answer', PollAnswerHandler.handlerFunction);

export default bot;
