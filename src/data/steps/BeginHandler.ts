import { Message } from "../../base/types";
import { CheckException } from "../../base/check";
import { analyzeImages, transcribeAudio } from "../../base/gpt";
import Context from "telegraf/typings/context";

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
            await set('textContent')(trans || "");
            await ctx.reply("Отлично! Желаете загрузить фотографии (максимум 10)?", {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [{ text: 'Да' }, { text: 'Нет' }]
                    ]
                }
            })

            await set('state')('LoadMoreImages?');
        }
        else if (CheckException.AudioException(data)) {
            const trans = await transcribeAudio(data.audio);
            await set('textContent')(trans || "");
            await ctx.reply("Изумительно! Желаете загрузить фотографии (максимум 10)?", {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [{ text: 'Да' }, { text: 'Нет' }]
                    ]
                }
            })

            await set('state')('LoadMoreImages?');
        }
        else if (CheckException.PhotoException(data)) {
            const mediaGroupId = data.photo[2];

            if (!mediaGroupId) {
                await set('textContent')(data.photo[1] || "");
                await set('photos')(data.photo[0]);

                await ctx.reply(`Фотография успешно записана, вы можете загрузить ещё 9 фотографий, желаете загрузить ещё?`, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        keyboard: [
                            [{ text: 'Да' }, { text: 'Нет' }]
                        ]
                    }
                });

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
                            if (user['photos'].split(",").length){
                                await ctx.replyWithMediaGroup(images.map(item => item.fileId).map((item, index) => ({ 
                                    type: "photo", media: item, ...(index === 0 ? { caption: result, parse_mode: "HTML" } : {})
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
                            else await ctx.reply(`${result}\n\nПостить?`, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    keyboard: [
                                        [{ text: 'Да' }, { text: 'Нет' }]
                                    ]
                                }
                            });
    
                            await set('state')('PostHanlder');
                        }
                        else await ctx.reply("Ошибка обработки, нажмите старт чтобы попробовать снова");
                    }
                    else{
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${10 - images.length} фотографий, желаете загрузить ещё?`, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Да' }, { text: 'Нет' }]
                                ]
                            }
                        });

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
                        await ctx.reply(`!Фотографии успешно записаны, вы можете загрузить ещё ${10 - user['photos'].split(",").length} фотографий, желаете загрузить ещё?`, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Да' }, { text: 'Нет' }]
                                ]
                            }
                        });

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
            await set('textContent')(data.text);
            await ctx.reply("Восхитительно! Желаете загрузить фотографии (максимум 10)?", {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: [
                        [{ text: 'Да' }, { text: 'Нет' }]
                    ]
                }
            })

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
                const result = await analyzeImages(user['photos'].split(","), user['textContent']);
                if (result){
                    await set('finalResult')(result);

                    if (user['photos'].split(",").length){
                        await ctx.replyWithMediaGroup(user['photos'].split(",").map((item, index) => ({ 
                            type: "photo", media: item, ...(index === 0 ? { caption: result, parse_mode: "HTML" } : {})
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
                    else await ctx.reply(`${result}\n\nПостить?`, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [{ text: 'Да' }, { text: 'Нет' }]
                            ]
                        }
                    });

                    await set('state')('PostHanlder');
                }
                else ctx.reply(result || "Ошибка обработки, нажмите старт чтобы попробовать снова");

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

                        if (user['photos'].split(",").length){
                            await ctx.replyWithMediaGroup(user['photos'].split(",").map((item, index) => ({ 
                                type: "photo", media: item, ...(index === 0 ? { caption: result, parse_mode: "HTML" } : {})
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
                        else await ctx.reply(result, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Да' }, { text: 'Нет' }]
                                ]
                            }
                        });

                        await set('state')('PostHanlder');
                    }
                    else await ctx.reply(result || "Ошибка обработки, нажмите старт чтобы попробовать снова");
                }
                else if (images.length <= 8) {
                    await set('textContent')(user['textContent'].split(",").concat(data.photo[1] || "").join(","));
                    await set('photos')(user['photos'].split(",").concat(data.photo[0]).join(","));

                    await ctx.reply(`Вы можете загрузить ещё ${10 - (images.length + 1)} фотографий, желаете загрузить ещё?`, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [{ text: 'Да' }, { text: 'Нет' }]
                            ]
                        }
                    });

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

                            if (user['photos'].split(",").length){
                                await ctx.replyWithMediaGroup(user['photos'].split(",").map(item => ({ type: "photo", media: item, caption: result, parse_mode: 'HTML' })));
    
                                await ctx.reply("Постить?", {
                                    parse_mode: 'HTML',
                                    reply_markup: {
                                        keyboard: [
                                            [{ text: 'Да' }, { text: 'Нет' }]
                                        ]
                                    }
                                });
                            }
                            else await ctx.reply(`${result}\n\nПостить?`, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    keyboard: [
                                        [{ text: 'Да' }, { text: 'Нет' }]
                                    ]
                                }
                            });
    
                            await set('state')('PostHanlder');
                        }
                        else await ctx.reply("Ошибка обработки, нажмите старт чтобы попробовать снова");
                    }
                    else{
                        await ctx.reply(`Фотографии успешно записаны, вы можете загрузить ещё ${10 - (user['photos'].split(",").length + images.length)} фотографий, желаете загрузить ещё?`, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Да' }, { text: 'Нет' }]
                                ]
                            }
                        });

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
                        await ctx.reply(`1 Фотографии успешно записаны, вы можете загрузить ещё ${10 -user['photos'].split(",").length} фотографий, желаете загрузить ещё?`, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                keyboard: [
                                    [{ text: 'Да' }, { text: 'Нет' }]
                                ]
                            }
                        });
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
                if (user['photos']){
                    await ctx.telegram.sendMediaGroup(
                        "@test_channel_for_carposting",
                        user['photos'].split(",").map((item, index) => ({
                          type: "photo",
                          media: item,
                          ...(index === 0 ? {
                            caption: user['finalResult'],
                            parse_mode: "HTML"
                          } : {})
                        }))
                    );
                }
                else await ctx.telegram.sendMessage('@test_channel_for_carposting', user.finalResult, {parse_mode: 'HTML'});

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
}