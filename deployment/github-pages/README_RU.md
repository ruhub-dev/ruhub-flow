# RUHUB Flow: GitHub Pages + сервер на Windows

Постоянный адрес интерфейса: https://ruhub-dev.github.io/ruhub-flow/.
Интерфейс работает здесь без перенаправления. Данные и авторизация обрабатываются сервером на ПК.

`npm ci`, `npm run check`, `npm run build` собирают GitHub-интерфейс в `outputs/github-pages`.
При запуске он читает публичный `connection/current.json` через GitHub Raw. Адрес API меняется в фоне; ключи схем и сессий в этот запрос не включаются.

`npm run selfhost:build` собирает сервер и локальный интерфейс. На ПК используется `START_INTERNET.cmd`, настройка GitHub — `SETUP_GITHUB.cmd`. Существующую базу при обновлении не заменять. Подробности: `deployment/selfhost/PERMANENT_LINK_RU.txt`.

Проверки: `node --test tests/stable-link.test.mjs tests/backend-runtime.test.mjs`; после сборки сервера — `node tests/selfhost.mjs`.
