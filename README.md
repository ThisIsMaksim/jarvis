# Telegram AI Assistant Bot

Личный AI-ассистент в Telegram с поддержкой forum topics, напоминаний, саммари и function-calling.

## 🚀 Возможности

- **Изолированные контексты** по топикам (forum topics)
- **Мультимодальность**: текст, изображения, голосовые сообщения
- **Умные напоминания** с поддержкой повторов
- **Автоматические саммари** по дням/неделям/месяцам/годам
- **Function-calling** для выполнения команд
- **Поддержка нескольких AI провайдеров** (OpenAI, Google Gemini)
- **Масштабируемая архитектура** с очередями задач

## 📋 Требования

- Node.js 20+
- MongoDB
- Redis
- API ключи: OpenAI и/или Google Gemini
- Telegram Bot Token

## 🛠 Установка

### 1. Клонирование и установка зависимостей

```bash
git clone <repository-url>
cd telegram-ai-bot
pnpm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp .env.example .env
```

Обязательные переменные:
```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Database
MONGO_URI=mongodb://localhost:27017/aiassistant

# Redis
REDIS_URL=redis://localhost:6379

# AI Providers (минимум один)
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Bot Configuration
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o-mini
DEFAULT_TIMEZONE=Europe/Berlin

# Server (для webhook)
WEBHOOK_URL=https://your-domain.com
PORT=8080
NODE_ENV=production
```

### 3. Создание Telegram бота

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Получите токен и добавьте в `.env`
4. Настройте права бота:
   ```
   /setprivacy - Disable (чтобы бот видел все сообщения в группах)
   /setjoingroups - Enable (чтобы бот можно было добавлять в группы)
   /setcommands - Установите команды:
   ```
   ```
   start - Начать работу с ботом
   help - Справка по командам
   model - Выбрать AI модель
   reminders - Показать напоминания
   summary - Генерировать саммари
   topic - Информация о топике
   ```

## 🗄 Настройка баз данных

### MongoDB

Установите и запустите MongoDB:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mongodb

# macOS
brew install mongodb-community
brew services start mongodb-community

# Docker
docker run -d --name mongodb -p 27017:27017 mongo:latest
```

### Redis

Установите и запустите Redis:

```bash
# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# macOS
brew install redis
brew services start redis

# Docker
docker run -d --name redis -p 6379:6379 redis:alpine
```

## 🚀 Запуск

### Режим разработки

```bash
pnpm dev
```

### Продакшн

```bash
# Сборка
pnpm build

# Запуск
pnpm start
```

## 📱 Настройка Telegram чата

### 1. Включение Topics (Forum)

1. Создайте групповой чат в Telegram
2. Откройте настройки чата
3. Найдите раздел "Topics" или "Темы"
4. Включите "Enable Topics"
5. Добавьте бота в чат
6. Дайте боту права администратора с возможностью:
   - Управлять топиками
   - Удалять сообщения
   - Отправлять сообщения

### 2. Создание топиков

Создайте топики для разных задач:
- 📝 Планирование проектов
- ⏰ Напоминания и задачи
- 💡 Обсуждение идей
- 📊 Анализ данных
- 🏃‍♂️ Фитнес-трекер

### 3. Использование

В каждом топике бот ведёт отдельный контекст. Примеры команд:

```
Поставь напоминание завтра в 10:00 позвонить клиенту
Дай саммари за неделю
Запиши заметку: встреча с командой 15 числа
Каждый понедельник в 9:00 - планёрка команды
```

## 🌐 Деплой на VPS (Yandex Cloud)

### 1. Создание VPS

1. Зайдите в [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Создайте новую виртуальную машину:
   - OS: Ubuntu 22.04 LTS
   - vCPU: 2
   - RAM: 4 GB
   - Disk: 20 GB SSD
3. Настройте SSH ключи

### 2. Настройка сервера

```bash
# Подключение к серверу
ssh ubuntu@your-server-ip

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка pnpm
npm install -g pnpm

# Установка MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Установка Redis
sudo apt install redis-server -y
sudo systemctl start redis
sudo systemctl enable redis

# Установка Nginx
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 3. Деплой приложения

```bash
# Клонирование репозитория
git clone <your-repo-url> /opt/telegram-ai-bot
cd /opt/telegram-ai-bot

# Установка зависимостей
pnpm install

# Настройка окружения
sudo cp .env.example .env
sudo nano .env  # Заполните переменные

# Сборка
pnpm build

# Создание пользователя для приложения
sudo useradd -r -s /bin/false telegram-bot
sudo chown -R telegram-bot:telegram-bot /opt/telegram-ai-bot
```

### 4. Настройка systemd

Создайте файл `/etc/systemd/system/telegram-ai-bot.service`:

```ini
[Unit]
Description=Telegram AI Bot
After=network.target mongod.service redis.service

[Service]
Type=simple
User=telegram-bot
WorkingDirectory=/opt/telegram-ai-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Запуск сервиса:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-ai-bot
sudo systemctl start telegram-ai-bot
sudo systemctl status telegram-ai-bot
```

### 5. Настройка Nginx (для webhook)

Создайте файл `/etc/nginx/sites-available/telegram-ai-bot`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активация конфигурации:

```bash
sudo ln -s /etc/nginx/sites-available/telegram-ai-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Настройка SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление сертификата
sudo crontab -e
# Добавьте строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔧 Мониторинг и логи

### Просмотр логов

```bash
# Логи приложения
sudo journalctl -u telegram-ai-bot -f

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи MongoDB
sudo tail -f /var/log/mongodb/mongod.log
```

### Health-check

```bash
# Проверка статуса приложения
curl http://localhost:8080/healthz

# Проверка через домен
curl https://your-domain.com/healthz
```

## 🧪 Тестирование

### Запуск тестов

```bash
# Все тесты
pnpm test

# Только unit тесты
pnpm test:unit

# Тесты с покрытием
pnpm test:coverage
```

### Smoke тесты

```bash
# Тест команды /start
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "text": "/start"}'

# Тест создания напоминания
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<CHAT_ID>", "message_thread_id": "<TOPIC_ID>", "text": "Поставь напоминание завтра в 10:00 тест"}'
```

## 📊 Архитектура

```
src/
├── config/          # Конфигурация и валидация ENV
├── db/             # MongoDB модели и подключение
│   └── models/     # Mongoose схемы
├── bot/            # Telegram бот
│   ├── handlers/   # Обработчики сообщений
│   └── ui/         # Клавиатуры и сообщения
├── llm/            # LLM провайдеры и инструменты
│   ├── providers/  # OpenAI, Gemini
│   ├── tools/      # Function-calling инструменты
│   └── prompts/    # Системные промпты
├── jobs/           # BullMQ очереди и воркеры
│   └── workers/    # Обработчики фоновых задач
├── server/         # HTTP сервер для webhook
└── utils/          # Утилиты
```

## 🔧 Разработка

### Добавление нового инструмента

1. Создайте файл в `src/llm/tools/your-tool.ts`
2. Определите схему валидации с Zod
3. Реализуйте `ToolDefinition` и функцию выполнения
4. Добавьте в `src/llm/tools/index.ts`

### Добавление нового провайдера

1. Создайте файл в `src/llm/providers/your-provider.ts`
2. Реализуйте интерфейс `LLMProvider`
3. Добавьте в `src/llm/router.ts`
4. Обновите конфигурацию в `src/config/env.ts`

## 🐛 Устранение неполадок

### Бот не отвечает

1. Проверьте токен бота
2. Убедитесь, что бот добавлен в чат
3. Проверьте права бота в чате
4. Посмотрите логи: `sudo journalctl -u telegram-ai-bot -f`

### Ошибки базы данных

1. Проверьте статус MongoDB: `sudo systemctl status mongod`
2. Проверьте подключение: `mongo --eval "db.adminCommand('ismaster')"`
3. Проверьте права доступа к файлам БД

### Проблемы с напоминаниями

1. Проверьте статус Redis: `sudo systemctl status redis`
2. Проверьте очереди: `redis-cli monitor`
3. Убедитесь, что воркеры запущены

## 📝 Лицензия

MIT License

## 🤝 Поддержка

Для вопросов и предложений создавайте Issues в репозитории.