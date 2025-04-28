import express from "express";
import cors from "cors";
import { GigaChatService } from "./gigachat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Инициализация сервиса GigaChat
const gigachat = new GigaChatService();

// Загрузка базы знаний
const docPath = path.join(__dirname, "..", "help.docx");
console.log("Путь к файлу базы знаний:", docPath);
gigachat.loadKnowledgeBase(docPath).catch(console.error);

// Маршруты API
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("Получен запрос:", message);

    if (!message) {
      console.log("Ошибка: пустое сообщение");
      return res.status(400).json({ error: "Сообщение не может быть пустым" });
    }

    console.log("Отправляем запрос в GigaChat...");
    const response = await gigachat.getResponse(message);
    console.log("Получен ответ от GigaChat:", response);

    res.json({ response });
  } catch (error) {
    console.error("Детальная ошибка при обработке запроса:", error);
    res.status(500).json({
      error: "Произошла ошибка при обработке запроса",
      details: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`API доступен по адресу: http://localhost:${port}/api/chat`);
});
