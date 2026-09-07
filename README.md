# Brand Hunter Mobile 0.6.1 STABLE

Основа: рабочая 0.6 BACKEND.

Безопасные улучшения:
- более широкий генератор имён;
- больше уникальных комбинаций;
- `seen` пополняется только реально прошедшими локальный фильтр именами;
- более честный счётчик;
- сохранён тот же backend screening, который уже успешно работал на Netlify;
- без deep-screening и без изменений deploy-архитектуры.

Pipeline:
Generate → AI Judge TOP-25 → Netlify Backend Screening → TOP-3 → WINNER.

Для деплоя использовать ту же схему, что с рабочей 0.6.
