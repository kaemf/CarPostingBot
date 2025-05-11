import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// === НАСТРОЙКИ ===
const AUTH = { username: 'wp_user', password: 'app_password' };

// Типы
type TaxonomyTerm = {
  slug: string;
  name: string;
};

type Car = {
  title: string;
  content: string;
  status?: 'publish' | 'draft';
  images: string[];
  taxonomies: Record<string, TaxonomyTerm>;
  meta: Record<string, string>;
};

// Пример массива машин
const cars: Car[] = [
  {
    title: '2025 Mercedes-Benz SL43 AMG Roadster',
    content: '<p>Эксклюзивный родстер Mercedes-Benz…</p>',
    status: 'publish',
    images: ['./img/2003.jpg', './img/2004.jpg'],
    taxonomies: {
      make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
      colour: { slug: 'white', name: 'White' },
      bodytype: { slug: 'convertible', name: 'Convertible' },
      'fuel-type': { slug: 'gasoline', name: 'Gasoline' },
      transmission: { slug: 'automatic', name: 'Automatic' },
    },
    meta: {
      Year: '2025',
      Mileage: '14',
      Price: '162646',
      Model: 'SL43',
      Trim: 'AMG ROADSTER',
    },
  },
];

// === Функция загрузки одной картинки ===
async function uploadMedia(filePath: string): Promise<number> {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const headers = form.getHeaders();

  const res = await axios.post(`${API_BASE}/media`, form, {
    auth: AUTH,
    headers: {
      ...headers,
      'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
    },
  });

  return res.data.id;
}

// === Функция «получить или создать» термин в таксономии ===
async function ensureTerm(taxonomy: string, slug: string, name: string): Promise<number> {
  try {
    const res = await axios.get(`${API_BASE}/${taxonomy}`, {
      auth: AUTH,
      params: { slug },
    });

    if (res.data.length) {
      return res.data[0].id;
    }
  } catch (error) {
    console.error(`Ошибка при проверке термина: ${taxonomy}/${slug}`, error);
  }

  // Создаём термин, если не найден
  const createRes = await axios.post(`${API_BASE}/${taxonomy}`, {
    name,
    slug,
  }, { auth: AUTH });

  return createRes.data.id;
}

// === Обработка одной машины ===
async function processCar(car: Car): Promise<void> {
  // 1) Загрузить все картинки
  const mediaIds: number[] = [];

  for (const img of car.images) {
    const id = await uploadMedia(img);
    mediaIds.push(id);
  }

  // 2) Обработать все таксономии
  const taxIds: Record<string, number> = {};

  for (const [tax, { slug, name }] of Object.entries(car.taxonomies)) {
    taxIds[tax] = await ensureTerm(tax, slug, name);
  }

  // 3) Собрать тело запроса
  const postData = {
    title: car.title,
    content: car.content,
    status: car.status || 'draft',
    featured_media: mediaIds[0] || undefined,
    ...Object.fromEntries(
      Object.entries(taxIds).map(([tax, id]) => [tax, [id]])
    ),
    meta: car.meta,
  };

  // 4) Создать пост
  const postRes = await axios.post(`${API_BASE}/posts`, postData, { auth: AUTH });

  console.log(`Пост создан: ${postRes.data.link}`);
}

// === Главная точка ===
(async () => {
  for (const car of cars) {
    try {
      await processCar(car);
    } catch (err: any) {
      console.error('Ошибка при публикации', car.title, err.response?.data || err.message);
    }
  }
})();
