// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = 'test';

import { initApp } from '../dist';
import handleUpdate from '../dist/controller/Controller';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Update } from 'node-telegram-bot-api';


export default async function handler(request: VercelRequest, response: VercelResponse) {
    try {
        if (request.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) {
            throw "Invalid secret";
        }

        const update: Update = request.body;
        await initApp();
        
        if(global.bot === undefined) {
            throw Error("Bot undefined");
        }

        console.log("Update received", update);
        await handleUpdate(update);
        console.log("Update processed");

        if (!response.closed) {
            response.status(200).end();
        }
    }
    catch (error) {
        console.error(error);
        if (!response.closed) {
            response.status(500).send(error);
        }
    }
};
