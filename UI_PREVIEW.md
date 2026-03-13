# Интерфейс «Братан Desktop»

## Общий вид

- Левая вертикальная навигация: `Chat`, `Logs`, `Files`, `Editor`, `Agents`, `RAG Studio`, `Integrations`, `Settings`.
- Верхняя панель: статус Gateway + кнопки `Запустить`/`Остановить`.
- Контентная область: активная вкладка + живой статус транспорта (`Онлайн` / `Онлайн через CLI` / `Офлайн`).

## Вкладки и новые зоны

### 1. Чат

- История сообщений (user/assistant cards).
- `Paperclip` для прикрепления файлов к запросу.
- Runtime-контролы запроса:
	- `Agent / Subagent ID`
	- `Session ID`
	- `Thinking`
	- `Показать reasoning/trace`
- Realtime блок `Готовлю ответ...` с анимированным typing-индикатором.
- Дополнительно: stream-обновления этапов/чанков для CLI-транспорта.
- Панель `Reasoning и trace текущего ответа`.

### 2. Логи

- Реaltime лог Gateway (`stdout`/`stderr`).
- Очистка и сохранение логов.

### 3. Файлы

- Workspace browser (`~/.openclaw/workspace` или WSL UNC path).
- Открытие файла в редакторе / папки в файловом менеджере.

### 4. Редактор

- CodeMirror-based editing flow.
- Save, close, theme/lang selection.

### 5. Агенты

- Карточки агентов (статические + runtime блок).
- Runtime блок:
	- список агентов/субагентов
	- список активных session IDs
	- click-to-apply в чатовые поля
- Отдельная панель `Reasoning / Trace` для отладки работы агентов.

### 6. RAG Studio (новая вкладка)

- Индексация:
	- выбор файлов
	- выбор коллекции
	- запуск индексации
	- refresh/clear индекса
	- export/import индекса
	- просмотр документов и числа chunks
- Retrieval:
	- `Только поиск` (top-k релевантных chunk-ов)
	- `Спросить агента по RAG` (ответ LLM на основе retrieval-контекста)
- Realtime статус выполнения RAG-операций.

### 7. Интеграции

- Google / GitHub / Perplexity / PDF-tools.

### 8. Настройки

- CLI path, Gateway port, notifications, theme/font.
- Chat runtime настройки сохраняются в localStorage и восстанавливаются на старте.

## UX-поведение realtime

- До ответа агента отображается typing-card с анимированными точками.
- При progress/typing нотификациях из Gateway состояние в чате обновляется в реальном времени.
- После получения финального ответа typing-card удаляется, ответ вставляется как обычное сообщение.

## Горячие клавиши вкладок

- `Ctrl+1` → Chat
- `Ctrl+2` → Logs
- `Ctrl+3` → Files
- `Ctrl+4` → Editor
- `Ctrl+5` → Agents
- `Ctrl+6` → RAG Studio
- `Ctrl+7` → Integrations
- `Ctrl+8` → Settings

---

Интерфейс реализован на Electron + Tailwind CSS + plain JS runtime orchestration.
