const token = process.env.BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;

async function main() {
    if (!token) {
        throw "Missing token";
    }
    if (!secret) {
        throw "Missing secret";
    }
    const result = await fetch(`https://api.telegram.org/bot${ token }/setWebhook`,
        {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: `https://${ process.env.VERCEL_URL }/api/webhook`,
                secret_token: secret,
            })
        }
    )

    console.log(await result.json());
}

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development' ) {
    main();
}