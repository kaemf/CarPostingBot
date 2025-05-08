import { OpenAI } from 'openai';
import axios from "axios";
import FormData from "form-data";
import fs, { createWriteStream } from 'fs';
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TOKEN;

const client = new OpenAI({ apiKey: process.env.GPT });

function prompt(question?: string){
  return `Ты ассистент, который дает структурированную информацию для постинга продаж автомобилей, твоя задача с полученых изображений и текста пользователя
  составить строго следующий текст, без лишних слов и предложений (это пример):
  "FOR SALE: 2026 CADILLAC VISTIQ SPORT (Electric)
  
  ODOMETR: 8km
  
  PRICE: $97,300 plus taxes"
  
  Также ты должен учитывать язык на котором пишет пользователь и дать этот ответ в том же языке.

  Если нету текста пользователя, опирайся только на изображения. Если нету изображений, то опирайся только на тексте пользователя.
  Если некоторых данных нету ни на изображении, ни в тексте, просто не давай эту информацию, либо оставь в самом конце отметку каких данных нет.
  
  Текст пользователя: ${question ?? ''}`
}

function parseHtmlToText(html: string): string {
  let text = html;

  text = text.replace(/<\/?[^>]+(>|$)/g, "");

  text = text.replace(/<br\s*\/?>/g, "\n");

  text = text.replace(/<b>|<strong>/g, "**");
  text = text.replace(/<\/b>|<\/strong>/g, "**");

  text = text.replace(/<i>|<em>/g, "*");
  text = text.replace(/<\/i>|<\/em>/g, "*");

  text = text.replace(/<a\s+href="([^"]+)">([^<]+)<\/a>/g, "[$2]($1)");

  text = text.replace(/<ul>|<ol>/g, "");
  text = text.replace(/<\/ul>|<\/ol>/g, "");
  text = text.replace(/<li>/g, "- ");
  
  return text;
}


export async function downloadTelegramFile(fileId: string, saveDir = "temp"): Promise<string> {
    const fileInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileInfo.data.result.file_path;

    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    const fileName = path.basename(filePath);
    const localFilePath = path.join(saveDir, fileName);

    fs.mkdirSync(saveDir, { recursive: true });

    const response = await axios.get(downloadUrl, { responseType: "stream" });
    const writer = createWriteStream(localFilePath);

    await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    return localFilePath;
}


export async function transcribeAudio(audioId: string): Promise<string | null> {
    try {
        const audioUrl = await downloadTelegramFile(audioId),
            audio = fs.createReadStream(audioUrl),

        formData = new FormData();
        formData.append("file", audio, "audio.ogg");
        formData.append("model", "whisper-1");

        const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", formData, {
            headers: {
            Authorization: `Bearer ${process.env.GPT}`,
            ...formData.getHeaders(),
            },
        });

        fs.unlink(audioUrl, (err) => {
            if (err) {
                console.error(`Error deleting file: ${err}`);
            } else {
                console.log(`File ${audioUrl} deleted.`);
            }
        });

        return response.data.text;
  } catch (error: any) {
    console.error("Error while transcribing audio:", error);
    return null;
  }
}

export async function analyzeImages(fileIds: string[], question?: string): Promise<string | null> {
    try {
      const filePaths = await Promise.all(fileIds.map(item =>downloadTelegramFile(item)));

      if (filePaths.length > 20) {
        throw new Error("Можно отправить максимум 20 изображений за раз.");
      }
  
      const imageContents = filePaths.map((path) => {
        const base64 = fs.readFileSync(path, { encoding: "base64" });
        const mimeType = path.endsWith(".png") ? "image/png" : "image/jpeg";
        return {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
          },
        };
      });
  
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: prompt(question) },
            ...imageContents,
          ],
        },
      ];
  
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages,
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GPT}`,
            "Content-Type": "application/json",
          },
        }
      );

      filePaths.forEach((path) => {
        fs.unlink(path, (err) => {
          if (err) {
            console.error(`Error deleting file: ${err}`);
          } else {
            console.log(`File ${path} deleted.`);
          }
        });
      });
  
      return response.data.choices[0].message.content ? parseHtmlToText(response.data.choices[0].message.content) : null;
    } catch (error) {
      console.error("Ошибка при анализе изображений:", error);
      return null;
    }
}

export async function askChatGPT(prompt: string): Promise<string | null> {
    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        return response.choices[0]?.message.content || "No response";
    } catch (error: any) {
        console.error("Ошибка при запросе к GPT:", error);
        return null;
    }
}

