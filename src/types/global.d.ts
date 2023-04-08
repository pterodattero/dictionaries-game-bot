/// <reference types="node" />
import Polyglot from "node-polyglot";
import TelegramBot from "node-telegram-bot-api";

declare global {
    var bot: TelegramBot;
    var polyglot: Polyglot;
}