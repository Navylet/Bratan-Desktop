# Братан Desktop

Electron-приложение для работы с OpenClaw Gateway: чат, агенты/субагенты, RAG Studio, файлы, интеграции и мониторинг.

## Что реализовано

### Chat Ops

- Отправка сообщений в OpenClaw через WebSocket или CLI fallback.
- Прикрепление файлов в чат (button paperclip): текст файлов и PDF-контекст автоматически добавляются к запросу.
- Выбор `Agent/Subagent ID`, `Session ID`, `Thinking level` на каждый запрос.
- Realtime-индикатор подготовки ответа (typing/progress в стиле мессенджера).
- Потоковые обновления по этапам CLI-запроса (`queued`, `context-prepared`, `gateway-ready`, `stdout/stderr`, `completed`).
- Отдельная панель `Reasoning и trace`: отображение reasoning-фрагментов, meta и runtime-trace.

### Agents Runtime

- Вкладка `Агенты` показывает runtime-агентов и активные сессии.
- Применение агента/сессии в чат одним кликом.
- Журнал trace по этапам выполнения (request start, ws/cli transport, response, errors).

### RAG Studio

- Отдельная вкладка `RAG Studio`.
- Выбор и индексация файлов в локальный индекс (`appData/rag-index.json`).
- Индексация по коллекциям (`default`, `project-a`, etc.).
- Поиск релевантных chunks по запросу.
- Фильтрация поиска/ask по выбранной коллекции.
- `Ask with RAG`: генерация ответа агентом только на основе найденного контекста.
- Экспорт/импорт индекса RAG в JSON.
- Просмотр статуса индекса: число документов/chunks и список документов.

### Additional

- Управление Gateway (start/stop/status).
- Логи Gateway в realtime.
- Файловый менеджер workspace.
- Редактор файлов.
- Интеграции: Google, GitHub, Perplexity.

## 🛠 Технологии

- **Electron** — десктопная платформа
- **Node.js** — бэкенд, интеграции
- **Tailwind CSS** — современный UI
- **Google APIs** — Drive, Docs, Calendar, Gmail
- **GitHub API** — Octokit
- **Perplexity API** — веб-поиск и анализ

## Архитектурные заметки

- `index.js`: main-process, IPC, OpenClaw CLI bridge, RAG index/search/ask.
- `preload.js`: безопасная экспозиция API (`openclaw.*`, `rag.*`, `fs.*`, `tasks.*`, etc.).
- `renderer.js`: UI state, transport orchestration (WS+CLI), attachments, reasoning, RAG UX.
- `src/renderer/src/lib/websocket/openclaw-websocket.js`: JSON-RPC call/notification transport.

## 🚀 Быстрый старт (development)

```bash
cd /home/navylet/.openclaw/workspace/openclaw-desktop
npm install
npm start
```

## 🧩 Интеграция с локальным OpenClaw CLI

1. Убедитесь, что OpenClaw CLI установлен и доступен в PATH:

Windows (PowerShell):
```powershell
where openclaw.exe
openclaw gateway status
```

Linux / Ubuntu / WSL:
```bash
which openclaw
openclaw gateway status
```

2. Если команда не найдена, задайте путь:

Windows:
```powershell
setx OPENCLAW_PATH "C:\\Program Files\\OpenClaw\\openclaw.exe"
```

Linux/WSL:
```bash
export OPENCLAW_PATH="/usr/local/bin/openclaw"
# или ваш путь из Ubuntu:
export OPENCLAW_PATH="/home/navylet/.local/bin/openclaw"
# если вы запускаете Electron на Windows и openclaw установлен внутри WSL:
setx OPENCLAW_PATH "wsl /home/navylet/.local/bin/openclaw"
```
3. В UI приложения в настройках задайте:
   - `CLI Path` → путь к `openclaw` (или `wsl openclaw` для WSL)
   - `Gateway Port` → `18789`

4. Нажмите `Сохранить`, затем меню `Сервер` → `Запустить Gateway`.

5. Проверьте логи и статус: `Gateway запущен` / `Gateway не запущен`.

## Использование новых функций

### 1. Отправка файлов в чат

1. На вкладке `Чат` нажмите paperclip.
2. Выберите файлы.
3. При необходимости задайте `Agent/Subagent ID`, `Session ID`, `Thinking`.
4. Отправьте сообщение (или только файлы).

### 2. Работа по агентам/субагентам

1. Откройте вкладку `Агенты`.
2. Нажмите `Обновить` в блоке runtime.
3. Выберите агента или session из списка: значения применятся в чат.
4. Отправьте запрос из чата и откройте панель reasoning/trace.

### 3. RAG Studio

1. Откройте вкладку `RAG Studio`.
2. Укажите коллекцию, нажмите `Выбрать файлы`, затем `Индексировать`.
3. Для retrieval-only: `Только поиск`.
4. Для ответа агента: `Спросить агента по RAG`.
5. Для переносимости базы: `Экспорт` / `Импорт`.

### 4. Realtime статус ответа

- Во время генерации ответа в чате показывается live-status и typing-индикатор.
- При нотификациях progress из gateway стадия обновляется в реальном времени.
- Для CLI-транспорта показываются stream-этапы и частичные stdout/stderr chunk-обновления.

## 📦 Сборка

### Windows (.exe)

```bash
npm run dist:win
```

### Linux (AppImage)

```bash
npm run dist:linux
```

### macOS (.dmg)

```bash
npm run dist:mac
```

## 🔧 Настройка интеграций

### Google API

1. Создайте проект в Google Cloud Console
2. Включите APIs: Drive, Docs, Calendar, Gmail
3. Создайте OAuth 2.0 Client ID (Desktop app)
4. Сохраните `credentials/google-credentials.json`

### GitHub

1. Создайте Personal Access Token (scopes: `repo`, `read:user`)
2. Приложение автоматически сохранит токен

### Perplexity API

Добавьте переменную окружения:

```bash
export PERPLEXITY_API_KEY="pplx-..."
```

## 📁 Структура проекта

```
openclaw-desktop/
├── index.js                # Главный процесс Electron + IPC + RAG backend
├── preload.js              # Безопасный мост IPC
├── renderer.js             # Логика UI: чат/агенты/RAG/reasoning
├── index.html              # Интерфейс вкладок (включая RAG Studio)
├── taskManager.js          # Очереди задач (PDF, Веб, AI)
├── integrations/           # Google, GitHub API
│   ├── google.js
│   └── github.js
├── tokens/                 # Сохранённые токены
├── credentials/            # OAuth credentials
├── assets/                 # Иконки, изображения
└── package.json
```

## 🧪 Тестирование

- Запуск Gateway: кнопка "Запустить" в верхней панели
- Чат с вложением: paperclip -> send
- Runtime агент/сессия: вкладка `Агенты` -> apply -> send
- RAG индекс/поиск/ask: вкладка `RAG Studio`
- PDF анализ: `api.tasks.analyzePDF('/path/to.pdf')`
- Веб-поиск: `api.tasks.webSearch('GIGA ARPA платформа')`
- Google авторизация: вкладка "Интеграции"

## Ограничения текущей версии

- Reasoning зависит от того, что реально возвращает выбранный provider/model.
- Индекс RAG локальный и lightweight (token-overlap scoring), без внешней vector DB.
- Для бинарных форматов (кроме PDF) автo-экстракция текста ограничена.

## 📞 Контакты

- **Разработчик**: Братан AI (🫂)
- **Пользователь**: Дмитрий (CPO GIGA ARPA)
- **Репо**: `/home/navylet/.openclaw/workspace/openclaw-desktop`

---

_Сделано для production-режима работы с OpenClaw: chat + agents + RAG._

<!-- trigger workflow -->
