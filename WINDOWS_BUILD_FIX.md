# Исправление сборки Windows для OpenClaw Desktop (Electron + electron-builder)

## Контекст проблемы
Сборка Windows в GitHub Actions падает с ошибкой:
```
configuration has an unknown property 'main'
```

Ошибка возникает из-за того, что electron-builder версии 26.8.1 интерпретирует поле `"main"` в корне `package.json` как часть конфигурации сборки, хотя это стандартное поле Node.js для указания точки входа.

## Анализ
- Репозиторий: Navylet/Bratan-Desktop
- Workflow: `.github/workflows/build.yml`
- Job: `build-windows`
- Версия electron-builder: 26.8.1
- Конфигурация сборки находится в `package.json` (раздел `"build"`)

## Пошаговое исправление

### 1. Исправить точку входа в package.json
Файл `package.json` содержит поле `"main": "main.js"`, но файл `main.js` отсутствует. Правильная точка входа — `index.js`.

**Изменить в `package.json`:**
```json
"main": "index.js",
```

### 2. Удалить старые backup-файлы конфигурации
Файлы `electron-builder.json.backup` и `electron-builder.json.backup2` содержат устаревшую конфигурацию и могут быть ошибочно прочитаны electron-builder. Удалите их:

```bash
rm electron-builder.json.backup electron-builder.json.backup2
```

### 3. Создать отдельный файл конфигурации electron-builder.json
Чтобы избежать конфликтов с полем `"main"` в package.json, вынесите конфигурацию сборки в отдельный файл `electron-builder.json`.

**Создать файл `electron-builder.json` в корне проекта:**
```bash
cat package.json | jq '.build' > electron-builder.json
```

Содержимое файла должно соответствовать текущей конфигурации сборки. Убедитесь, что в нём нет свойства `"main"` в корне.

### 4. Отключить подпись кода для Windows (опционально)
Если у вас нет сертификата для подписи Windows-приложений, добавьте `"sign": null` в конфигурацию Windows, чтобы electron-builder не пытался подписать приложение.

**В `electron-builder.json` изменить секцию `"win"`:**
```json
"win": {
  "target": "nsis",
  "sign": null
},
```

### 5. Проверить список файлов для упаковки
В конфигурации `"files"` должны быть перечислены все необходимые файлы, включая точку входа (`index.js`), рендерер (`renderer.js`), preload-скрипты и другие ресурсы.

Текущая конфигурация включает:
```json
"files": [
  "index.js",
  "renderer.js",
  "preload.js",
  "node_modules/",
  "package.json",
  "build/"
]
```
Убедитесь, что файл `main.js` не указан, если он не существует.

### 6. Убедиться в наличии необходимых инструментов на GitHub Actions runner
В workflow используется `windows-latest`, который включает:
- Node.js (устанавливается через actions/setup-node)
- NSIS (установлен по умолчанию)
- Все необходимые системные библиотеки для сборки Electron

Дополнительная установка Wine не требуется, так как сборка выполняется на native Windows runner.

### 7. Обновить workflow (при необходимости)
Если в будущем потребуется сборка Windows на Linux runner (кросс-компиляция), добавьте установку Wine:

```yaml
- name: Set up Wine (for cross‑compilation)
  if: runner.os == 'Linux'
  run: |
    sudo dpkg --add-architecture i386
    sudo apt-get update
    sudo apt-get install -y wine wine32
```

### 8. Пересобрать native модули (если есть)
Если проект использует native Node.js модули, их нужно пересобрать под целевую платформу. В конфигурации сейчас установлено `"npmRebuild": false` и `"nodeGypRebuild": false`. Если возникают ошибки, связанные с native модулями, измените эти параметры на `true` или добавьте в workflow шаг:

```yaml
- name: Rebuild native modules
  run: npm rebuild
```

## Проверка исправлений
После внесения изменений выполните:

1. Закоммитьте изменения и запустите workflow вручную или через push.
2. Проверьте логи job `build-windows` на отсутствие ошибки `configuration has an unknown property 'main'`.
3. Убедитесь, что сборка завершается успешно и артефакты создаются.

## Ссылки на документацию
- [Electron Builder Configuration](https://www.electron.build/configuration/configuration)
- [Electron Builder Windows Target](https://www.electron.build/configuration/win)
- [GitHub Actions Windows Runner](https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners#supported-runners-and-hardware-resources)

## Резюме
Основная причина падения сборки — конфликт поля `"main"` в package.json с конфигурацией electron-builder. Вынос конфигурации в отдельный файл и исправление точки входа решают проблему. Дополнительные меры (отключение подписи, проверка файлов) обеспечат стабильную сборку.