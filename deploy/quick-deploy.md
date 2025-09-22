# 🚀 Быстрый деплой на Yandex Cloud VPS

## Шаг 1: Подключение к серверу

```bash
yc compute ssh --id fv4jaqnla0lafron8uju
```

## Шаг 2: Настройка сервера (MongoDB, Redis, Node.js)

```bash
# Скачиваем и запускаем скрипт настройки
wget https://raw.githubusercontent.com/your-repo/telegram-ai-bot/main/deploy/setup-server.sh
chmod +x setup-server.sh
bash setup-server.sh
```

**Или вручную:**

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod

# Redis
sudo apt install -y redis-server
sudo systemctl start redis && sudo systemctl enable redis

# Nginx (опционально)
sudo apt install -y nginx
sudo systemctl start nginx && sudo systemctl enable nginx
```

## Шаг 3: Клонирование проекта

```bash
# Клонируем в /opt/telegram-ai-bot
sudo mkdir -p /opt/telegram-ai-bot
sudo chown -R $USER:$USER /opt/telegram-ai-bot
cd /opt/telegram-ai-bot

# Клонируем репозиторий (замените на ваш URL)
git clone https://github.com/your-repo/telegram-ai-bot.git .
```

## Шаг 4: Настройка .env

```bash
# Копируем пример
cp .env.example .env

# Редактируем (замените на ваши данные)
nano .env
```

**Минимальные настройки:**
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
MONGO_URI=mongodb://localhost:27017/aiassistant
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_api_key
DEFAULT_PROVIDER=openai
NODE_ENV=production
```

## Шаг 5: Деплой приложения

```bash
# Запускаем скрипт деплоя
chmod +x deploy/deploy-app.sh
bash deploy/deploy-app.sh
```

**Или вручную:**

```bash
# Установка зависимостей и сборка
pnpm install
pnpm build

# Создание пользователя
sudo useradd -r -s /bin/false telegram-bot

# Копирование файлов
sudo cp -r dist/ node_modules/ package.json .env /opt/telegram-ai-bot/
sudo chown -R telegram-bot:telegram-bot /opt/telegram-ai-bot

# Создание systemd сервиса
sudo tee /etc/systemd/system/telegram-ai-bot.service > /dev/null <<EOF
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
EOF

# Запуск сервиса
sudo systemctl daemon-reload
sudo systemctl enable telegram-ai-bot
sudo systemctl start telegram-ai-bot
```

## Шаг 6: Проверка работы

```bash
# Статус сервиса
sudo systemctl status telegram-ai-bot

# Логи в реальном времени
sudo journalctl -u telegram-ai-bot -f

# Health check
curl http://localhost:8080/healthz

# Статус всех сервисов
sudo systemctl status mongod redis nginx telegram-ai-bot
```

## 🔧 Полезные команды

```bash
# Перезапуск бота
sudo systemctl restart telegram-ai-bot

# Остановка бота
sudo systemctl stop telegram-ai-bot

# Обновление кода
cd /opt/telegram-ai-bot
git pull
pnpm build
sudo systemctl restart telegram-ai-bot

# Просмотр логов
sudo journalctl -u telegram-ai-bot --since "1 hour ago"

# Подключение к MongoDB
mongo

# Подключение к Redis
redis-cli
```

## 🐛 Устранение неполадок

### Бот не запускается
```bash
# Проверить логи
sudo journalctl -u telegram-ai-bot -n 50

# Проверить .env файл
cat /opt/telegram-ai-bot/.env

# Проверить права файлов
ls -la /opt/telegram-ai-bot/
```

### Проблемы с базами данных
```bash
# Статус MongoDB
sudo systemctl status mongod

# Статус Redis
sudo systemctl status redis

# Тест подключения к MongoDB
mongo --eval "db.adminCommand('ismaster')"

# Тест подключения к Redis
redis-cli ping
```

### Проблемы с памятью
```bash
# Мониторинг ресурсов
htop
free -h
df -h
```

## 🎯 Готово!

После выполнения всех шагов ваш Telegram AI Bot будет работать на VPS!

Теперь можете:
1. Добавить бота в групповой чат
2. Включить Topics (Forum) в настройках чата
3. Создать топики и начать общение с ботом

**Бот будет работать в polling режиме и автоматически перезапускаться при сбоях.**