#!/bin/bash

# Скрипт автоматической настройки сервера для Telegram AI Bot
# Запуск: bash setup-server.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем настройку сервера для Telegram AI Bot..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Проверка прав root
if [[ $EUID -eq 0 ]]; then
   print_error "Не запускайте этот скрипт от root! Используйте sudo при необходимости."
   exit 1
fi

# Обновление системы
print_status "Обновление системы..."
sudo apt update && sudo apt upgrade -y
print_success "Система обновлена"

# Установка базовых пакетов
print_status "Установка базовых пакетов..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
print_success "Базовые пакеты установлены"

# Установка Node.js 20
print_status "Установка Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
print_success "Node.js $(node --version) установлен"

# Установка pnpm
print_status "Установка pnpm..."
sudo npm install -g pnpm
print_success "pnpm $(pnpm --version) установлен"

# Установка MongoDB
print_status "Установка MongoDB..."
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Запуск и автозапуск MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Проверка MongoDB
if sudo systemctl is-active --quiet mongod; then
    print_success "MongoDB запущен и работает"
else
    print_error "Ошибка запуска MongoDB"
    exit 1
fi

# Установка Redis
print_status "Установка Redis..."
sudo apt install -y redis-server

# Настройка Redis для systemd
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf

# Запуск и автозапуск Redis
sudo systemctl restart redis.service
sudo systemctl enable redis

# Проверка Redis
if sudo systemctl is-active --quiet redis; then
    print_success "Redis запущен и работает"
else
    print_error "Ошибка запуска Redis"
    exit 1
fi

# Установка Nginx
print_status "Установка Nginx..."
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
print_success "Nginx установлен и запущен"

# Установка Certbot для SSL
print_status "Установка Certbot..."
sudo apt install -y certbot python3-certbot-nginx
print_success "Certbot установлен"

# Создание пользователя для приложения
print_status "Создание пользователя telegram-bot..."
if ! id "telegram-bot" &>/dev/null; then
    sudo useradd -r -s /bin/false telegram-bot
    print_success "Пользователь telegram-bot создан"
else
    print_warning "Пользователь telegram-bot уже существует"
fi

# Создание директории для приложения
print_status "Создание директории приложения..."
sudo mkdir -p /opt/telegram-ai-bot
sudo chown -R $USER:$USER /opt/telegram-ai-bot
print_success "Директория /opt/telegram-ai-bot создана"

# Настройка файрвола
print_status "Настройка файрвола..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
print_success "Файрвол настроен"

# Проверка статуса сервисов
print_status "Проверка статуса сервисов..."
echo "MongoDB: $(sudo systemctl is-active mongod)"
echo "Redis: $(sudo systemctl is-active redis)"
echo "Nginx: $(sudo systemctl is-active nginx)"

# Информация о подключении к базам данных
print_success "Настройка сервера завершена!"
echo ""
echo "📋 Информация для .env файла:"
echo "MONGO_URI=mongodb://localhost:27017/aiassistant"
echo "REDIS_URL=redis://localhost:6379"
echo ""
echo "🔧 Следующие шаги:"
echo "1. Склонируйте репозиторий в /opt/telegram-ai-bot"
echo "2. Настройте .env файл"
echo "3. Запустите deploy/deploy-app.sh"
echo ""
echo "💡 Полезные команды:"
echo "sudo systemctl status mongod  # Статус MongoDB"
echo "sudo systemctl status redis   # Статус Redis"
echo "sudo systemctl status nginx   # Статус Nginx"
echo "mongo                         # Подключение к MongoDB"
echo "redis-cli                     # Подключение к Redis"