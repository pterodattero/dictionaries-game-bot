/// <reference types="node" />
import Polyglot from "node-polyglot";
import TelegramBot from "node-telegram-bot-api";

export { };

declare global {
    var bot: TelegramBot;
    var polyglot: Polyglot;

    namespace NodeJS {
        interface ProcessEnv {
            VERCEL_ENV: 'development' | 'preview' | 'production';

            BOT_TOKEN: string;
            DB_NAME?: string;
            DEVELOPER_USER_ID?: number;
            LIBERAPAY_URL?: string;
            MONGODB_URI: string;
            PAYPAL_URL?: string;
            WEBHOOK_SECRET: string;

            MIN_PLAYERS?: number;
            MAX_PLAYERS?: number;
            VOTE_POINTS?: number;
            GUESS_POINTS?: number;
            EVERYONE_GUESSED_POINTS?: number;
            NOT_EVERYONE_GUESSED_LEADER_POINTS?: number;
            EVERYONE_GUESSED_LEADER_POINTS?: number;
            MAX_BUTTONS_IN_ROW?: number;
            NEXT_ROUND_WAIT?: number;
        }
    }
}


