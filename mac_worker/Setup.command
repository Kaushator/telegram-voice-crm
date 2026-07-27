#!/bin/bash

CONFIG_FILE="$HOME/.crm_worker_config"
SERVER_URL="http://localhost:3000"

echo "=================================================="
echo "    CRM Assistant Worker Setup (MacBook M3)       "
echo "=================================================="

# --- 1. Проверка локального конфига ---
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    osascript -e "display dialog \"С возвращением, $ASSISTANT_NAME! Подключаем макбук к серверу...\" buttons {\"ОК\"} default button \"ОК\""
else
    # Первичный ввод данных
    ASSISTANT_NAME=$(osascript -e 'text returned of (display dialog "Представьтесь (имя):" default answer "" with title "Первичная настройка CRM")')
    TELEGRAM_ID=$(osascript -e 'text returned of (display dialog "Введите ваш Telegram Chat ID:" default answer "" with title "Первичная настройка CRM")')

    if [ -z "$ASSISTANT_NAME" ] || [ -z "$TELEGRAM_ID" ]; then
        osascript -e 'display dialog "Регистрация отменена. Данные не введены." buttons {"ОК"} default button "OK"'
        exit 1
    fi
fi

# --- 2. Поднятие Cloudflare Tunnel ---
echo "Запуск туннеля..."
TUNNEL_URL=$(cloudflared tunnel --url http://localhost:8000 2>&1 | grep -o 'https://.*\.trycloudflare\.com')

if [ -z "$TUNNEL_URL" ]; then
    TUNNEL_URL="http://localhost:8000"
fi

# --- 3. Запрос к серверу на регистрацию/проверку слота ---
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/register-worker" \
     -H "Content-Type: application/json" \
     -d "{
           \"name\": \"$ASSISTANT_NAME\",
           \"telegram_id\": \"$TELEGRAM_ID\",
           \"worker_url\": \"$TUNNEL_URL\"
         }")

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# --- 4. Обработка ответа сервера ---
if [ "$HTTP_STATUS" -eq 200 ]; then
    # Сохраняем локальный конфиг, если это первая успешная регистрация
    echo "ASSISTANT_NAME=\"$ASSISTANT_NAME\"" > "$CONFIG_FILE"
    echo "TELEGRAM_ID=\"$TELEGRAM_ID\"" >> "$CONFIG_FILE"
    
    osascript -e "display dialog \"Успешно! Ваш макбук подключен к системе CRM.\" buttons {\"Отлично\"} default button \"Отлично\""
else
    # Если сервер вернул 403 (Слоты заняты)
    osascript -e 'display dialog "ОШИБКА ДОСТУПА:\nВсе слоты ассистентов (2/2) уже заняты.\nОбратитесь к Администратору для сброса доступа." buttons {"Закрыть"} default button "Закрыть"'
    exit 1
fi
