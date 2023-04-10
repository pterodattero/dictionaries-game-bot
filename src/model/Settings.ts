import { Schema, model } from "mongoose";

interface ISettings {
    chatId: number,
    language: string,
}

const SettingsSchema = new Schema<ISettings>({
    chatId: { type: Number, required: true, unique: true },
    language: { type: String, default: 'en' },
})

export default model('Setting', SettingsSchema);