process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

import * as dotenv from "dotenv";
import * as path from "path";
import { GigaChatService } from "./gigachat";
import fetch from "node-fetch";

// Загружаем переменные окружения
dotenv.config();

export async function getAccessToken(): Promise<string> {
  const key = process.env.GIGACHAT_AUTHORIZATION_KEY;
  if (!key) throw new Error("GIGACHAT_AUTHORIZATION_KEY не задан в .env");

  const response = await fetch(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        scope: "GIGACHAT_API_PERS",
        grant_type: "client_credentials",
      }),
    }
  );

  const text = await response.text(); // <- читаем как текст
  console.log("Ответ сервера:", text); // <- логируем что реально пришло

  let data;
  try {
    data = JSON.parse(text); // пробуем распарсить вручную
  } catch (e) {
    throw new Error("Ошибка разбора JSON. Ответ сервера: " + text);
  }

  if (!response.ok) {
    throw new Error(
      `Ошибка получения токена: ${
        data.error_description || response.statusText
      }`
    );
  }

  return data.access_token;
}

async function main() {
  try {
    console.log("Начинаем инициализацию...");

    const apiKey = process.env.GIGACHAT_API_KEY;
    if (!apiKey) {
      throw new Error("GIGACHAT_API_KEY не найден в .env файле");
    }
    console.log("API ключ получен");

    const gigachat = new GigaChatService();
    console.log("Сервис GigaChat инициализирован");

    // Загрузка базы знаний из файла help.docx
    const docPath = path.join(__dirname, "..", "help.docx");
    console.log("Путь к файлу базы знаний:", docPath);
    await gigachat.loadKnowledgeBase(docPath);

    // Пример использования
    const testQuery = "Как загрузить фотографии на сайт?";
    console.log("Отправляем тестовый запрос:", testQuery);

    const response = await gigachat.getResponse(testQuery);
    console.log("Ответ ассистента:", response);
  } catch (error) {
    console.error("Критическая ошибка в main:", error);
    process.exit(1);
  }
}

// Запускаем приложение
console.log("Запуск приложения...");
main().catch((error) => {
  console.error("Необработанная ошибка:", error);
  process.exit(1);
});

export class PhotoBankAssistant {
  private service: GigaChatService;

  constructor(apiKey: string, knowledgeBasePath: string) {
    this.service = new GigaChatService();
    this.service.loadKnowledgeBase(knowledgeBasePath).catch(console.error);
  }

  async ask(question: string): Promise<string> {
    return this.service.getResponse(question);
  }
}

// Экспорт для использования в других проектах
export { GigaChatService } from "./gigachat";
