# Эксплуатационный контракт Jmaka

## Доступ

В `Production` сервис закрыт HTTP Basic Auth. Обязательная переменная:

- `JMAKA_AUTH_PASSWORD` — пароль;
- `JMAKA_AUTH_USERNAME` — имя пользователя, по умолчанию `jmaka`.

Анонимный режим разрешается только явным `JMAKA_ALLOW_ANONYMOUS=true` в доверенной изолированной сети. Installer Ubuntu генерирует пароль и сохраняет окружение в `/etc/jmaka/jmaka-<instance>.env` с mode `0600`.

## Хранилище и очереди

- JSON state находится в `<JMAKA_STORAGE_ROOT>/data` и публикуется атомарно с backup/quarantine при повреждении.
- FFmpeg processing queue: `data/ffmpeg-jobs.json`.
- Upload normalization queue: `data/upload-normalize-jobs.json`, bounded capacity `8`.
- После рестарта queued jobs восстанавливаются; прерванные running jobs помечаются `FAILED/service_restarted`.
- `JMAKA_RETENTION_HOURS` задаёт retention, по умолчанию `48` часов. Hosted maintenance удаляет просроченные video/output/temp/passlog/edit-preview и сироты.

## Health

- `GET /health/live` — процесс отвечает.
- `GET /health/ready` — writable storage, JSON stores, OknoFix template и `ffmpeg`/`ffprobe` готовы. При ошибке возвращается `503` с классами failures.

Health endpoints наследуют Production Basic Auth. Скрипты install/update читают credentials из root-only environment file и не печатают Authorization header.

## Обновление

`deploy/ubuntu24/update-instance.sh` требует SHA-256, валидирует архив, распаковывает в staging, делает rename-backup, переключает app, проверяет readiness и автоматически откатывает все переключённые instances при сбое. Live deployment не входит в локальный validation gate.

## Проверки

```powershell
dotnet format Jmaka.slnx --verify-no-changes --no-restore
dotnet build Jmaka.slnx -c Release --no-restore -warnaserror
dotnet test Jmaka.slnx -c Release --no-build --no-restore
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\smoke-api-version.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\deploy-safety-contract.ps1
node .\tests\ui\jmaka-ui-matrix.js
```
