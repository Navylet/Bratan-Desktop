# IPC Design Improvements

## OpenClaw Desktop (Братан Desktop)

**Дата:** 2026-03-07  
**Архитектор:** Electron Architect

---

## 1. Текущее состояние IPC

### 1.1. Схема коммуникации

```
Renderer Process (UI)
         │
         ▼
    preload.js (contextBridge)
         │
         ▼
    window.api (объект с методами)
         │
         ▼
    Main Process (ipcMain.handle)
         │
         ▼
    Интеграции / Файловая система / TaskManager
```

### 1.2. Существующие IPC‑каналы

Из анализа main.js и preload.js:

- **fs:** чтение/запись файлов, список директорий
- **taskManager:** запуск/остановка задач, статус
- **google:** операции с Google APIs (Drive, Docs, Calendar, Gmail)
- **github:** операции с GitHub API
- **openclaw:** вызовы OpenClaw JS API

### 1.3. Проблемы текущего дизайна

1. **Отсутствие единого формата сообщений:** Каждый хендлер возвращает данные в своём формате.
2. **Нет обработки ошибок:** Исключения не перехватываются, приводят к unhandled rejections.
3. **Нет валидации параметров:** Параметры передаются как есть.
4. **Нет логирования IPC‑вызовов:** Сложно отлаживать.
5. **Нет ограничения частоты вызовов:** Renderer может заспамить main процесс.
6. **Связность:** Renderer знает слишком много о внутренней структуре main.

---

## 2. Цели улучшения

- **Безопасность:** Валидация параметров, проверка отправителя.
- **Надёжность:** Обработка ошибок, retry‑логика.
- **Производительность:** Батчинг, кэширование.
- **Поддерживаемость:** Единый формат сообщений, логирование.
- **Тестируемость:** Mock IPC для unit‑тестов.

---

## 3. Предлагаемая архитектура IPC

### 3.1. Централизованный IPC‑роутер

Создать модуль `ipcRouter.js` в main process, который регистрирует все обработчики и предоставляет единый интерфейс.

```javascript
// main/ipcRouter.js
const { ipcMain } = require('electron');
const Joi = require('joi'); // для валидации

class IPCRouter {
  constructor() {
    this.handlers = new Map();
  }

  register(channel, schema, handler) {
    this.handlers.set(channel, { schema, handler });
    ipcMain.handle(channel, async (event, ...args) => {
      return this.handleRequest(event, channel, ...args);
    });
  }

  async handleRequest(event, channel, ...args) {
    const { schema, handler } = this.handlers.get(channel);

    // Валидация
    const { error, value } = schema.validate(args);
    if (error) {
      return { success: false, error: error.details[0].message };
    }

    // Логирование
    console.log(`[IPC] ${channel} called from ${event.sender.id}`);

    try {
      const result = await handler(event, ...value);
      return { success: true, data: result };
    } catch (err) {
      console.error(`[IPC] ${channel} error:`, err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new IPCRouter();
```

### 3.2. Единый формат ответа

Все IPC‑ответы должны иметь структуру:

```typescript
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { duration: number; timestamp: number };
}
```

### 3.3. Валидация с Joi

Для каждого канала определять схему параметров:

```javascript
// main/ipcSchemas.js
const Joi = require('joi');

module.exports = {
  'fs:readFile': Joi.array().items(Joi.string().min(1).max(1024)).length(1),
  'google:listFiles': Joi.array().items(Joi.string().valid('drive', 'docs')).length(1),
  // ...
};
```

### 3.4. Улучшенный preload

Предоставлять типизированный API с автодополнением (если используется TypeScript) и прокси‑класс для удобства.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fs: {
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  },
  google: {
    listFiles: (type) => ipcRenderer.invoke('google:listFiles', type),
  },
  // ...
});
```

---

## 4. Конкретные улучшения

### 4.1. Обработка ошибок

**Текущая проблема:** Если в хендлере произойдёт исключение, renderer получит unhandled rejection, UI может зависнуть.

**Решение:** Обернуть все хендлеры в try/catch и возвращать структурированную ошибку.

### 4.2. Валидация путей

**Текущая проблема:** `fs:readFile` принимает любой путь, возможен traversal.

**Решение:** Нормализовать путь и проверять, что он находится внутри рабочей директории.

```javascript
const path = require('path');

function safePath(userPath) {
  const resolved = path.resolve(process.cwd(), userPath);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}
```

### 4.3. Батчинг запросов

**Текущая проблема:** Множественные последовательные IPC‑вызовы (например, чтение 100 файлов) создают нагрузку.

**Решение:** Добавить batch‑каналы.

```javascript
// preload
window.api.fs.readMultiple = (paths) => ipcRenderer.invoke('fs:readMultiple', paths);

// main
ipcRouter.register('fs:readMultiple', schema, async (event, paths) => {
  const results = [];
  for (const p of paths) {
    results.push(await fs.promises.readFile(p, 'utf-8'));
  }
  return results;
});
```

### 4.4. Кэширование результатов

**Текущая проблема:** Одинаковые запросы выполняются повторно.

**Решение:** Добавить LRU‑кэш на уровне IPC‑роутера (для идемпотентных операций).

```javascript
const LRU = require('lru-cache');
const cache = new LRU({ max: 100, ttl: 60_000 });

async function handleRequest(event, channel, ...args) {
  const cacheKey = `${channel}:${JSON.stringify(args)}`;
  if (cache.has(cacheKey)) {
    return { success: true, data: cache.get(cacheKey), cached: true };
  }
  // ... выполнение
  cache.set(cacheKey, result);
  return { success: true, data: result, cached: false };
}
```

### 4.5. Логирование и мониторинг

**Текущая проблема:** Невозможно понять, какие IPC‑вызовы происходят в production.

**Решение:** Добавить логирование с уровнем детализации (debug, info, error) и метрики (длительность вызова).

```javascript
const metrics = {
  calls: new Map(),
  errors: 0,
};

// После выполнения хендлера
metrics.calls.set(channel, (metrics.calls.get(channel) || 0) + 1);
```

### 4.6. Rate limiting

**Текущая проблема:** Renderer может заспамить main процесс (намеренно или из-за бага).

**Решение:** Добавить ограничение количества вызовов в единицу времени.

```javascript
const rateLimit = new Map();

function checkRateLimit(senderId, channel) {
  const key = `${senderId}:${channel}`;
  const now = Date.now();
  const window = rateLimit.get(key) || [];
  const recent = window.filter((t) => now - t < 1000); // последняя секунда
  if (recent.length > 10) {
    // максимум 10 вызовов в секунду
    throw new Error('Rate limit exceeded');
  }
  recent.push(now);
  rateLimit.set(key, recent);
}
```

---

## 5. План внедрения

### Фаза 1: Рефакторинг существующих хендлеров (2‑3 дня)

1. Создать `ipcRouter.js` и зарегистрировать все текущие каналы.
2. Добавить единый формат ответа и обработку ошибок.
3. Протестировать, что все функции работают как прежде.

### Фаза 2: Валидация и безопасность (2 дня)

4. Внедрить Joi‑схемы для всех каналов.
5. Добавить безопасные обёртки для путей.
6. Проверить отсутствие regressions.

### Фаза 3: Оптимизации (3‑4 дня)

7. Реализовать батчинг для часто используемых операций.
8. Добавить LRU‑кэш для идемпотентных запросов.
9. Внедрить rate limiting и логирование.

### Фаза 4: Инструменты и мониторинг (1‑2 дня)

10. Создать IPC‑дашборд в UI (только в dev‑режиме) для просмотра метрик.
11. Добавить стресс‑тесты IPC.

---

## 6. Пример конечной реализации

### main.js

```javascript
const { app, BrowserWindow } = require('electron');
const ipcRouter = require('./main/ipcRouter');
const schemas = require('./main/ipcSchemas');

// Регистрация обработчиков
ipcRouter.register('fs:readFile', schemas['fs:readFile'], async (event, [filePath]) => {
  const safe = safePath(filePath);
  const content = await fs.promises.readFile(safe, 'utf-8');
  return content;
});

ipcRouter.register('google:listFiles', schemas['google:listFiles'], async (event, [type]) => {
  const google = await getGoogleIntegration();
  return google.listFiles(type);
});

// ...
```

### preload.js

```javascript
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  fs: {
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    readMultiple: (paths) => ipcRenderer.invoke('fs:readMultiple', paths),
  },
  google: {
    listFiles: (type) => ipcRenderer.invoke('google:listFiles', type),
  },
  // ...
};

contextBridge.exposeInMainWorld('api', api);
```

### renderer.js

```javascript
// Использование
async function loadFile() {
  const result = await window.api.fs.readFile('/path/to/file.txt');
  if (result.success) {
    console.log('File content:', result.data);
  } else {
    console.error('Failed:', result.error);
  }
}
```

---

## 7. Преимущества новой архитектуры

- **Безопасность:** Валидация, безопасные пути, rate limiting.
- **Надёжность:** Обработка ошибок, retry (можно добавить).
- **Производительность:** Кэш, батчинг.
- **Отладка:** Логирование, метрики.
- **Тестируемость:** Mock IPCRouter для unit‑тестов.

---

## 8. Заключение

Текущая IPC‑реализация функциональна, но примитивна. Предложенные изменения повысят безопасность, надёжность и производительность коммуникации между процессами.

Рекомендуется внедрять изменения постепенно, начиная с фазы 1, чтобы не нарушить работу приложения.
