import { User } from "node-telegram-bot-api";

export namespace Utils {

    export const getUserLabel = (user: User, mentions: boolean = true) => {
        if (mentions) {
            return user.username ? `@${user.username}` : `[${user.first_name} ${user.last_name}](tg://user?id=${user.id})`;
        } 
        return user.username ? `@${user.username}` : `${user.first_name} ${user.last_name}`;
    }

}