# Proto To Web Design

**Goal**

Сделать текущий интерфейс из `apps/proto` единственным основным интерфейсом в `apps/web`, сохранив `comment mode`, локальное хранение комментариев и подключив живые данные из backend для всех operational-сцен. Экран продаж пока остается на mock-данных.

**Approved Scope**

- `apps/web` заменяет текущий шаблонный экран на интерфейс из `apps/proto`
- `comment mode` переносится без потери поведения
- существующий файл `.codex/proto-comments/comments.json` продолжает использоваться
- live backend подключается для:
  - дел / звонков
  - когорт
  - TOC / движение по воронке
- `sales` пока остается mock

**Architecture**

Перенос делится на три слоя:

1. **Product shell**
   Переносим `apps/proto/src/App.tsx`, связанные типы, сцены и недостающие UI-примитивы в `apps/web`. Новый entrypoint `apps/web/src/App.tsx` рендерит только этот экран.

2. **Comment mode**
   Переносим `comments-api`, `use-proto-comments` и Vite middleware в `apps/web`, сохраняя тот же storage-файл `.codex/proto-comments/comments.json`. Это гарантирует, что уже оставленные комментарии не пропадут и comment mode останется рабочим в основном продукте.

3. **Live scene data**
   Для operational-сцен добавляется адаптер поверх текущего `apiClient`:
   - сцена `activities-calls` получает данные из `activities`, `calls`
   - сцена `cohorts` получает данные из `cohort`
   - сцена `funnel-flow` получает данные из `toc-flow`
   - сцена `sales` пока питается существующим mock-слоем

**Data Strategy**

- Основной диапазон и compare ranges берутся из фильтров прототипа
- фильтры менеджеров и источников маппятся на backend query params
- live payload нормализуется в view-model уровня сцены
- mock/live переключение делаем не на уровне UI-дерева, а на уровне scene data adapter, чтобы интерфейс остался единым

**Risk Control**

- не переносить старый `DesignTemplatePage` по частям; он должен просто перестать быть entrypoint
- не переписывать визуал в процессе переноса
- не пытаться стабилизировать `sales` методологию сейчас
- не менять comment storage format

**Verification**

- `apps/web` должен собираться и проходить тесты
- `comment mode` должен:
  - открываться
  - сохранять комментарии
  - архивировать/удалять их
- live сцены должны отрисовываться на реальных ответах API
- compare periods должны продолжать передаваться в backend
