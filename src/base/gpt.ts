import { OpenAI } from 'openai';
import axios from "axios";
import FormData from "form-data";
import fs, { createWriteStream } from 'fs';
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TOKEN;

const client = new OpenAI({ apiKey: process.env.GPT });

function promptJSON(question?: string){
  return `Ты — API, которая на основе изображений автомобиля (внешний вид, салон, спидометр и т.д.) и текстового описания генерирует строго структурированный JSON.

  Твоя задача — извлечь информацию о машине по следующим правилам:

  ✅ Структура JSON:
  {
    "Valid": {
      ...
    },
    "Unknown": [
      ...
    ]
  }

  Пример текстового вида ввода:
  FOR SALE:  2026 CADILLAC VISTIQ SPORT
  ( Electric) 

  ODOMETER: 8 km 

  PRICE: $97300 plus taxes

  И пример ответа:
  {
    "Valid": {
      Year: "2026",
      Make: "Cadillac",
      Model: "Vistiq",
      Trim: "Sport",
      "Body type": "SUV",
      Transmission: "Automatic",
      "Fuel type": "Electric",
      Mileage: "8",
      Price: "97300"
    },
    "Unknown": []
  }

  ❗️Допустимы только два корневых ключа: "Valid" и "Unknown".  
  Никаких других слов, пояснений или форматирования. Ответ — строго JSON.

  🔎 Как заполнять поля:

  1. Если значение указано прямо — добавь его в "Valid" (Используй справочник таксономий для лучшего результата, по name).
  2. Если значение отсутствует, но можно **логически вывести по другим полям** — тоже добавь его в "Valid".

    Примеры:
    1. "Model": "Camry" → значит "Make": "Toyota"
    2. "Model": "SL43 AMG", "Year": 2025 → "Fuel type": "Gasoline"
    3. "Mileage": 10, "Year": текущий → почти всегда "Transmission": "Automatic"
    4. "Model": "SL43 AMG", "Year": 2025 → "Trim": "AMG" (логическое предположение по модели)
    5. "Model": "Toyota Prius", "Year": 2025 → "Trim": "Base" (логическое предположение для среднего класса)
    6. "Model": "Ford Mustang", "Trim": отсутствует → "Trim": "GT" (поскольку это спортивная модель)


  3. Если значение:
    - отсутствует,
    - выглядит как мусор (например, "1", "-", "test", "n/a", "Unknown", случайный набор символов) —

    то **не включай в Valid**, а **добавь название поля в массив "Unknown"**.

  🚫 В "Valid" не может быть значений вроде:
  - "Fuel type": "Unknown"
  - "Trim": "1"
  - "Exterior Colour": "-"
  - "Fuel type": "Нет"

  📌 Если значение можно логически восстановить — используй это. Примеры:
  - Если "Model": "Camry" → "Make": "Toyota"
  - Если "Body type" явно виден на изображении → используй его

  📋 Поля, которые нужно анализировать:
  - Body type (бери данные с справочника, поле name)
  - Year
  - Mileage (Не угадывай это значение, если данных нет - кидай в "Unknown", но в таком случае его не должно быть "Valid")
  - Price (Не угадывай это значение, если данных нет - кидай в "Unknown", но в таком случае его не должно быть "Valid")
  - Make (бери данные с справочника, поле name)
  - Model
  - Trim
  - Fuel type (бери данные с справочника, поле name)
  - Transmission (Она всегда Automatic)

  Если значение поля не входит в эти списки (для Fuel type или Transmission) — не добавляй его в "Valid", а перемести поле в "Unknown".

  📦 Возвращай только валидный JSON. Никаких "Постить?", "Готово", пояснений, форматирования, заголовков.

  Возвращай ответ строго в формате JSON.

  
  Текст пользователя: ${question ?? ''}
  
  –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

Справочник таксономий (только term_id, name, slug)

Марки:
{"term_id":"4","name":"Acura","slug":"acura"},
{"term_id":"5","name":"Alfa Romeo","slug":"alfa-romeo"},
{"term_id":"7","name":"Aston Martin","slug":"aston-martin"},
{"term_id":"8","name":"Audi","slug":"audi"},
{"term_id":"10","name":"Bentley","slug":"bentley"},
{"term_id":"11","name":"BMW","slug":"bmw"},
{"term_id":"12","name":"Buick","slug":"buick"},
{"term_id":"13","name":"Cadillac","slug":"cadillac"},
{"term_id":"14","name":"Chevrolet","slug":"chevrolet"},
{"term_id":"15","name":"Chrysler","slug":"chrysler"},
{"term_id":"16","name":"Dodge","slug":"dodge"},
{"term_id":"17","name":"Ferrari","slug":"ferrari"},
{"term_id":"18","name":"FIAT","slug":"fiat"},
{"term_id":"20","name":"Ford","slug":"ford"},
{"term_id":"21","name":"Genesis","slug":"genesis"},
{"term_id":"22","name":"GMC","slug":"gmc"},
{"term_id":"23","name":"Honda","slug":"honda"},
{"term_id":"24","name":"Hummer","slug":"hummer"},
{"term_id":"25","name":"Hyundai","slug":"hyundai"},
{"term_id":"27","name":"INFINITI","slug":"infiniti"},
{"term_id":"28","name":"Jaguar","slug":"jaguar"},
{"term_id":"29","name":"Jeep","slug":"jeep"},
{"term_id":"31","name":"Kia","slug":"kia"},
{"term_id":"32","name":"Lamborghini","slug":"lamborghini"},
{"term_id":"33","name":"Land Rover","slug":"land-rover"},
{"term_id":"34","name":"Lexus","slug":"lexus"},
{"term_id":"35","name":"Lincoln","slug":"lincoln"},
{"term_id":"36","name":"Lotus","slug":"lotus"},
{"term_id":"38","name":"Maserati","slug":"maserati"},
{"term_id":"39","name":"Mazda","slug":"mazda"},
{"term_id":"40","name":"McLaren","slug":"mclaren"},
{"term_id":"41","name":"Mercedes-Benz","slug":"mercedes-benz"},
{"term_id":"43","name":"MINI","slug":"mini"},
{"term_id":"44","name":"Mitsubishi","slug":"mitsubishi"},
{"term_id":"45","name":"Nissan","slug":"nissan"},
{"term_id":"49","name":"Pontiac","slug":"pontiac"},
{"term_id":"50","name":"Porsche","slug":"porsche"},
{"term_id":"51","name":"RAM","slug":"ram"},
{"term_id":"53","name":"Rolls-Royce","slug":"rolls-royce"},
{"term_id":"54","name":"Saab","slug":"saab"},
{"term_id":"58","name":"Smart","slug":"smart"},
{"term_id":"59","name":"Subaru","slug":"subaru"},
{"term_id":"60","name":"Suzuki","slug":"suzuki"},
{"term_id":"61","name":"Tesla","slug":"tesla"},
{"term_id":"62","name":"Toyota","slug":"toyota"},
{"term_id":"64","name":"Volkswagen","slug":"volkswagen"},
{"term_id":"65","name":"Volvo","slug":"volvo"}

Кузова:
{"term_id":"66","name":"SUV","slug":"suv"},
{"term_id":"67","name":"Truck","slug":"truck"},
{"term_id":"68","name":"Sedan","slug":"sedan"},
{"term_id":"69","name":"Coupe","slug":"coupe"},
{"term_id":"70","name":"Minivan","slug":"minivan"},
{"term_id":"72","name":"Hatchback","slug":"hatchback"},
{"term_id":"73","name":"Convertible","slug":"convertible"},
{"term_id":"74","name":"Wagon","slug":"wagon"}

Тип топлива:
{"term_id":"75","name":"Diesel","slug":"diesel"},
{"term_id":"76","name":"Gasoline","slug":"gasoline"},
{"term_id":"77","name":"Electric","slug":"electric"},
{"term_id":"78","name":"Hybrid","slug":"hybrid"}

Коробка передач:
{"term_id":"91","name":"Automatic","slug":"automatic"},
{"term_id":"92","name":"Manual","slug":"manual"}

–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
`
}

// function parseHtmlToText(html: string): string {
//   let text = html;

//   text = text.replace(/<\/?[^>]+(>|$)/g, "");
//   text = text.replace(/<br\s*\/?>/g, "\n");
//   text = text.replace(/<b>|<strong>/g, "**");
//   text = text.replace(/<\/b>|<\/strong>/g, "**");
//   text = text.replace(/<i>|<em>/g, "*");
//   text = text.replace(/<\/i>|<\/em>/g, "*");
//   text = text.replace(/<a\s+href="([^"]+)">([^<]+)<\/a>/g, "[$2]($1)");
//   text = text.replace(/<ul>|<ol>/g, "");
//   text = text.replace(/<\/ul>|<\/ol>/g, "");
//   text = text.replace(/<li>/g, "- ");
  
//   return text;
// }

function removeJsonBackticks(input: string): string {
  return input
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
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
      const filePaths = await Promise.all(fileIds.filter(item => item !== "").map(item =>downloadTelegramFile(item)));

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
            { type: "text", text: promptJSON(question) },
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
  
      return response.data.choices[0].message.content ? removeJsonBackticks(response.data.choices[0].message.content) : null;
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

