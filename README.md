# dictionaries-game-bot

[![Donate](https://img.shields.io/liberapay/goal/pterodattero.svg?logo=liberapay)]()
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/sanfeto)
[![Telegram](https://img.shields.io/badge/Telegram-x?color=gray&logo=telegram)](https://t.me/dictionaries_game_bot)


A Telegram bot written in Node.js to play dictionaries game.


## Development

A Visual Studio Code debug configuation is provided to easily run and debug the application using polling. To install and build:

```
npm install
npm run build
```

## Deploy

This project is configured to be deployed with Vercel, using Node.js 18.x runtime.
You can ship your own deployment just configuring the following environment variables:

* `BOT_TOKEN`: a Telegram bot token
* `MONGODB_URI`: a MongoDB connection URI
* `DEVELOPER_USER_ID` (Optional): your Telegram user ID, if you want to impose your presence in games when using a development bot instance


## Contribution

Possible contributions:

* raise issues on GitHub
* translate game in new languages
* donate on PayPal or LiberaPay
