import { Model } from './model/Model';
import handleUpdate from './controller/Controller';
import TelegramBot from 'node-telegram-bot-api';
import Polyglot from 'node-polyglot';


export async function initApp() {
    const token = process.env.BOT_TOKEN;

    // connect to db
    await Model.connect();

    // init global object
    global = {
        ...global,
        bot: new TelegramBot(token as string),
        polyglot: new Polyglot(),
    }
}

async function main() {
    await initApp();
    await global.bot.deleteWebHook();

    let offset = -1;

    console.log("Start polling...");
    setPolling(async () => {
        const updates = await global.bot.getUpdates({ offset });
        if (updates.length) {
            console.log(`${ updates.length } update(s) received`)
        }
        for (const update of updates) {
            try {
                await handleUpdate(update);
            }
            catch (error) {
                console.error(error);
            }
        }
        offset = updates[updates.length-1]?.update_id + 1 ?? offset;
    }, 1000);
}

async function setPolling(func: () => Promise<void>, interval: number) {
    await func();
    setTimeout(() => setPolling(func, interval), interval);
}

if (process.env.VERCEL_ENV === 'development') {
    main();
}