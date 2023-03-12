require('dotenv').config();

const token = process.env.BOT_TOKEN

async function main() {
    const result = await fetch(`https://api.telegram.org/bot${ token }/setWebhook`,
        {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: 'https://dictionaries-game-bot-pterodattero.vercel.app/api/webhook'
            })
        }
    )

    console.log(await result.json());
}

main();