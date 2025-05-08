import init from './init'
import { Context } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram";
import { UserScriptState } from "../data/UserScriptState";
import Operation from './operation';
type ActionType<T> = (ctx: Context<Update>, user: {[x: string]: string}, set: (key: string) => (value: string) => Promise<number>, additionalData: T) => void;

export default async function arch() {
  const [ bot, db] = await init();
  
  const onTextMessage = (startState: UserScriptState, action: ActionType<Operation>) => 
  bot.on('message', async (ctx, next) => {
    const id = ctx.chat.id,
      user = (await db.getAll(id)()),
      set = db.set(id),
      message = ctx.message;
      
    if (user.state === startState) {
      if ('text' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: message.text, photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`\nTYPE: ONTEXTMESSAGE, OTHERDATA = UNDEFINED, TEXT = ${message.text}, CODE: 1\nstate: ${startState}, message: ${message.text}`);
      }
      else if ('contact' in message){
        action(ctx, user, set, { phone_number: [ message.contact.phone_number, message.contact.first_name ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`\nTYPE: ONTEXTMESSAGE, NUMBER&TEXT = UNDEFINED, NUMBER GET = ${message.contact.phone_number} by ${message.contact.first_name}, CODE: 0\nstate: ${startState}, message: ${message.contact.phone_number}`);
      }
      else if ('photo' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ message.photo.at(-1)!.file_id, message?.caption ?? '', message?.media_group_id ?? '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`(!)TYPE: ONTEXTMESSAGE, NUMBER&TEXT = UNDEFINED, PHOTO GET, CODE: 2\n`);
      }
      else if ('document' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ message.document.file_id, message?.caption ?? ''], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`(!)TYPE: ONTEXTMESSAGE, NUMBER&TEXT = UNDEFINED, FILE GET, CODE: 3\n`);
      }
      else if ('sticker' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: message.sticker.file_id, video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`(!)TYPE: ONTEXTMESSAGE, NUMBER&TEXT = UNDEFINED, STICKER GET, CODE: 4\n`);
      }
      else if ('video' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ message.video.file_id, message?.caption ?? '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`(!)TYPE: ONTEXTMESSAGE, NUMBER&TEXT = UNDEFINED, VIDEO GET, CODE: 5\n`);
      }
      else if ('location' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ message.location.latitude, message.location.longitude ], polls: '', voice: '', audio: '', video_circle: '' });
        console.log(`\n(!)TYPE: ONCONTACTMESSAGE, NUMBER&TEXT = UNDEFINED, LOCATION GET, CODE: 6\n`);
      }
      else if ('poll' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: message.poll.question, voice: '', audio: '', video_circle: '' });
        console.log(`\n(!)TYPE: ONCONTACTMESSAGE, NUMBER&TEXT = UNDEFINED, POLL GET, CODE: 7\n`);
      }
      else if ('voice' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: message.voice.file_id, audio: '', video_circle: '' });
        console.log(`\n(!)TYPE: ONCONTACTMESSAGE, NUMBER&TEXT = UNDEFINED, VOICE GET, CODE: 8\n`);
      }
      else if ('audio' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: message.audio.file_id, video_circle: '' });
        console.log(`\n(!)TYPE: ONCONTACTMESSAGE, NUMBER&TEXT = UNDEFINED, AUDIO GET, CODE: 9\n`);
      }
      else if ('video_note' in message) {
        action(ctx, user, set, { phone_number: [ '' ], text: '', photo: [ '' ], file: [ '' ], stickers: '', video: [ '' ], location: [ -1 ], polls: '', voice: '', audio: '', video_circle: message.video_note.file_id });
        console.log(`\n(!)TYPE: ONCONTACTMESSAGE, NUMBER&TEXT = UNDEFINED, CIRCLE VIDEO GET, CODE: 10\n`);
      }
    }
    else return next();
    console.log('[@', user['username'], '], ', '( id:', id, ')', '( state:', user['state'], ')', user);
  });

  return [onTextMessage, bot, db] as const;
}