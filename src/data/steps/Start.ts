import { Context, Telegraf } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram"
import keyboards from "../keyboards";

export default async function Start(bot: Telegraf<Context<Update>>, db: any) {
  bot.start(async (ctx) => {
    console.log('\n\nBOT STARTED (Pressed /start button)');

    const username = ctx.chat.type === "private" ? ctx.chat.username ?? null : null;
    await db.set(ctx.chat.id)('username')(username ?? 'unknown');
    await db.set(ctx.chat.id)('id')(ctx.chat.id.toString());

    await ctx.reply("Здравствуйте, загрузите аудио/текст либо сразу фотографии продаваемого автомобиля")
    await db.set(ctx.chat.id)('state')('BeginDataHandler');
  });
}