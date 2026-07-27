# Локальный контейнер обработки (WhisperX + Gemma 2) для macOS (MacBook)

Данный контейнер разворачивается на MacBook ассистента для автономной транскрибации аудиофайлов от Шефа и перевода текста.

## Инструкция по запуску:

1. Установите **Docker Desktop** и **Ollama** (для запуска Gemma 2 локально):
   ```bash
   ollama pull gemma2:2b
   ```

2. Клонируйте папку `mac_worker` и перейдите в нее:
   ```bash
   cd mac_worker
   ```

3. Укажите адрес главного CRM-сервера в `docker-compose.yml`:
   `MAIN_SERVER_URL=https://ваша-crm.run.app`

4. Запустите контейнер:
   ```bash
   docker-compose up -d --build
   ```

5. Сервер будет слушать порт `8000` и готов принимать задачи от CRM при нажатии кнопки в Telegram.
