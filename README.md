# Bitrix24 Reporting Local

Локальное приложение для обезличенных отчетов по Bitrix24 CRM без чтения `contact/company` сущностей.

## Что уже есть

- `apps/api`: локальный Express API, SQLite storage, sync/reporting/security policy.
- `apps/web`: Vite React app with a single supported runtime entrypoint, `ProtoApp`.
- `packages/contracts`: общие snapshot/report DTO types.

## Безопасностная модель

- Runtime allowlist методов Bitrix24 ограничен list/read-only методами, нужными для локального snapshot sync.
- Contact reads разрешены только для `ID` и согласованных custom enum полей целевой группы; персональные поля контактов запрещены.
- Все `company`, single-record `get`, write/delete и произвольные `UF_*` payloads запрещены.
- В storage не сохраняются `phone`, `email`, имена контактов, deal title, comments, address, company links и raw `UF_*`.
- Webhook secret никогда не должен попадать в логи.
- Production API uses `AUTH_MODE=password`, HttpOnly session cookies and CSRF tokens. `API_AUTH_TOKEN` остается legacy/local-only режимом для mutating запросов, если password auth не включен.
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

Актуальный web runtime описан в [docs/architecture/web-runtime.md](/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль%20%22Привлечение%22/Дашборды%20Привлечения/docs/architecture/web-runtime.md). В `apps/web/src` не должно быть альтернативных dashboard shells или demo UI entrypoints.

### Ручной запуск

Требуется Node.js 24.x и pnpm 10.x. Это совпадает с CI/Docker runtime и закрывает требование Vite 8 к Node `20.19+` или `22.12+`; Node `20.17.0` для локального web build уже ниже поддерживаемого диапазона.

С nvm можно переключиться так:

```bash
nvm install
nvm use
node -v
```

Ожидаемый результат: `v24.x`.

1. Установить зависимости: `pnpm install`
2. Скопировать `.env.example` в `.env` и заполнить Bitrix24 webhook данные
3. Запустить API: `pnpm dev:api`
4. Запустить web: `pnpm dev:web`

Пока в `.env` стоят плейсхолдеры Bitrix24, интерфейс и локальный API запускаются, но ручной `Refresh` не сможет тянуть живые данные из портала.

Если задаете `API_AUTH_TOKEN`, ручные mutating запросы должны передавать токен через `X-API-Token` или `Authorization: Bearer <token>`.

Production deploy на Timeweb VPS описан в [docs/deploy-timeweb-vps.md](/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль%20%22Привлечение%22/Дашборды%20Привлечения/docs/deploy-timeweb-vps.md).

## Проверки

- `pnpm --filter @bitrix24-reporting/api test`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api lint`
