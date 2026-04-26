# Bitrix24 Reporting Local

Локальное приложение для обезличенных отчетов по Bitrix24 CRM без чтения `contact/company` сущностей.

## Что уже есть

- `apps/api`: локальный Express API, SQLite storage, sync/reporting/security policy.
- `apps/web`: Vite React dashboard shell.
- `packages/contracts`: общие snapshot/report DTO types.

## Безопасностная модель

- Runtime allowlist методов Bitrix24 ограничен list/read-only методами, нужными для локального snapshot sync.
- Contact reads разрешены только для `ID` и согласованных custom enum полей целевой группы; персональные поля контактов запрещены.
- Все `company`, single-record `get`, write/delete и произвольные `UF_*` payloads запрещены.
- В storage не сохраняются `phone`, `email`, имена контактов, deal title, comments, address, company links и raw `UF_*`.
- Webhook secret никогда не должен попадать в логи.
- Mutating API routes (`/api/sync`, `/api/settings/won-stages`) требуют `API_AUTH_TOKEN`, если токен задан в окружении.
- Prototype comments endpoint доступен только на localhost, валидирует JSON/schema/размер тела и в preview выключен по умолчанию. Для preview включения задайте `PROTO_COMMENTS_ENABLED=true`.

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

Если задаете `API_AUTH_TOKEN`, ручные mutating запросы должны передавать токен через `X-API-Token` или `Authorization: Bearer <token>`.

## Проверки

- `pnpm --filter @bitrix24-reporting/api test`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api lint`
