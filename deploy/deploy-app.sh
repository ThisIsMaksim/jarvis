#!/bin/bash

# Скрипт деплоя Telegram AI Bot
# Запуск: bash deploy-app.sh

set -e

echo "🚀 Деплой Telegram AI Bot..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Переменные
APP_DIR="/opt/telegram-ai-bot"
SERVICE_NAME="telegram-ai-bot"

# Проверка, что мы в правильной директории
if [ ! -f "package.json" ]; then
    print_error "Запустите скрипт из корневой директории проекта (где находится package.json)"
    exit 1
fi

# Проверка .env файла
if [ ! -f ".env" ]; then
    print_error ".env файл не найден!"
    echo "Создайте .env файл на основе .env.example:"
    echo "cp .env.example .env"
    echo "Затем отредактируйте его с вашими настройками"
    exit 1
fi

# Проверка обязательных переменных в .env
print_status "Проверка .env файла..."
required_vars=("TELEGRAM_BOT_TOKEN" "MONGO_URI" "REDIS_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env || grep -q "^${var}=.*_here" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Не заполнены обязательные переменные в .env:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

print_success ".env файл корректно настроен"

# Установка зависимостей
print_status "Установка зависимостей..."
pnpm install
print_success "Зависимости установлены"

# Сборка проекта
print_status "Сборка проекта..."
pnpm build
print_success "Проект собран"

# Копирование файлов в целевую директорию
print_status "Копирование файлов в $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo cp -r dist/ $APP_DIR/
sudo cp -r node_modules/ $APP_DIR/
sudo cp package.json $APP_DIR/
sudo cp .env $APP_DIR/

# Установка прав
sudo chown -R telegram-bot:telegram-bot $APP_DIR
print_success "Файлы скопированы и права установлены"

# Создание systemd сервиса
print_status "Создание systemd сервиса..."
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=Telegram AI Bot
After=network.target mongod.service redis.service
Wants=mongod.service redis.service

[Service]
Type=simple
User=telegram-bot
Group=telegram-bot
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Логирование
StandardOutput=journal
StandardError=journal
SyslogIdentifier=telegram-ai-bot

# Безопасность
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

print_success "Systemd сервис создан"

# Перезагрузка systemd и запуск сервиса
print_status "Запуск сервиса..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Проверка статуса
sleep 3
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    print_success "Сервис $SERVICE_NAME запущен и работает!"
else
    print_error "Ошибка запуска сервиса"
    echo "Проверьте логи: sudo journalctl -u $SERVICE_NAME -f"
    exit 1
fi

# Создание Nginx конфигурации (если нужен webhook)
if grep -q "^WEBHOOK_URL=" .env && ! grep -q "^#WEBHOOK_URL=" .env; then
    print_status "Настройка Nginx для webhook..."
    
    # Извлекаем домен из WEBHOOK_URL
    DOMAIN=$(grep "^WEBHOOK_URL=" .env | cut -d'=' -f2 | sed 's|https\?://||' | cut -d'/' -f1)
    
    if [ -n "$DOMAIN" ]; then
        sudo tee /etc/nginx/sites-available/$SERVICE_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

        # Активация конфигурации
        sudo ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
        
        print_success "Nginx настроен для домена $DOMAIN"
        print_warning "Для SSL сертификата выполните: sudo certbot --nginx -d $DOMAIN"
    fi
else
    print_status "Webhook не настроен, бот будет работать в polling режиме"
fi

# Финальная информация
print_success "🎉 Деплой завершен успешно!"
echo ""
echo "📋 Полезные команды:"
echo "sudo systemctl status $SERVICE_NAME    # Статус сервиса"
echo "sudo journalctl -u $SERVICE_NAME -f    # Логи в реальном времени"
echo "sudo systemctl restart $SERVICE_NAME   # Перезапуск сервиса"
echo "sudo systemctl stop $SERVICE_NAME      # Остановка сервиса"
echo ""
echo "🔍 Проверка работы:"
echo "curl http://localhost:8080/healthz     # Health check"
echo ""
echo "📱 Теперь можете тестировать бота в Telegram!"

# Показать статус сервисов
echo ""
echo "📊 Статус сервисов:"
echo "MongoDB: $(sudo systemctl is-active mongod)"
echo "Redis: $(sudo systemctl is-active redis)"
echo "Nginx: $(sudo systemctl is-active nginx)"
echo "Telegram Bot: $(sudo systemctl is-active $SERVICE_NAME)"