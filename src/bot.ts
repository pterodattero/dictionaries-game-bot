import TelegramBot from 'node-telegram-bot-api';

const token = process.env.BOT_TOKEN

const bot = new TelegramBot(token as string);

bot.onText(/./, async (msg) => {
    await bot.sendMessage(msg.chat.id, "Ciao e grazie");
})

export default bot;