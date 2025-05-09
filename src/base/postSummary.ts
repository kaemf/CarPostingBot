import Context from "telegraf/typings/context";
import { Update } from "telegraf/typings/core/types/typegram";

export function result(finalJSONString: string, additional: { missedField: string, value: string }): string{
    const _data = JSON.parse(finalJSONString),
        data = _data.Valid;

    return `FOR SALE: ${data.Year ?? additional.value} ${data.Make ?? additional.value} ${data.Model ?? additional.value} ${data.Trim ?? additional.value}\n
Body type: ${data["Body type"] ?? additional.value}
Year: ${data.Year ?? additional.value}
Mileage: ${data.Mileage ?? additional.value}
Price: ${data.Price ?? additional.value}
Make: ${data.Make ?? additional.value}
Model: ${data.Model ?? additional.value}
Trim: ${data.Trim ?? additional.value}
Fuel type: ${data["Fuel type"] ?? additional.value}
Exterior Colour: ${data["Exterior Colour"] ?? additional.value}
Transmission: ${data.Transmission ?? additional.value}`
}

export default async function PostSummary(photos: string, set: any, ctx: Context<Update>, finalJSONString: string, additional: { missedField: string, value: string }) {
    const photosArray = photos.split(",").filter((item) => item !== "");

    if (photosArray.length){
        await ctx.replyWithMediaGroup(photosArray.map((item, index) => ({ 
            type: "photo", media: item, ...(index === 0 ? { caption: result(finalJSONString, additional), parse_mode: "HTML" } : {})
        })));

        await ctx.reply("Постить?", {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: 'Да' }, { text: 'Нет' }]
                ]
            }
        });
    }
    else await ctx.reply(`${result(finalJSONString, additional)}\n\nПостить?`, {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: [
                [{ text: 'Да' }, { text: 'Нет' }]
            ]
        }
    });

    await set('state')('PostHanlder');
}