import bot from './bot';
import { Controller } from './controller';

async function main() {
    await Controller.connect();
    console.log("Start polling...");
    await bot.startPolling();
}

main();