# Немедленные шаги для исправления сборки OpenClaw Desktop

## 1. Применить исправления в репозитории

Изменения уже внесены в локальные файлы. Нужно закоммитить и запушить:

```bash
cd openclaw-desktop
git add .
git commit -m "fix: disable node-gyp rebuild, add global icon, skip puppeteer download"
git push origin main
```

## 2. Запустить workflow вручную

1. Перейти в репозитории на GitHub: **Actions** → **Build and Release**.
2. Нажать **Run workflow** → ветка `main` → **Run workflow**.

## 3. Проверить результат

- Дождаться завершения всех трёх jobs (Linux, Windows, macOS).
- Убедиться, что статус зелёный (success).
- Скачать артефакты (если настроена публикация) и проверить их работоспособность.

## 4. Если сборка всё ещё падает

### Ошибка `binding.gyp not found`
- Убедиться, что в `electron-builder.json` установлены:
  ```json
  "npmRebuild": false,
  "nodeGypRebuild": false,
  "skipNodeRebuild": true
  ```

### Ошибка отсутствия иконок
- Создать иконки вручную:
  ```bash
  mkdir -p build
  cp assets/icon.png build/icon.png
  # Для Windows (можно использовать онлайн-конвертер)
  curl -L -o build/icon.ico https://some-converter.com/...
  # Для macOS (можно сгенерировать через iconutil)
  # или временно использовать PNG
  cp assets/icon.png build/icon.icns
  ```

### Ошибки компиляции нативных модулей (если появятся)
- Для Windows добавить шаг установки build tools (в `.github/workflows/build.yml`):
  ```yaml
  - name: Install Windows build tools
    run: choco install -y python visualstudio2019-workload-vctools
  ```
  (Или использовать официальный action `actions/setup-node` с параметром `msvs_version`.)

## 5. После успешной сборки

- Проверить, что артефакты созданы (`dist/`).
- При необходимости настроить автоматическую публикацию (release, auto-update).
- Обновить документацию по сборке.

---  
*Этот список можно использовать как чек‑лист.*