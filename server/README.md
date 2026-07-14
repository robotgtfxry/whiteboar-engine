# Server — Whiteboard Engine API

FastAPI + SQLAlchemy + Postgres. Zakres tej fazy: **Auth / Tablice / Użytkownicy / Dostępy**.

Auth: **prawdziwy JWT** (`app/security.py`, `app/deps.py`). Logowanie `POST /auth/login`
(pole `username` = email) zwraca token Bearer. Konta zakłada **admin** (`POST /users`).
Domyślne konto: `admin@local` / `admin` (zmień przez `ADMIN_PASSWORD`; sekret przez `JWT_SECRET`).

## Uruchomienie (dev)

1. Postgres przez docker-compose (z katalogu `deploy/`):
   ```
   docker compose up postgres
   ```
2. Zależności i serwer (z katalogu `server/`):
   ```
   python -m venv .venv && .venv\Scripts\activate   # Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
3. Dokumentacja API: http://localhost:8000/docs

Alternatywnie całość (baza + API) w kontenerach: `docker compose up --build` z `deploy/`.

## Model danych

- `User` — id, email, display_name, is_admin, created_at
- `Board` — id, title, owner_id, `document` (JSONB — treść tablicy), created_at, updated_at
- `BoardPermission` — board_id, user_id, `level` (read / edit / owner)
- `BoardVersion` — snapshot historii z audytem (board_id, title, document, note, device, created_by, created_at)

## Konwersja formatów (`app/convert/`)

Serwerowe importery formatów źródłowych → uniwersalny model (idea.md pkt 3.2/3.5) — bez
zależności od UI, gotowe do konwersji wsadowej/bezgłowej. Obecnie: **`.excalidraw`** (poziom
wierności 1). Ponad wersję kliencką (`apps/web/src/convert`) importer:

- scala etykiety dowiązane do kształtów (`containerId`) z kontenerem zamiast osobnych węzłów,
- zachowuje grupy (`groupIds`) i dowiązania strzałek (`startBinding`/`endBinding` → `start`/`end`),
- trzyma nierozpoznane elementy (image/frame/…) jako **opaque** z pełnymi danymi źródłowymi
  (`source`) do eksportu wstecznego (pkt 3.1),
- odzyskuje więcej stylu (opacity, strokeStyle, fillStyle, roughness, fontFamily, textAlign, angle, link),
- waliduje wejście i zwraca **ostrzeżenia** o utracie/degradacji danych.

`.devbrd` ma własną ścieżkę (`/boards/import`), `.svg` — na razie po stronie klienta.

## Kontrola dostępu (`app/access.py`)

- admin → zawsze `owner`
- właściciel tablicy → `owner`
- w przeciwnym razie poziom z `BoardPermission` (lub brak dostępu → 403)

## Endpointy

- `/auth` — POST `/login` (email+hasło → token), GET `/me`
- `/users` — GET (zalogowany), POST/PATCH/DELETE (admin), GET/{id}
- `/boards` — GET (widoczne dla użytkownika), POST, GET/{id} (read), PUT/{id} (edit), DELETE/{id} (owner)
- `/boards/import` — POST: tworzy tablicę z wgranego kontenera `.devbrd` (round-trip między urządzeniami)
- `/boards/import-file` — POST (multipart `file`): konwertuje wgrany plik źródłowy (np. `.excalidraw`) i tworzy z niego tablicę
- `/boards/{id}/export` — GET: pobiera tablicę jako plik `.devbrd` (read); `Content-Disposition: attachment`
- `/boards/{id}/versions` — GET (read: lista z audytem kto/urządzenie/obiekty), POST (edit: ręczny snapshot); zapis tablicy tworzy wersję automatycznie. Urządzenie z nagłówka `X-Device`.
- `/boards/{id}/versions/{version_id}` — GET (read: pełna wersja), `/restore` POST (edit: przywróć do wersji)
- `/boards/{id}/permissions` — GET (read), POST (owner), PUT/{user_id} (owner), DELETE/{user_id} (owner)
- `/convert` — POST (multipart `file`): konwertuje plik źródłowy na uniwersalny model (podgląd, bez zapisu); zwraca `document` + `warnings` + `stats`

Wszystkie poza `/auth/login` i `/health` wymagają nagłówka `Authorization: Bearer <token>`.

## Testy

Testy importera i endpointu konwersji nie wymagają bazy (SQLite w pamięci, patrz `tests/conftest.py`):

```
pip install -r requirements-dev.txt
pytest
```

## Do zrobienia dalej

- Kolejne importery serwerowe (`.svg`, `.drawio`, IWB) w `app/convert/` — wspólny rejestr formatów.
- Migracje (Alembic) zamiast `create_all` (zmiana schematu wymaga teraz `docker compose down -v`).
- Odświeżanie/wygasanie tokenów, reset hasła, SSO/LDAP (moduł `auth`).
- Warstwa sync/CRDT (`server/sync-server`).
