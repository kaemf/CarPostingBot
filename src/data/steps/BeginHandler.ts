import { Message } from "../../base/types";
import { CheckException } from "../../base/check";

export default async function BeginHandler(onTextMessage: Message, redis: any) {
    onTextMessage('BeginDataHandler', async (ctx, user, set, data) => {
        if (CheckException.VoiceException(data)) {
            
        }
        else if (CheckException.AudioException(data)) {
            
        }
        else if (CheckException.TextException(data)) {
            await set('textContent')(data.text);
        }
        else ctx.reply("Извините, но такой тип сообщения я не понимаю, загрузите аудио/текст либо сразу фотографии продаваемого автомобиля");
    })
}