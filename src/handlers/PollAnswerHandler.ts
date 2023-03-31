import { PollAnswer } from "node-telegram-bot-api";
import { Controller } from "../controller";
import { Status } from "../models/Game";
import { RoundUtils } from "../utils/RoundUtils";
import Handler from "./Handler";

export default class PollAnswerHandler implements Handler {

    // Dispatch text interactions
    public static async handlerFunction(pollAnswer: PollAnswer): Promise<void> {
        try {
            const res = await Controller.getPollInteraction(pollAnswer.poll_id);
            if (!res) {
                return;
            }
            const { chatId } = res;
        
            const status = await Controller.getGameStatus(chatId);
            if (status === Status.POLL) {
                await RoundUtils.answer(pollAnswer);
            }
        }
        catch (err) {
            console.error(err);
        }
    }

}