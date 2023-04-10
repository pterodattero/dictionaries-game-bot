import Fs from 'fs/promises';
import Path from "path";


export async function init(language: string) {
    const i18nfile = JSON.parse((await Fs.readFile(Path.resolve(__dirname, 'i18n', `content.${ language }.json`))).toString());
    global.polyglot.extend(i18nfile);
}
