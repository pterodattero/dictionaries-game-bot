import bot from './bot';
import { Controller } from './controller';
import CommandHandler from './handlers/CommandHandler';
import InlineQueryHandler from './handlers/InlineQueryHandler';
import PollAnswerHandler from './handlers/PollAnswerHandler';
import TextHandler from './handlers/TextHandler';

async function main() {
    await Controller.connect();
    console.log("Start polling...");

    // development handlers
    bot.onText(/^\/\w+$/, CommandHandler.handlerFunction);
    bot.on('callback_query', InlineQueryHandler.handlerFunction);
    bot.onText(/.+/, TextHandler.handlerFunction);
    bot.on('poll_answer', PollAnswerHandler.handlerFunction);

    await bot.startPolling();
}

main();