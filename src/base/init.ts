// CarPostingBot
// Developed by Yaroslav Volkivskyi (TheLaidSon)

// Initialization File

import { Telegraf } from "telegraf";
import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

export default async function init() {
  console.log(`\n\n  Car Posting Bot v1.0\n\n   Developed by Yaroslav Volkivskyi (TheLaidSon)\n\n`)
  console.log("Creating redis client...");
  const redis = createClient({url: process.env.REDIS_URL});
  redis.on("error", (err) => console.log("Redis Client Error", err));
  console.log("Done");

  console.log("Connecting to redis server...");
  await redis.connect();
  console.log("Done");

  console.log("Creating telegraf bot instanse...");
  const bot = new Telegraf(process.env.TOKEN ?? '');
  console.log("Done");

  bot.use(async (ctx, next) => {
    const originalReply = ctx.reply;

    ctx.reply = async (text: string, extra?: any) => {
      let finalExtra = { ...extra, parse_mode: 'HTML' };
      if (!extra?.reply_markup) {
        finalExtra.reply_markup = { remove_keyboard: true };
      }
      else if (extra && extra.reply_markup) {
        finalExtra.reply_markup = {...extra.reply_markup, resize_keyboard: true};
      }
      return originalReply.call(ctx, text, finalExtra);
    };

    await next();
  })

  const RedisDataBaseName = process.env.REDIS_DATABASE_NAME;

  if (!RedisDataBaseName) throw new Error("REDIS_DATABASE_NAME is not defined");

  // wrap redis with helper functions
  const wRedis = ({
    getAll: (id: number) => async () => redis.hGetAll(`${RedisDataBaseName}_${id}`),
    getAllKeys: async () => redis.keys(`${RedisDataBaseName}_*`),
    get: (id: number) => async (property: string) => await redis.hGet(`${RedisDataBaseName}_${id}`, property),
    set: (id: number) => (property: string) => async (new_value: string) => await redis.hSet(`${RedisDataBaseName}_${id}`, property, new_value)
  })

  return [bot, wRedis] as const;
}