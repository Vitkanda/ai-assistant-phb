import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { FakeEmbeddings } from "langchain/embeddings/fake";
import mammoth from "mammoth";

dotenv.config();

const GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1";
const GIGACHAT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

interface GigaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GigaChatResponse {
  choices: Array<{
    message: GigaChatMessage;
  }>;
}

export class GigaChatService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private vectorStore!: MemoryVectorStore;

  constructor() {
    this.initializeVectorStore().catch((error) => {
      console.error("Ошибка при инициализации vector store:", error);
    });
  }

  private async initializeVectorStore() {
    const filePath = path.join(__dirname, "..", "help.docx");
    console.log("Путь к файлу базы знаний:", filePath);

    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const fileContent = result.value;
      console.log(
        "Содержимое файла (первые 200 символов):",
        fileContent.substring(0, 200)
      );

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([fileContent]);
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        new FakeEmbeddings()
      );
      console.log("База знаний загружена успешно");
    } catch (error) {
      console.error("Ошибка при чтении файла:", error);
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      const response = await axios.post(
        GIGACHAT_AUTH_URL,
        {
          scope: "GIGACHAT_API_PERS",
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            RqUID: "6f0b1291-c7f3-43c6-bb2e-9f3ef7d1d187",
            Authorization: `Basic ${process.env.GIGACHAT_API_KEY}`,
          },
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_at * 1000;
    }

    if (!this.accessToken) {
      throw new Error("Не удалось получить токен доступа");
    }

    return this.accessToken;
  }

  private async getRelevantContext(query: string): Promise<string> {
    console.log("Ищем релевантный контекст для запроса:", query);
    const results = await this.vectorStore.similaritySearch(query, 3);
    console.log("Найдено результатов:", results.length);
    results.forEach((doc, index) => {
      console.log(`\nРезультат ${index + 1}:`);
      console.log(doc.pageContent.substring(0, 200) + "...");
    });
    return results.map((doc: Document) => doc.pageContent).join("\n");
  }

  public async loadKnowledgeBase(filePath: string): Promise<void> {
    console.log("Начинаем загрузку базы знаний...");
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const fileContent = result.value;
      console.log(
        "Содержимое файла (первые 200 символов):",
        fileContent.substring(0, 200)
      );

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const docs = await splitter.createDocuments([fileContent]);
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        docs,
        new FakeEmbeddings()
      );
      console.log("База знаний загружена успешно");
    } catch (error) {
      console.error("Ошибка при загрузке базы знаний:", error);
      throw error;
    }
  }

  public async getResponse(message: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      console.log("Получен токен доступа");

      const context = await this.getRelevantContext(message);
      console.log("Получен контекст из базы знаний");

      const messages = [
        {
          role: "system",
          content: `Ты - AI ассистент для фото-банка. Используй следующую информацию для ответов: ${context}`,
        },
        {
          role: "user",
          content: message,
        },
      ];

      console.log("Отправляем запрос в GigaChat...");
      const response = await axios.post(
        `${GIGACHAT_API_URL}/chat/completions`,
        {
          model: "GigaChat:latest",
          messages,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        }
      );

      console.log("Получен ответ от GigaChat");
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("Ошибка при отправке сообщения:", error);
      throw error;
    }
  }
}
