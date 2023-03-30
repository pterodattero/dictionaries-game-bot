import TelegramBot from 'node-telegram-bot-api';

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token as string);


global = {
    ...global,
    bot: bot,
}

export default bot;
