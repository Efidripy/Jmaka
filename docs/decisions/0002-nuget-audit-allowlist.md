# ADR-0002: allowlist известных NuGet advisory для SixLabors.ImageSharp 3.1.12

Статус: принято, 2026-10-26. Пересмотреть при смене или замене ImageSharp.

## Контекст

`dotnet list package --vulnerable` находит 5 advisory для `SixLabors.ImageSharp` 3.1.12 (NU1902/NU1903):
GHSA-gwg2-r3hj-4w44, GHSA-j3p4-wp97-rph4, GHSA-j9gm-c75j-xc9q, GHSA-jjfr-hcj7-qf5w, GHSA-wmxv-xphr-5c9g.

Проверено при ревью: версии 3.2.0 и 4.0.0 содержат те же или большее число уязвимостей и не собираются без лицензии Six Labors; версии 4.1.x свободны от advisory, но требуют коммерческий лицензионный ключ (`No Six Labors license found`). Безопасной версии без лицензии нет.

Прежняя CI-проверка падала при любом `vulnerability_count > 0`, поэтому CI и release были бы красными постоянно.

## Решение

- Проверка вынесена в `.github/scripts/nuget-audit.sh`, её вызывают `ci.yml` и `release.yml`.
- Принятые advisory перечислены в `.github/nuget-audit-allowlist.txt` в формате `пакет|версия|GHSA`.
- Проверка падает на любом advisory, которого нет в списке: новый пакет, новая версия `ImageSharp` (в том числе обновление, затронутое другим advisory) или новый GHSA.
- Пакет остаётся на 3.1.12; CI не ослабляется для остальных зависимостей.

## Последствия

Риск не снят: приложение обрабатывает пользовательские изображения уязвимой версией библиотеки. Смягчение: Production закрыт Basic Auth, загрузки ограничены очередью и retention. Выход: лицензия Six Labors и переход на 4.1.x либо замена библиотеки (например, SkiaSharp). После этого очистить allowlist.

Локальная команда `dotnet build -warnaserror` из `OPERATIONS.md` падает на NU1902/NU1903, пока пакет не заменён; CI использует обычную сборку.
