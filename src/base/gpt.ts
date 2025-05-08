import { OpenAI } from 'openai';
import axios from "axios";
import FormData from "form-data";
import fs, { createWriteStream } from 'fs';
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TOKEN;

const client = new OpenAI({ apiKey: process.env.GPT }),
  API_URL = 'https://api.openai.com/v1',
  HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.GPT}`,
    'OpenAI-Beta': 'assistants=v2',
  };

export async function downloadTelegramFile(fileId: string, saveDir = "temp"): Promise<string> {
    // 1. Получаем путь к файлу
    const fileInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileInfo.data.result.file_path;

    // 2. Создаём URL для скачивания
    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

    // 3. Указываем путь, куда сохранить файл
    const fileName = path.basename(filePath);
    const localFilePath = path.join(saveDir, fileName);

    // Убедиться, что папка существует
    fs.mkdirSync(saveDir, { recursive: true });

    // 4. Скачиваем и сохраняем файл
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

export async function analyzeImages(filePaths: string[], question: string): Promise<string | null> {
    try {
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
            { type: "text", text: question },
            ...imageContents,
          ],
        },
      ];
  
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4-vision-preview",
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
  
      return response.data.choices[0].message.content;
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

