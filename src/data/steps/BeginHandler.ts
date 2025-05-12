import { Message } from "../../base/types";
import { CheckException } from "../../base/check";
import { analyzeImages, transcribeAudio } from "../../base/gpt";
import Context from "telegraf/typings/context";
import keyboards from "../keyboards";
import UnknownFieldHandler from "../../base/unknownFieldHanlder";
import PostSummary, { result } from "../../base/postSummary";
import PostToWeb from "../../base/webposting";

const mediaGroupBuffer = new Map<
  string,
  {
    timeout?: NodeJS.Timeout;
    photos: Array<{ fileId: string }>;
    captions: Array<string>;
    ctx: Context;
  }
>();

export default async function BeginHandler(onTextMessage: Message, redis: any) {
    onTextMessage('BeginDataHandler', async (ctx, user, set, data) => {
        if (CheckException.VoiceException(data)) {
            const trans = await transcribeAudio(data.voice);
            await set('textAlreadyExists')('true');
            await set('textContent')(trans || "");
            await ctx.reply("Отлично! Желаете загрузить фотографии (максимум 10)?", keyboards.yesNo());

            await set('state')('LoadMoreImages?');
        }
        else if (CheckException.AudioException(data)) {
            const trans = await transcribeAudio(data.audio);
            await set('textAlreadyExists')('true');
            await set('textContent')(trans || "");
            await ctx.reply("Изумительно! Желаете загрузить фотографии (максимум 10)?", keyboards.yesNo());

            await set('state')('LoadMoreImages?');
        }
        else if (CheckException.PhotoException(data)) {
            const mediaGroupId = data.photo[2];

            if (!mediaGroupId) {
                await set('textContent')(data.photo[1] || "");
                await set('photos')(data.photo[0]);

                await ctx.reply(`Фотография успешно записана, вы можете загрузить ещё 9 фотографий, желаете загрузить ещё?`, keyboards.yesNo());

                await set('state')('LoadMoreImages?');
                return;
            }
            
            if (mediaGroupBuffer.has(mediaGroupId)) {
                const entry = mediaGroupBuffer.get(mediaGroupId)!;
                const photo = data.photo[0];

                if (user['photos'].split(",").length + entry.photos.length <= 9){
                    entry.photos.push({ fileId: photo });
                    entry.captions.push(data.photo[1] || "");
                } 

                const missedPhotos = user['photos'].split(",").length + entry.photos.length == 10;

                clearTimeout(entry.timeout);
                entry.timeout = setTimeout(async () => {
                    const images = entry.photos;
                    await set('textContent')(entry.captions.join(","));
                    await set('photos')(images.map(item => item.fileId).join(","));
                    if (missedPhotos){
                        await ctx.reply(`Фотографии успешно записаны, но не все, т.к. вы превысили лимит в 10 фотографий`);
                        const pre_mes = await ctx.reply('Обработка, пожалуйста, подождите...');
                        const result = await analyzeImages(images.map(item => item.fileId), entry.captions.join("\n"));
                        await ctx.deleteMessage(pre_mes.message_id);

                        if (result){
                            await set('finalResult')(result);
                                
                            const resultJSON = JSON.parse(result);
                            if (resultJSON.Unknown.length > 0) {
                                await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                                await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                                await set('state')('DetailFix');
                            }
                            else {
                                await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                                await PostSummary(user['photos'], set, ctx, result, { missedField: resultJSON.Unknown[0], value: data.text });
                            }
                        }
                        else await ctx.reply("Ошибка обработки, нажмите старт чтобы попробовать снова");
                    }
                    else{
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${10 - images.length} фотографий, желаете загрузить ещё?`, keyboards.yesNo());

                        await set('state')('LoadMoreImages?');
                    }
                    // const result = await analyzeImages(images.map(item => item.fileId), entry.captions.join("\n"));
                    // await entry.ctx.reply(result || "Error while processing photo group");
                    mediaGroupBuffer.delete(mediaGroupId);
                }, 1500);
            } else {
                const photo = data.photo[0];
                const timeout = setTimeout(async () => {
                    const entry = mediaGroupBuffer.get(mediaGroupId);
                    if (entry) {
                        await set('textContent')(entry.captions.join(","));
                        await set('photos')(entry.photos.map(item => item.fileId).join(","));
                        await ctx.reply(`!Фотографии успешно записаны, вы можете загрузить ещё ${10 - user['photos'].split(",").length} фотографий, желаете загрузить ещё?`, keyboards.yesNo());

                        await set('state')('LoadMoreImages?');
                        // const result = await analyzeImages(entry.photos.map(item => item.fileId), entry.captions.join("\n"));
                        // await entry.ctx.reply(result || "Error while processing photo group");
                        mediaGroupBuffer.delete(mediaGroupId);
                    }
                }, 1500);
            
                mediaGroupBuffer.set(mediaGroupId, {
                    photos: [{ fileId: photo }],
                    timeout,
                    captions: [data.photo[1] || ""],
                    ctx
                });
            }
        }
        else if (CheckException.TextException(data)) {
            await set('textAlreadyExists')('true');
            await set('textContent')(data.text);
            await ctx.reply("Восхитительно! Желаете загрузить фотографии (максимум 10)?", keyboards.yesNo());

            await set('state')('LoadMoreImages?');
        }
        else ctx.reply("Извините, но такой тип сообщения я не понимаю, загрузите аудио/текст либо сразу фотографии продаваемого автомобиля");
    })

    onTextMessage('LoadMoreImages?', async (ctx, user, set, data) => {
        switch (data.text) {
            case 'Да':
                await ctx.reply(`Отлично, загружайте!`);
                await set('state')('LoadMoreImages');
                break;
            case 'Нет':
                const pre_mes = await ctx.reply(`Хорошо, записали, обрабатываем...`);

                if (user['textAlreadyExists'] === 'true'){
                    const result = await analyzeImages(user['photos'].split(","), user['textContent']);
                    
                    if (result){
                        await set('finalResult')(result);
                        
                        const resultJSON = JSON.parse(result);
                        if (resultJSON.Unknown.length > 0) {
                            await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                            await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                            await set('state')('DetailFix');
                        }
                        else {
                            await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                            await PostSummary(user['photos'], set, ctx, result, { missedField: resultJSON.Unknown[0], value: data.text });
                        }
                    }
                    else await ctx.reply("Извините, но произошла ошибка, попробуйте ещё раз сначала");
                }
                else {
                    await ctx.reply("Желаете добавить/дополнить детали?", keyboards.yesNo());
                    await set('state')('AddDetails?');
                }
                // const result = await analyzeImages(user['photos'].split(","), user['textContent']);
                // if (result){
                //     await set('finalResult')(result);

                //     if (user['photos'].split(",").length){
                //         await ctx.replyWithMediaGroup(user['photos'].split(",").map((item, index) => ({ 
                //             type: "photo", media: item, ...(index === 0 ? { caption: result, parse_mode: "HTML" } : {})
                //         })));
    
                //         await ctx.reply("Постить?", {
                //             parse_mode: 'HTML',
                //             reply_markup: {
                //                 keyboard: [
                //                     [{ text: 'Да' }, { text: 'Нет' }]
                //                 ]
                //             }
                //         });
                //     }
                //     else await ctx.reply(`${result}\n\nПостить?`, {
                //         parse_mode: 'HTML',
                //         reply_markup: {
                //             keyboard: [
                //                 [{ text: 'Да' }, { text: 'Нет' }]
                //             ]
                //         }
                //     });

                //     await set('state')('PostHanlder');
                // }
                // else ctx.reply(result || "Ошибка обработки, нажмите старт чтобы попробовать снова");

                await ctx.deleteMessage(pre_mes.message_id);

                break;

            default:
                await ctx.reply(`Вам нужно выбрать одну из кнопок, прежде чем продолжить`);
        }
    })

    onTextMessage('LoadMoreImages', async (ctx, user, set, data) => {
        if (CheckException.PhotoException(data)) {
            const mediaGroupId = data.photo[2];

            if (!mediaGroupId) {
                const images = user['photos'].split(",");

                if (images.length > 10) {
                    await ctx.reply("Вы не можете загрузить еще фотографии, т.к. вы достигли лимита в 10 фотографий");
                }
                else if (images.length == 9) {
                    await set('textContent')(user['textContent'].split(",").concat(data.photo[1] || "").join(","));
                    await set('photos')(user['photos'].split(",").concat(data.photo[0]).join(","));

                    const pre_mes = await ctx.reply("Отлично, все доступные фотографии собраны, теперь подтвердите постинг, обработка...");
                    const result = await analyzeImages(user['photos'].split(",").concat(data.photo[0]), user['textContent'].split(",").concat(data.photo[1] || "").join(","));
                    await ctx.deleteMessage(pre_mes.message_id);

                    if (result){
                        await set('finalResult')(result);
                            
                        const resultJSON = JSON.parse(result);
                        if (resultJSON.Unknown.length > 0) {
                            await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                            await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                            await set('state')('DetailFix');
                        }
                        else {
                            await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                            await PostSummary(user['photos'], set, ctx, result, { missedField: resultJSON.Unknown[0], value: data.text });
                        }
                    }
                    else await ctx.reply("Ошибка обработки, нажмите /start чтобы попробовать снова");
                }
                else if (images.length <= 8) {
                    await set('textContent')(user['textContent'].split(",").concat(data.photo[1] || "").join(","));
                    await set('photos')(user['photos'].split(",").concat(data.photo[0]).join(","));

                    await ctx.reply(`Вы можете загрузить ещё ${10 - images.length} фотографий, желаете загрузить ещё?`, keyboards.yesNo());

                    await set('state')('LoadMoreImages?');
                }

                return;
            }
            
            if (mediaGroupBuffer.has(mediaGroupId)) {
                const entry = mediaGroupBuffer.get(mediaGroupId)!;
                const images = entry.photos;
                const photo = data.photo[0];

                if (user['photos'].split(",").length + images.length <= 9) {
                    entry.photos.push({ fileId: photo });
                    entry.captions.push(data.photo[1] || "");
                }

                const missedPhotos = user['photos'].split(",").length + images.length == 10;

                clearTimeout(entry.timeout);
                entry.timeout = setTimeout(async () => {
                    await set('textContent')(user['textContent'].split(",").concat(entry.captions).join(","));
                    await set('photos')(user['photos'].split(",").concat(images.map(item => item.fileId)).join(","));
                    if (missedPhotos){
                        await ctx.reply(`Фотографии успешно записаны, но не все, т.к. вы превысили лимит в 10 фотографий`);
                        const pre_mes = await ctx.reply('Обработка, пожалуйста, подождите...');
                        const result = await analyzeImages(images.map(item => item.fileId), entry.captions.join("\n"));
                        await ctx.deleteMessage(pre_mes.message_id);

                        if (result){
                            await set('finalResult')(result);
                                
                            const resultJSON = JSON.parse(result);
                            if (resultJSON.Unknown.length > 0) {
                                await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                                await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                                await set('state')('DetailFix');
                            }
                            else {
                                await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                                await PostSummary(user['photos'], set, ctx, result, { missedField: resultJSON.Unknown[0], value: data.text });
                            }
                        }
                        else await ctx.reply("Ошибка обработки, нажмите старт чтобы попробовать снова");
                    }
                    else{
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${10 - (user['photos'].split(",").filter(item => item !== "").length + images.length)} фотографий, желаете загрузить ещё?`, keyboards.yesNo()); // ${10 - (user['photos'].split(",").length + images.length)} фотографий, желаете загрузить ещё?`, keyboards.yesNo());

                        await set('state')('LoadMoreImages?');
                    }
                    // const result = await analyzeImages(images.map(item => item.fileId), entry.captions.join("\n"));
                    // await entry.ctx.reply(result || "Error while processing photo group");
                    mediaGroupBuffer.delete(mediaGroupId);
                }, 1500);
            } else {
                const photo = data.photo[0];
                const timeout = setTimeout(async () => {
                    const entry = mediaGroupBuffer.get(mediaGroupId);
                    if (entry) {
                        await set('textContent')(user['textContent'].split(",").concat(entry.captions).join(",") || entry.captions.join(","));
                        await set('photos')(user['photos'].split(",").concat(entry.photos.map(item => item.fileId)).join(",") || entry.photos.map(item => item.fileId).join(","));
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${10 - user['photos'].split(",").filter(item => item !== "").length + entry.photos.length} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                        // const result = await analyzeImages(entry.photos.map(item => item.fileId), entry.captions.join("\n"));
                        // await entry.ctx.reply(result || "Error while processing photo group");
                        mediaGroupBuffer.delete(mediaGroupId);
                        await set('state')('LoadMoreImages?');
                    }
                }, 1500);
            
                mediaGroupBuffer.set(mediaGroupId, {
                    photos: [{ fileId: photo }],
                    timeout,
                    captions: [data.photo[1] || ""],
                    ctx
                });
            }
        }
    })

    onTextMessage('PostHanlder', async (ctx, user, set, data) => {
        switch (data.text) {
            case "Да":
                const dataToPost = JSON.parse(user['finalResult']),
                    dataTP = dataToPost.Valid;
                if (user['photos']){
                    await ctx.telegram.sendMediaGroup(
                        "@test_channel_for_carposting",
                        user['photos'].split(",").filter(item => item !== "").map((item, index) => ({
                          type: "photo",
                          media: item,
                          ...(index === 0 ? {
                            caption: result(user['finalResult'], { missedField: "", value: user['textContent'] }),
                            parse_mode: "HTML"
                          } : {})
                        }))
                    );
                }
                else await ctx.telegram.sendMessage('@test_channel_for_carposting', user.finalResult, {parse_mode: 'HTML'});

                await PostToWeb({
                    photos: user['photos'].split(",").filter(item => item !== ""),
                    "Body type": dataTP["Body type"],
                    "Fuel type": dataTP["Fuel type"],
                    "Transmission": dataTP["Transmission"],
                    Year: dataTP.Year,
                    Mileage: dataTP.Mileage,
                    Price: dataTP.Price,
                    Make: dataTP.Make,
                    Model: dataTP.Model,
                    Trim: dataTP.Trim
                })

                await set('photos')('');
                await set('textContent')('');
                await set('finalResult')('');

                await ctx.reply("Благодарим за использование, чтобы воспользоваться вновь - нажмите /start");
                break;

            case "Нет":
                ctx.reply("Очень жаль слышать подобное, но если вы захотите попробовать ещё раз запостить новый пост нажмите /start");
                await set('photos')('');
                await set('textContent')('');
                await set('finalResult')('');
                break;

            default:
                ctx.reply("Вам нужно нажать на одну из кнопок ниже для продолжения");
                break;
        }
    });

    onTextMessage('AddDetails?', async (ctx, user, set, data) => {
        switch (data.text) {
            case "Да":
                await ctx.reply("Отлично! Вы пишите либо записываете голосовое, мы записываем.");
                await set('state')('AddDetails');
                break;
            case "Нет":
                const pre_mes = await ctx.reply("Окей, идёт обработка, пожалуйста подождите...");
                const result = await analyzeImages(user['photos'].split(","), user['textContent']);
                
                if (result){
                    await set('finalResult')(result);
                    
                    const resultJSON = JSON.parse(result);
                    if (resultJSON.Unknown.length > 0) {
                        await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                        await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                        await set('state')('DetailFix');
                    }
                    else {
                        await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                        await PostSummary(user['photos'], set, ctx, result, { missedField: resultJSON.Unknown[0], value: data.text });
                    }
                }
                else await ctx.reply("Извините, но произошла ошибка, попробуйте ещё раз сначала");

                await ctx.deleteMessage(pre_mes.message_id);

                break;
            default:
                ctx.reply("Вам нужно нажать на одну из кнопок ниже для продолжения");
                break;
        }
    })

    onTextMessage('AddDetails', async (ctx, user, set, data) => {
        if (CheckException.TextException(data)) {
            await set('textContent')(user['textContent'].split(",").concat(data.text).join(",") || data.text);

            await ctx.reply("Так... замечательно! Записали. Возможно что-то ещё?", keyboards.yesNo());
            await set('state')('AddDetails?');
        }
        else if (CheckException.VoiceException(data)) {
            const trans = await transcribeAudio(data.voice);
            if (trans){
                await set('textContent')(user['textContent'].split(",").concat(trans).join(",") || trans);
    
                await ctx.reply("Так... замечательно! Записали. Возможно что-то ещё?", keyboards.yesNo());
                await set('state')('AddDetails?');
            }
            else ctx.reply("Приносим свои извинения, возникла ошибка при обработке, попробуйте ещё раз!");
        }
        else if (CheckException.AudioException(data)) {
            const trans = await transcribeAudio(data.audio);
            if (trans){
                await set('textContent')(user['textContent'].split(",").concat(trans).join(",") || trans);
    
                await ctx.reply("Так... замечательно! Записали. Возможно что-то ещё?", keyboards.yesNo());
                await set('state')('AddDetails?');
            }
            else ctx.reply("Приносим свои извинения, возникла ошибка при обработке, попробуйте ещё раз!");
        }
        else ctx.reply("Ой... здесь нужно именно писать либо записывать голосовое, вы скорее всего ошиблись. Попробуйте снова!")
    })

    onTextMessage('DetailFix', async (ctx, user, set, data) => {
        if (CheckException.TextException(data)) {
            const resultJSON = JSON.parse(user['finalResult']);

            if (resultJSON.Unknown.length > 0) {
                await UnknownFieldHandler(set, user['finalResult'], resultJSON.Unknown[0], data.text);
                
                if (resultJSON.Unknown[1] !== undefined) {
                    await ctx.reply(`Окей, прекрасно, теперь пожалуйста, напишите значение для поля "${resultJSON.Unknown[1]}"`);
                    await set('state')('DetailFix');
                }
                else{
                    await ctx.reply("Отлично, теперь все поля заполнены! Теперь подтврдите постинг");
                    await PostSummary(user['photos'], set, ctx, user['finalResult'], { missedField: resultJSON.Unknown[0], value: data.text });
                }
            }
            else {
                await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                await PostSummary(user['photos'], set, ctx, user['finalResult'], { missedField: resultJSON.Unknown[0], value: data.text });
            }
        }
        else ctx.reply("Извините, но здесь можно только текстом, воизбежание ошибок");
    })
}