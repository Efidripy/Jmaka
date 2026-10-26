# Проект: Jmaka

## Назначение

ASP.NET Core API и web-интерфейс для обработки изображений. Канонический выход — JPEG/sRGB со встроенным ICC-профилем и без EXIF.

## Код

- API: `src/Jmaka.Api/`.
- Тесты: `tests/Jmaka.Api.Tests/`.
- Color management: `docs/COLOR_MANAGEMENT.md`.
- Основной pipeline: `ImagePipelineService.NormalizeToSrgb()`.

## Ограничения

- Не менять ICC/sRGB pipeline без отдельной проверки изображений.
- Сохранять параметры канонического выхода: JPEG quality 92, sRGB ICC, EXIF удалён.
- Изменения API сопровождать тестами.

## Команды

```bash
dotnet build
dotnet run --project src/Jmaka.Api
dotnet test
```

## Связи с workspace

| Слой | Путь |
| --- | --- |
| Карточка | `E:\GitHub\workspace\knowledge\projects\Jmaka.md` |
| Манифест | `E:\GitHub\workspace\control\manifests\projects\Jmaka\Jmaka.md` |
| Логи | `E:\GitHub\workspace\runtime\logs\projects\Jmaka\` |
| State | `E:\GitHub\workspace\runtime\state\projects\Jmaka\` |
| BHM project | `jmaka` |

InstallKit: `E:\GitHub\repos\InstallKit\adapters\jmaka\adapter.sh`.

Стек: C#, .NET 10, ASP.NET Core, ImageSharp, xUnit.
