# Whiteboard Engine

Open-source'owa platforma tablic interaktywnych: otwiera i konwertuje projekty z wielu formatów
(Excalidraw, SVG, docelowo draw.io/IWB/…) do wspólnego, edytowalnego modelu, pozwala je edytować,
zapisywać (`.devbrd`) i współdzielić, z możliwością self-hostingu. Pełne założenia: [docs/idea.md](docs/idea.md).

## Struktura (monorepo — idea.md pkt 3.10)

```
packages/            # kod współdzielony, niezależny od środowiska
├─ core/             # ✅ uniwersalny model dokumentu + geometria (źródło prawdy, pkt 3.1)
├─ importers/        # ✅ importery formatów: excalidraw, svg, .devbrd (pkt 3.2) — zależą tylko od core
├─ api-client/       # ✅ typowany klient REST — jedyna droga klientów do backendu (pkt 4A)
├─ engine/ sync/ crypto/ ui/   # ⏳ placeholdery kolejnych warstw
apps/
└─ web/              # aplikacja React/Vite — konsument pakietów @whiteboard/*
server/              # backend FastAPI (Python): auth, tablice, dostępy, konwersja — patrz server/README.md
deploy/              # docker-compose / konfiguracja on-premise
fixtures/ plugins/   # ⏳ korpus plików testowych / pluginy w sandboxie
```

Pakiety współdzielone są publikowane pod scope `@whiteboard/*` (np. `@whiteboard/core`).

## Uruchomienie

- **Web:** `cd apps/web && npm install && npm run dev` (domyślnie łączy się z API na `http://localhost:8000`).
- **Serwer:** instrukcja w [server/README.md](server/README.md) (FastAPI + Postgres; `docker compose` w `deploy/`).

## Rozwiązywanie importów pakietów

Aplikacja web konsumuje pakiety `@whiteboard/*` **jako źródła TypeScript** (bez osobnego kroku
budowania) — rozwiązywane przez alias Vite ([apps/web/vite.config.ts](apps/web/vite.config.ts)) oraz
`paths` w [apps/web/tsconfig.json](apps/web/tsconfig.json). Root [package.json](package.json) deklaruje
`workspaces`; `npm install` w katalogu głównym sformalizuje linkowanie pakietów (npm workspaces).
