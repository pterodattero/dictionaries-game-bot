import { User } from "node-telegram-bot-api";

export namespace GenericUtils {

    export const getUserLabel = (user: User) => {
        return user.username ? `@${user.username}` : `${user.first_name} ${user.last_name}`;
    } 

}