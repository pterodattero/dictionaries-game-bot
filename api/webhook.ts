// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = 'test';

import bot from '../dist/bot';
import { Controller } from '../dist/controller';
import CommandHandler from '../dist/handlers/CommandHandler';
import InlineQueryHandler from '../dist/handlers/InlineQueryHandler';
import PollAnswerHandler from '../dist/handlers/PollAnswerHandler';
import TextHandler from '../dist/handlers/TextHandler';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Update } from 'node-telegram-bot-api';


export default async function handler(request: VercelRequest, response: VercelResponse) {
    try {
        if (request.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) {
            throw "Invalid secret";
        }

        const update: Update = request.body;
        await Controller.connect();
        
        if(!bot || global.bot === undefined) {
            throw Error("Bot undefined");
        }

        console.log("Update received", update);
        if (update.message?.text && update.message.text.match(/^\/\w+$/)) {
            await CommandHandler.handlerFunction(update.message);
        } else if (update.callback_query) {
            await InlineQueryHandler.handlerFunction(update.callback_query);
        } else if (update.poll_answer) {
            await PollAnswerHandler.handlerFunction(update.poll_answer);
        } else if (update.message) {
            await TextHandler.handlerFunction(update.message);
        }
        console.log("Update processed");

        if (!response.closed) {
            response.status(200).end();
        }
    }
    catch (error) {
        console.error(error.toString());
        if (!response.closed) {
            response.status(500).send(error);
        }
    }
};
