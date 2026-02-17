# Production Deployment Guide

## Запуск backend без Swagger в production режиме

### Автоматическое отключение Swagger

Swagger **автоматически отключается** при `NODE_ENV=production`. Никаких дополнительных действий не требуется.

## Варианты запуска

### 1. Docker Compose (рекомендуется для production)

```bash
# 1. Подготовьте .env файл
cp .env.production .env
nano .env

# 2. Измените все секретные данные:
#    - DB_PASSWORD
#    - TG_USER_BOT_TOKEN
#    - ROBOKASSA_PASSWORD_1, ROBOKASSA_PASSWORD_2
#    - VITE_ADMIN_PASSWORD
#    - ROBOKASSA_TEST_MODE=false

# 3. Убедитесь что NODE_ENV=production и BASE_URL правильный

# 4. Запуск с production конфигурацией
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Проверка логов
docker-compose logs -f app
```

**Production конфигурация включает:**
- ✅ Swagger отключен
- ✅ Логи ограничены (10MB, последние 3 файла)
- ✅ Автоматический restart контейнеров
- ✅ Ограничения CPU и памяти
- ✅ Порт 3000 доступен только локально (через Nginx)

### 2. Обычный Docker Compose

```bash
# docker-compose.yml уже настроен для production
docker-compose up -d --build
```

### 3. Без Docker (npm start)

```bash
# Установите зависимости
npm install

# Соберите проект
npm run build

# Запуск в production режиме
NODE_ENV=production npm run start:prod

# Или через PM2 (рекомендуется)
npm install -g pm2
pm2 start dist/main.js --name hyper-vpn -i 2
pm2 save
pm2 startup
```

## Переменные окружения для production

Обязательные параметры в `.env`:

```env
NODE_ENV=production          # ВАЖНО: отключает Swagger
BASE_URL=https://sub.hyper-vpn.ru
PORT=3000

# Database
DB_HOST=postgres            # или localhost без Docker
DB_PORT=5432
DB_USERNAME=vpn
DB_PASSWORD=STRONG_PASSWORD # ИЗМЕНИТЕ!
DB_NAME=hyper_vpn

# Telegram
TG_USER_BOT_TOKEN=production_token

# Robokassa
ROBOKASSA_MERCHANT_ID=your_id
ROBOKASSA_PASSWORD_1=password1
ROBOKASSA_PASSWORD_2=password2
ROBOKASSA_TEST_MODE=false   # ВАЖНО: отключить тестовый режим

# Admin panel
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=SECURE_PASSWORD # ИЗМЕНИТЕ!
```

## Проверка режима работы

```bash
# Проверьте логи при запуске:
docker-compose logs app | grep Swagger

# В production увидите:
# "📖 Swagger disabled (production mode)"

# В development увидите:
# "📖 Swagger enabled for development"
# "📖 Swagger docs: http://localhost:3000/api/docs"
```

## Управление production сервисом

```bash
# Остановка
docker-compose down

# Перезапуск (без пересборки)
docker-compose restart

# Обновление кода
git pull
docker-compose up -d --build

# Просмотр логов
docker-compose logs -f app
docker-compose logs --tail=100 app

# Статус контейнеров
docker-compose ps
```

## Миграция с development на production

```bash
# 1. Экспорт БД из development
docker exec hyper-vpn-db pg_dump -U postgres hyper_vpn > dev_backup.sql

# 2. Остановите development
docker-compose down

# 3. Настройте production .env
cp .env.production .env
nano .env  # Измените пароли и токены

# 4. Запустите production
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Импорт данных (если нужно)
docker exec -i hyper-vpn-db-prod psql -U vpn hyper_vpn < dev_backup.sql
```

## Безопасность production

- ✅ Swagger отключен (NODE_ENV=production)
- ✅ Порт 3000 доступен только через 127.0.0.1 (Nginx reverse proxy)
- ✅ CORS настроен только для вашего домена
- ✅ HTTPS через Let's Encrypt
- ✅ Secrets в .env (не коммитится в git)
- ⚠️ Регулярные бэкапы БД (настройте cron)

## Мониторинг и логи

```bash
# Стандартные логи Docker
docker-compose logs -f app

# Логи Nginx
sudo tail -f /var/log/nginx/hyper-vpn-error.log

# Статистика контейнеров
docker stats hyper-vpn-app-prod hyper-vpn-db-prod

# Использование диска БД
docker exec hyper-vpn-db-prod du -sh /var/lib/postgresql/data
```

## Troubleshooting

### Swagger всё ещё доступен

```bash
# Проверьте NODE_ENV
docker-compose exec app env | grep NODE_ENV

# Должно быть: NODE_ENV=production

# Если нет, проверьте .env файл и пересоберите
docker-compose up -d --build
```

### Приложение не запускается

```bash
# Проверьте логи
docker-compose logs app

# Проверьте переменные окружения
docker-compose config

# Проверьте подключение к БД
docker-compose exec app ping postgres
```

## Откат на development

Если нужно вернуть Swagger для отладки:

```bash
# Временно измените в .env
NODE_ENV=development

# Перезапустите
docker-compose restart app

# Swagger будет доступен на http://localhost:3000/api/docs
```

**ВАЖНО:** Не забудьте вернуть `NODE_ENV=production` после отладки!
