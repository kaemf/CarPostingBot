import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { WebPosting } from "../data/types";
import { downloadTelegramFile } from "./gpt";
import GetAxonomy from "../data/slugs";

dotenv.config();

const AUTH = {
  username: process.env.WP_USER!,
  password: process.env.WP_PASS!,
};

const URL = {
  POST: `${process.env.WP_URL}${process.env.WP_POST_URL}`,
  UPLOAD_MEDIA: `${process.env.WP_URL}${process.env.WP_UPLOAD_MEDIA_URL}`,
}

function PrepareDataForPosting(data: WebPosting.DataPrepareType): WebPosting.Car {
  return {
    post_thumbnail: parseInt(data.post_meta.gallery[0]),
    taxonomies: {
      make: {term_id: data.taxonomies.make},
      bodytype: { term_id: data.taxonomies.bodytype },
      'fuel-type': { term_id: data.taxonomies['fuel-type'] },
      transmission: { term_id: data.taxonomies.transmission },
    },
    post_meta: {
      gallery: [(data.post_meta.gallery).join(',')],
      Year: [data.post_meta.Year],
      Mileage: [data.post_meta.Mileage],
      Price: [data.post_meta.Price],
      Model: [data.post_meta.Model],
      Trim: [data.post_meta.Trim]
    },
  }
}

async function uploadMedia(fileId: string): Promise<string | undefined> {
  try {
    const form = new FormData(),
      filePath = await downloadTelegramFile(fileId, 'temp');
    form.append('file', fs.createReadStream(filePath));
  
    const headers = form.getHeaders();
  
    const res = await axios.post(URL.UPLOAD_MEDIA, form, {
      auth: AUTH,
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
      },
    });
  
     fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file: ${err}`);
      } else {
        console.log(`File ${filePath} deleted.`);
      }
    });
  
    return (res.data.id).toString();
  } catch (error: any) {
    console.error(error);
  }
}

export default async function PostToWeb(car: WebPosting.InputWebPosting): Promise<void> {
  try{
    const mediaIds: string[] = [];
  
    for (const img of car.photos) {
      const id = await uploadMedia(img);
      mediaIds.push(id!);
    }
  
    const postData = PrepareDataForPosting({
      post_thumbnail: parseInt(mediaIds[0]),
      post_meta: {
        gallery: mediaIds,
        Year: car.Year,
        Mileage: car.Mileage,
        Price: car.Price,
        Model: car.Model,
        Trim: car.Trim
      },
      taxonomies: {
        make: GetAxonomy(car.Make),
        bodytype: GetAxonomy(car["Body type"]),
        'fuel-type': GetAxonomy(car["Fuel type"]),
        transmission: GetAxonomy(car.Transmission),
      },
    });
  
    await axios.post(URL.POST, postData, { auth: AUTH });
  
    console.log(`Post successfully created`);
  } catch (error: any) {
    console.error(error);
  }
}