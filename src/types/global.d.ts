/// <reference types="node" />
import TelegramBot from "node-telegram-bot-api";

declare global {
    var bot: TelegramBot;
}