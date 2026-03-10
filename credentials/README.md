# Настройка интеграций

## Google API

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com).
2. Включите API: Drive, Docs, Calendar, Gmail.
3. Создайте OAuth 2.0 Client ID (тип "Desktop app").
4. Скачайте JSON и сохраните как `google-credentials.json` в этой папке.

Структура файла:

```json
{
  "client_id": "...",
  "client_secret": "...",
  "redirect_uris": ["http://localhost:3000/oauth2callback"]
}
```

## GitHub Personal Access Token

1. Создайте токен в [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).
2. Минимальные scope: `repo`, `read:user`, `user:email`.
3. Сохраните токен в `tokens/github.json`:

```json
{
  "token": "ghp_..."
}
```

## Perplexity API

1. Получите API ключ на [perplexity.ai](https://www.perplexity.ai/api).
2. Добавьте в переменные окружения:

```bash
export PERPLEXITY_API_KEY="pplx-..."
```

## OpenClaw

Приложение автоматически использует установленный OpenClaw CLI.
Убедитесь, что `openclaw` доступен в PATH.
