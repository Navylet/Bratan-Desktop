# Братан Desktop 🚀

Десктопное приложение OpenClaw для промптинга и решения любых задач. Космолёт с глубоким анализом, интеграциями и без зависаний.

## 🎯 Функционал

### Основное
- **Чат с Братаном** — интеллектуальный ассистент для решения задач
- **Управление OpenClaw Gateway** — запуск/остановка, мониторинг
- **Логи агентов** — реальное время, цветовое кодирование
- **Файловый менеджер** — рабочий пространство `~/.openclaw/workspace`
- **Активные агенты** — мониторинг и создание новых
- **Настройки** — темы, шрифты, автозапуск

### 🧠 Глубокий анализ (без зависаний)
- **PDF анализ** — очередь задач, поддержка больших файлов (5.5 МБ+)
- **Веб-поиск** — через Perplexity API с источниками
- **AI анализ** — очередь для тяжёлых вычислений
- **Монитор задач** — визуализация очередей (PDF, Веб, AI)

### 🔌 Интеграции
- **Google** — Drive, Docs, Calendar, Gmail (OAuth 2.0)
- **GitHub** — репозитории, issues, коммиты (Personal Access Token)
- **Perplexity AI** — интеллектуальный поиск и анализ

### 🚀 Космолётные фичи
- **Системные уведомления** — события, завершение задач
- **Тёмная/светлая тема** — переключение на лету
- **Адаптивный интерфейс** — Tailwind CSS, Font Awesome
- **Горячие клавиши** — быстрый доступ
- **Автосохранение** — токены, настройки

## 🛠 Технологии
- **Electron** — десктопная платформа
- **Node.js** — бэкенд, интеграции
- **Tailwind CSS** — современный UI
- **Google APIs** — Drive, Docs, Calendar, Gmail
- **GitHub API** — Octokit
- **Perplexity API** — веб-поиск и анализ

## 🚀 Запуск в разработке

```bash
cd /home/navylet/.openclaw/workspace/openclaw-desktop
npm install
npm start
```

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
├── main.js                 # Главный процесс Electron
├── preload.js              # Безопасный мост IPC
├── renderer.js             # Логика интерфейса
├── index.html              # Интерфейс (Tailwind)
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
- PDF анализ: `api.tasks.analyzePDF('/path/to.pdf')`
- Веб-поиск: `api.tasks.webSearch('GIGA ARPA платформа')`
- Google авторизация: вкладка "Интеграции"

## 🚀 Планы развития
1. **Редактор файлов** с подсветкой синтаксиса
2. **Встроенный терминал** для команд
3. **Drag-and-drop** загрузка файлов
4. **Плагинная система** для новых интеграций
5. **iOS версия** (React Native + Capacitor)

## 📞 Контакты
- **Разработчик**: Братан AI (🫂)
- **Пользователь**: Дмитрий (CPO GIGA ARPA)
- **Репо**: `/home/navylet/.openclaw/workspace/openclaw-desktop`

---

*Сделано с ❤️ для космолёта промптинга.*
<!-- trigger workflow -->
