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

## Kontrola dostępu (`app/access.py`)

- admin → zawsze `owner`
- właściciel tablicy → `owner`
- w przeciwnym razie poziom z `BoardPermission` (lub brak dostępu → 403)

## Endpointy

- `/auth` — POST `/login` (email+hasło → token), GET `/me`
- `/users` — GET (zalogowany), POST/PATCH/DELETE (admin), GET/{id}
- `/boards` — GET (widoczne dla użytkownika), POST, GET/{id} (read), PUT/{id} (edit), DELETE/{id} (owner)
- `/boards/{id}/permissions` — GET (read), POST (owner), PUT/{user_id} (owner), DELETE/{user_id} (owner)

Wszystkie poza `/auth/login` i `/health` wymagają nagłówka `Authorization: Bearer <token>`.

## Do zrobienia dalej

- Migracje (Alembic) zamiast `create_all` (zmiana schematu wymaga teraz `docker compose down -v`).
- Odświeżanie/wygasanie tokenów, reset hasła, SSO/LDAP (moduł `auth`).
- Warstwa sync/CRDT (`server/sync-server`).
