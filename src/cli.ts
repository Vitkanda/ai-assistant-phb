import readline from "readline";
import axios from "axios";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const API_URL = "http://localhost:3000/api/chat";

async function askQuestion() {
  rl.question(
    '\nВаш вопрос (или "выход" для завершения): ',
    async (question) => {
      if (question.toLowerCase() === "выход") {
        console.log("До свидания!");
        rl.close();
        return;
      }

      try {
        const response = await axios.post(API_URL, { message: question });
        console.log("\nОтвет бота:", response.data.response);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(
            "Ошибка при отправке запроса:",
            error.response?.data || error.message
          );
        } else {
          console.error("Произошла ошибка:", error);
        }
      }

      // Задаем следующий вопрос
      askQuestion();
    }
  );
}

console.log("Добро пожаловать в чат с ассистентом техподдержки фотобанка!");
console.log('Для выхода введите "выход"');
askQuestion();
