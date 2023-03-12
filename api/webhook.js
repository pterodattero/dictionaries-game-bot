// https://github.com/yagop/node-telegram-bot-api/issues/319#issuecomment-324963294
// Fixes an error with Promise cancellation
process.env.NTBA_FIX_319 = 'test';

const bot = require('../public/bot').default;

module.exports = async (request, response) => {
    try {
        const update = request.body;
        await bot.processUpdate(update);
    }
    catch(error) {
        console.error(error.toString());
    }
    
    // Acknowledge the message with Telegram
    // by sending a 200 HTTP status code
    response.send('OK');
};
