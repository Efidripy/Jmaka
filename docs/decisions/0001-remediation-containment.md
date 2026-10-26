# ADR-0001: containment без смены платформы

Статус: принято, 2026-08-12.

## Контекст

Аудит выявил anonymous Production, split read/write JSON races, разные JPEG writers, detached video normalization, публичную queue metadata и небезопасный in-place deploy.

## Решение

- Сохранить ASP.NET Minimal API, Razor и vanilla JS; framework migration не требуется для containment.
- Production fail-closed через Basic Auth; anonymous только явный trusted-network override.
- Перевести state на `AtomicJsonFileStore<T>` с транзакционным `UpdateAsync`, backup и corruption quarantine. SQLite остаётся предпочтительным следующим шагом при multi-process/сложных query.
- Все image outputs публиковать одним canonical JPEG writer: quality 92, sRGB ICC, white alpha flatten, metadata strip, GUID temp.
- Обе FFmpeg-нагрузки выполнять bounded durable hosted queues; queue metadata держать в private `data`.
- Retention выполнять hosted service, не только в request hot path.
- Deploy выполнять через verified staging, backup, readiness и rollback.

## Последствия

Получена обратимая containment-архитектура без большой миграции. Ограничения: ImageSharp не делает настоящее wide-gamut ICC преобразование; JSON store остаётся single-process механизмом; deploy доказан локальными contract tests, но не live Ubuntu запуском.
