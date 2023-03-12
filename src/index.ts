import bot from './bot';

async function main() {
    console.log("Start polling...");
    await bot.startPolling();
}

main();