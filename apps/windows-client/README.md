# @whiteboard/windows-client

Natywny klient tablicy dla Windows (Electron + React + TypeScript). Pełna parzystość z
`apps/web` **plus narzędzia rysowania** kształtów.

## Funkcje

- **Logowanie** do backendu (JWT), panel z sidebarem.
- **Tablice** — lista/wyszukiwarka, tworzenie, usuwanie, import/eksport `.devbrd`.
- **Kanwa** — pan/zoom, zaznaczanie/przesuwanie/usuwanie, import plików (`.excalidraw` / `.svg`
  / `.devbrd`) przez przeciągnięcie lub natywne okno, cofnij/ponów (Ctrl+Z / Ctrl+Shift+Z).
- **Rysowanie** — narzędzia: prostokąt (R), elipsa (O), romb (D), tekst (T), strzałka (A),
  linia (L); zaznaczanie (V).
- **Historia wersji** — zapis/przywracanie z audytem urządzenia.
- **Klucze tablicy** — publiczny link pokoju + prywatny sekret (kopiuj/pokaż).
- **Współdzielenie** — nadawanie/odbieranie dostępów (read/edit/owner).
- **Użytkownicy** (admin) i **Konwersja** plików.
- Natywne menu, okna dialogowe plików i otwieranie linków w przeglądarce.

## Uruchomienie

```bash
npm install            # tylko w tym katalogu (NIE w rootcie repo)
npm run dev            # okno Electron + Vite dev
```

Wymaga działającego backendu (domyślnie `http://localhost:8000`). Domyślne konto: `admin@local` / `admin`.

## Build i pakowanie

```bash
npm run typecheck      # tsc (main/preload + renderer)
npm run build          # electron-vite build → out/
npm run dist           # electron-builder → dist/ (.exe: nsis + portable)
```

## Konfiguracja

W aplikacji: **Ustawienia** pozwalają zmienić adres serwera API (`wb_api_url` w localStorage,
wymaga przeładowania), bazowy adres linków pokoju (`wb_share_base`) i nazwę urządzenia.
Alternatywnie zmienną środowiskową `VITE_API_URL` przy buildzie.

## Architektura

- Pakiety `@whiteboard/{core,importers,api-client}` konsumowane jako źródła TS przez **alias
  Vite + `paths` w tsconfig** (jak `apps/web`) — nie jako npm deps; własny `npm install` w tym
  katalogu (bez ruszania rootu).
- `src/main` — proces główny (okno, menu, IPC dialogów plików). `src/preload` — most
  `contextBridge` (`window.desktop`). `src/renderer` — UI React.
