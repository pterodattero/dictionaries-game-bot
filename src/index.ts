import bot from './bot';
import { Controller } from './controller';
import handleUpdate from './handler';


async function main() {
    await bot.deleteWebHook();
    await Controller.connect();

    let offset = -1;

    console.log("Start polling...");
    setPolling(async () => {
        const updates = await bot.getUpdates({ offset });
        offset = updates[updates.length-1]?.update_id + 1 ?? offset;
        if (updates.length) {
            console.log(`${ updates.length } update(s) received`)
        }
        for (const update of updates) {
            await handleUpdate(update);
        }
    }, 1000);
}

async function setPolling(func: () => Promise<void>, interval: number) {
    await func();
    setTimeout(() => setPolling(func, interval), interval);
}

main();