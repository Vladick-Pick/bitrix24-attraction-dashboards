# Bitrix24 Reporting Local

Локальное приложение для обезличенных отчетов по Bitrix24 CRM без чтения `contact/company` сущностей.

## Что уже есть

- `apps/api`: локальный Express API, SQLite storage, sync/reporting/security policy.
- `apps/web`: Vite React dashboard shell.
- `packages/contracts`: общие snapshot/report DTO types.

## Безопасностная модель

- Runtime allowlist методов Bitrix24: только `crm.deal.list`, `crm.lead.list`, `crm.status.list`.
- Все `contact/company`, single-record `get`, write/delete и custom-field payloads запрещены.
- В storage не сохраняются `phone`, `email`, `name`, `comments`, `address`, `contact/company` links и `UF_*`.
- Webhook secret никогда не должен попадать в логи.

Подробности: [SECURITY.md](/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль%20%22Привлечение%22/Дашборды%20Привлечения/SECURITY.md)

## Запуск

### Одна кнопка

- Двойной клик по [start.command](/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль%20%22Привлечение%22/Дашборды%20Привлечения/start.command)
- Или одна команда в терминале: `pnpm start`

Что делает launcher:

- если `.env` еще нет, создает его из `.env.example`
- создает `apps/web/.env.local` с правильным `VITE_API_BASE_URL`
- при первом запуске ставит зависимости, если `node_modules` еще нет
- поднимает `api` и `web` одновременно
- на macOS открывает браузер на `http://localhost:5173`

### Ручной запуск

1. Установить зависимости: `pnpm install`
2. Скопировать `.env.example` в `.env` и заполнить Bitrix24 webhook данные
3. Запустить API: `pnpm dev:api`
4. Запустить web: `pnpm dev:web`

Пока в `.env` стоят плейсхолдеры Bitrix24, интерфейс и локальный API запускаются, но ручной `Refresh` не сможет тянуть живые данные из портала.

## Проверки

- `pnpm --filter @bitrix24-reporting/api test`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api lint`
