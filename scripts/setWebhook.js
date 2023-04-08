const token = process.env.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;

async function main() {
    if (!token) {
        "Missing token";
    }
    if (!secret) {
        "Missing secret";
    }
    const result = await fetch(`https://api.telegram.org/bot${ token }/setWebhook`,
        {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: 'https://dictionaries-game-bot-pterodattero.vercel.app/api/webhook',
                secret_token: secret,
            })
        }
    )

    console.log(await result.json());
}

if (process.env.NODE_ENV !== 'development') {
    main();
}