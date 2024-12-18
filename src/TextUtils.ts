import { InlineKeyboardButton, InlineKeyboardMarkup, User } from "node-telegram-bot-api";
import Fs from 'fs/promises';
import Path from 'path';

import { Model } from "./model/Model";
import Constants from "./constants";


export namespace TextUtils {

    export const getUserLabel = (user: User, mentions: boolean = true) => {
        if (user.username) {
            return `@${escapeHtml(user.username)}`;
        }
        const nameSurnameString = `${escapeHtml(user.first_name)}${user.last_name ? ` ${ escapeHtml(user.last_name)}` : ''}`;
        if (!mentions) {
            return nameSurnameString;
        }
        return `<a href="tg://user?id=${user.id}">${nameSurnameString}</a>`;
    }

    export const getCheckBotChatReplyMarkup = async () => {
        return {
            inline_keyboard: [[{ text: global.polyglot.t('round.group.checkBotChat'), url: `https://t.me/${(await global.bot.getMe()).username}` }]]
        } as InlineKeyboardMarkup;
    }

    export const getPollMessage = async (chatId: number, solution: boolean = false) => {
        const [definitions, word, leaderId, votes] = await Promise.all([
            Model.getDefinitions(chatId),
            Model.getWord(chatId),
            Model.getCurrentPlayer(chatId),
            Model.getVotes(chatId),
        ])

        let text = `<b>${global.polyglot.t('round.poll.header', { word })}</b>`;
        for (const i in definitions) {
            text += `\n<b>${Number(i) + 1}.</b> `;
            if (solution) {
                text += definitions[i].userId === leaderId ? '✔️ ' : '❌ ';
            }

            text += escapeHtml(definitions[i].definition);
            if (solution) {
                const label = getUserLabel((await global.bot.getChatMember(chatId, definitions[i].userId)).user);
                const nVotes = votes.find((el) => el.userId === definitions[i].userId)?.votes.length ?? 0;
                text += ` - <i>${label} (${nVotes})</i>`;
            }
        }

        if (!solution) {
            const missingPlayers = await Model.getMissingPlayers(chatId);
            text += `\n\n<i>${global.polyglot.t('round.group.voteMissing', {
                missingPlayers: await getPlayersString(chatId, missingPlayers),
                smart_count: missingPlayers.length,
            })}</i>`;
        } else {
            text += `\n\n<i>${global.polyglot.t('round.group.checkVoteButtons')}</i>`;
        }

        return text;
    }

    export const getPollKeyboard = async (chatId: number) => {
        const definitions = await Model.getDefinitions(chatId);
        const numberOfRows = Math.ceil(definitions.length / Constants.MAX_BUTTONS_IN_ROW);
        const buttonsInARow = Math.ceil(definitions.length / numberOfRows);

        const keyboard: InlineKeyboardButton[][] = [];
        for (let i = 0; i < definitions.length; i++) {
            if (i % buttonsInARow === 0) {
                keyboard.push([]);
            }
            keyboard[keyboard.length - 1].push({ text: String(i + 1), callback_data: `poll:${definitions[i].userId}` })
        }

        return keyboard;
    }

    export const getPlayersString = async (chatId: number, userIds: number[], mentions: boolean = true) => {
        const members = await Promise.all(userIds.map(((userId) => global.bot.getChatMember(chatId, userId))));
        const missingPlayers = members.map((member) => getUserLabel(member.user, mentions));
        const conjunction = global.polyglot.t('conjunction');
        return [...missingPlayers.slice(0, -2), missingPlayers.slice(-2).join(` ${conjunction} `)].join(', ');
    }

    // Auxiliary method to get preparation message
    export const getJoinMessage = async (chatId: number) => {
        let message = global.polyglot.t('prepare.start', { minPlayers: Constants.MIN_PLAYERS, maxPlayers: Constants.MAX_PLAYERS });
        const playerIds = await Model.getPlayers(chatId);
        if (playerIds.length) {
            message += `\n\n<i>${global.polyglot.t('prepare.playersAlreadyJoined', { playersList: await getPlayersString(chatId, playerIds), smart_count: playerIds.length })}</i>`;
        }
        return message;
    }

    export const getResourcesKeyboard = async (chatId: number) => {
        const BUTTONS_IN_ROW = 2;
        const language = await Model.getLanguange(chatId);
        const resources: { text: string, url: string }[] = JSON.parse((await Fs.readFile(Path.resolve(__dirname, './i18n', `resources.${language}.json`))).toString());
        const keyboard: InlineKeyboardButton[][] = [];
        for (const i in resources) {
            if (Number(i) % BUTTONS_IN_ROW === 0) {
                keyboard.push([]);
            }
            keyboard[keyboard.length - 1].push(resources[i]);
        }
        return keyboard;
    }

    export const escapeHtml = (text: string) => {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

}