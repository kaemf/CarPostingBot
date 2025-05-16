import { Message } from "../../base/types";
import { CheckException } from "../../base/check";
import { analyzeImages, transcribeAudio } from "../../base/gpt";
import Context from "telegraf/typings/context";
import keyboards from "../keyboards";
import UnknownFieldHandler from "../../base/unknownFieldHanlder";
import PostSummary from "../../base/postSummary";
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
            const photo = data.photo[0];
            const caption = data.photo[1] || "";
    
            const getCleanPhotos = (photos: string) =>
                photos.split(",").filter((item: string) => item !== "");
    
            const redisPhotos = getCleanPhotos(user['photos']);
            const redisPhotosCount = redisPhotos.length;
    
            const allBufferPhotos = Array.from(mediaGroupBuffer.values()).flatMap(e => e.photos);
            const allBufferCount = allBufferPhotos.length;
    
            const totalPhotoCount = redisPhotosCount + allBufferCount;

            if (!mediaGroupId) {
                await set('textContent')(caption);
                await set('photos')(photo);

                await ctx.reply(
                    `Фотография успешно записана, вы можете загрузить ещё 9 фотографий, желаете загрузить ещё?`,
                    keyboards.yesNo()
                );

                return await set('state')('LoadMoreImages?');
            }

            if (mediaGroupBuffer.has(mediaGroupId)) {
                const entry = mediaGroupBuffer.get(mediaGroupId)!;
    
                if (totalPhotoCount < 10) {
                    entry.photos.push({ fileId: photo });
                    entry.captions.push(caption);
                }
    
                clearTimeout(entry.timeout);
                entry.timeout = setTimeout(async () => {
                    const finalRedisPhotos = getCleanPhotos(await redis.get(ctx.chat?.id ?? -1)('photos'));
                    const finalPhotos = finalRedisPhotos.concat(entry.photos.map(p => p.fileId));
                    const finalCaptions = user['textContent'].split(",").concat(entry.captions);
    
                    await set('textContent')(finalCaptions.join(","));
                    await set('photos')(finalPhotos.join(","));
    
                    const total = finalPhotos.length;
                    const remaining = Math.max(0, 10 - total);
    
                    if (total == 10) {
                        await ctx.reply(`Фотографии успешно записаны, но возможно не все, т.к. вы превысили лимит в 10 фотографий`);
                        await ctx.reply("Желаете добавить/дополнить детали?", keyboards.yesNo());
                        await set("state")("AddDetails?");
                    } else if (total < 10) {
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${remaining} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                        await set("state")("LoadMoreImages?");
                    }
    
                    mediaGroupBuffer.clear();
                }, 1500);
            } else {
                if (totalPhotoCount < 10) {
                    const timeout = setTimeout(async () => {
                        const entry = mediaGroupBuffer.get(mediaGroupId);
                        if (entry) {
                            const redisPhotosFinal = getCleanPhotos(user['photos']);
                            const newPhotos = redisPhotosFinal.concat(entry.photos.map(p => p.fileId));
                            const remaining = Math.max(0, 10 - newPhotos.length);
        
                            await set('textContent')(
                                user['textContent'].split(",").concat(entry.captions).join(",")
                            );
                            await set('photos')(
                                user['photos'].split(",").concat(entry.photos.map(p => p.fileId)).join(",")
                            );
        
                            await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${remaining} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                            await set('state')('LoadMoreImages?');
                            mediaGroupBuffer.clear();
                        }
                    }, 1500);
        
                    mediaGroupBuffer.set(mediaGroupId, {
                        photos: [{ fileId: photo }],
                        timeout,
                        captions: [caption],
                        ctx
                    });
                }
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
                if (!user['photos'].split(",").filter(item => item !== "").length){
                    await ctx.reply('О как. Вы не загрузили ни одну фотографию, у нас так не принято, поэтому... если что максимум 10');
                    await set('state')('LoadMoreImages');
                }
                else{
                    const pre_mes = await ctx.reply(`Хорошо, записали, обрабатываем...`);
    
                    if (user['textAlreadyExists'] === 'true'){
                        const result = await analyzeImages(user['photos'].split(",").filter(item => item !== ""), user['textContent']);
                        
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

                    await ctx.deleteMessage(pre_mes.message_id);
                }

                break;

            default:
                await ctx.reply(`Вам нужно выбрать одну из кнопок, прежде чем продолжить`);
        }
    })

    onTextMessage('LoadMoreImages', async (ctx, user, set, data) => {
        if (CheckException.PhotoException(data)){
            const mediaGroupId = data.photo[2];
            const photo = data.photo[0];
            const caption = data.photo[1] || "";
    
            const getCleanPhotos = (photos: string) =>
                photos.split(",").filter((item: string) => item !== "");
    
            const redisPhotos = getCleanPhotos(user['photos']);
            const redisPhotosCount = redisPhotos.length;
    
            const allBufferPhotos = Array.from(mediaGroupBuffer.values()).flatMap(e => e.photos);
            const allBufferCount = allBufferPhotos.length;
    
            const totalPhotoCount = redisPhotosCount + allBufferCount;
    
            if (!mediaGroupId) {
                if (redisPhotosCount >= 10) {
                    return await ctx.reply("Вы не можете загрузить еще фотографии, т.к. вы достигли лимита в 10 фотографий");
                }
    
                await set('textContent')(
                    user['textContent'].split(",").concat(caption).join(",")
                );
                await set('photos')(
                    user['photos'].split(",").concat(photo).join(",")
                );
    
                const updatedPhotos = getCleanPhotos(user['photos']).concat([photo]);
    
                if (updatedPhotos.length === 10) {
                    if (user['textAlreadyExists'] === 'true') {
                        const result = await analyzeImages(updatedPhotos, user['textContent']);
                        if (result) {
                            await set('finalResult')(result);
                            const resultJSON = JSON.parse(result);
                            if (resultJSON.Unknown.length > 0) {
                                await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                                await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                                return await set('state')('DetailFix');
                            } else {
                                await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                                return await PostSummary(updatedPhotos.join(","), set, ctx, result, {
                                    missedField: "",
                                    value: data.text
                                });
                            }
                        } else {
                            return await ctx.reply("Извините, но произошла ошибка, попробуйте ещё раз сначала");
                        }
                    } else {
                        await ctx.reply("Желаете добавить/дополнить детали?", keyboards.yesNo());
                        return await set('state')('AddDetails?');
                    }
                } else {
                    const remaining = 10 - updatedPhotos.length;
                    await ctx.reply(`Вы можете загрузить ещё ${remaining} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                    return await set('state')('LoadMoreImages?');
                }
            }
    
            if (mediaGroupBuffer.has(mediaGroupId)) {
                const entry = mediaGroupBuffer.get(mediaGroupId)!;
    
                if (totalPhotoCount < 10) {
                    entry.photos.push({ fileId: photo });
                    entry.captions.push(caption);
                }
    
                clearTimeout(entry.timeout);
                entry.timeout = setTimeout(async () => {
                    const finalRedisPhotos = getCleanPhotos(await redis.get(ctx.chat?.id ?? -1)('photos'));
                    const finalPhotos = finalRedisPhotos.concat(entry.photos.map(p => p.fileId));
                    const finalCaptions = user['textContent'].split(",").concat(entry.captions);
    
                    await set('textContent')(finalCaptions.join(","));
                    await set('photos')(finalPhotos.join(","));
    
                    const total = finalPhotos.length;
                    const remaining = Math.max(0, 10 - total);
    
                    if (total == 10) {
                        await ctx.reply(`Фотографии успешно записаны, но возможно не все, т.к. вы превысили лимит в 10 фотографий`);
                        if (user['textAlreadyExists'] === 'true') {
                            const result = await analyzeImages(finalPhotos, user['textContent']);
                            if (result) {
                                await set('finalResult')(result);
                                const resultJSON = JSON.parse(result);
                                if (resultJSON.Unknown.length > 0) {
                                    await ctx.reply("Ну... как всегда без чуда, есть детали, которые вам нужно вручную заполнить, ну что же, давайте начнем.");
                                    await ctx.reply(`Пожалуйста, напишите значение для поля "${resultJSON.Unknown[0]}"`);
                                    return await set('state')('DetailFix');
                                } else {
                                    await ctx.reply("Крайне удивительно, вам очень повезло! Все поля заполнены! Теперь подтврдите постинг");
                                    return await PostSummary(finalPhotos.join(","), set, ctx, result, {
                                        missedField: "",
                                        value: data.text
                                    });
                                }
                            } else {
                                return await ctx.reply("Извините, но произошла ошибка, попробуйте ещё раз сначала");
                            }
                        } else {
                            await ctx.reply("Желаете добавить/дополнить детали?", keyboards.yesNo());
                            return await set('state')('AddDetails?');
                        }
                    } else if (total < 10) {
                        await ctx.reply(`(${total})Фотографии успешно записаны, вы можете загрузить ещё ${remaining} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                        await set('state')('LoadMoreImages?');
                    }
    
                    mediaGroupBuffer.clear();
                }, 1500);
            } else {
                const timeout = setTimeout(async () => {
                    const entry = mediaGroupBuffer.get(mediaGroupId);
                    if (entry) {
                        const redisPhotosFinal = getCleanPhotos(user['photos']);
                        const newPhotos = redisPhotosFinal.concat(entry.photos.map(p => p.fileId));
                        const remaining = Math.max(0, 10 - newPhotos.length);
    
                        await set('textContent')(
                            user['textContent'].split(",").concat(entry.captions).join(",")
                        );
                        await set('photos')(
                            user['photos'].split(",").concat(entry.photos.map(p => p.fileId)).join(",")
                        );
    
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${remaining} фотографий, желаете загрузить ещё?`, keyboards.yesNo());
                        await set('state')('LoadMoreImages?');
                        mediaGroupBuffer.clear();
                    }
                }, 1500);
    
                mediaGroupBuffer.set(mediaGroupId, {
                    photos: [{ fileId: photo }],
                    timeout,
                    captions: [caption],
                    ctx
                });
            }
        }
        else ctx.reply("Извините, но произошла ошибка, здесь нужно грузить изображения, а не вот, да...")
    });

    onTextMessage('PostHanlder', async (ctx, user, set, data) => {
        switch (data.text) {
            case "Да":
                const dataToPost = JSON.parse(await redis.get(ctx.chat?.id ?? -1)('finalResult')),
                    dataTP = dataToPost.Valid;
                // if (user['photos']){
                //     await ctx.telegram.sendMediaGroup(
                //         "@test_channel_for_carposting",
                //         user['photos'].split(",").filter(item => item !== "").map((item, index) => ({
                //           type: "photo",
                //           media: item,
                //           ...(index === 0 ? {
                //             caption: result(user['finalResult'], { missedField: "", value: user['textContent'] }),
                //             parse_mode: "HTML"
                //           } : {})
                //         }))
                //     );
                // }
                // else await ctx.telegram.sendMessage('@test_channel_for_carposting', user.finalResult, {parse_mode: 'HTML'});

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