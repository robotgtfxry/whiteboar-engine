# Uniwersalna platforma tablic interaktywnych — dokument założycielski

## 1. Misja projektu

Rynek tablic interaktywnych i narzędzi do tablic online (whiteboardów) jest mocno rozdrobniony — dziesiątki producentów sprzętu (Samsung, BenQ, Promethean, SMART, Mimio i inni) oraz dziesiątki aplikacji (Excalidraw, draw.io, Miro, FigJam, Mural) używają niekompatybilnych, często zamkniętych formatów. W praktyce prowadzi to do sytuacji, w której organizacja z wieloma siedzibami (np. jedna lokalizacja z tablicami Samsung, druga z innym sprzętem) nie ma wspólnego sposobu na przenoszenie, łączenie i wspólną edycję pracy zespołów.

**Cel projektu**: stworzyć open-source'ową platformę, która:
- otwiera i konwertuje projekty z wielu formatów tablic/narzędzi do wspólnego, edytowalnego modelu,
- pozwala edytować, zapisywać i współdzielić te projekty niezależnie od pochodzenia,
- działa jako aplikacja webowa, desktopowa (Windows i inne) oraz mobilna,
- może być hostowana we własnej, prywatnej sieci (on-premise), nie tylko jako chmura SaaS.

---

## 2. Kluczowy problem: eksport jako "zdjęcie" zamiast danych

Większość tablic i narzędzi eksportuje do PDF, ale w wielu przypadkach jest to **rasteryzacja** (zrzut ekranu zapisany jako PDF) — bez możliwości odzyskania kształtów, tekstu czy struktury. Projekt musi jasno rozróżniać poziomy wierności importu:

| Poziom | Źródło | Co się odzyskuje |
|---|---|---|
| 1. Natywny format / API | np. plugin CAD do DXF/DWG, IWB/CFF, .excalidraw, .drawio | Pełna struktura i semantyka (kształty, tekst, warstwy, czasem relacje/wymiary) |
| 2. PDF wektorowy | eksport programowy z narzędzia | Geometria i tekst jako edytowalne obiekty, ale bez semantyki (np. wymiar CAD staje się "martwą" linią + tekstem, nie żywym obiektem) |
| 3. PDF rastrowy / zrzut ekranu | zrzuty, skany | Tylko obraz w tle — do adnotowania, nie do edycji struktury |

Zasada projektowa: **UI zawsze informuje użytkownika, na którym poziomie wierności znajduje się dany import**, żeby nie obiecywać funkcji, których dany plik nie może mieć.

---

## 3. Architektura — warstwy systemu

### 3.1 Uniwersalny model dokumentu (rdzeń)
Wspólna, wewnętrzna reprezentacja tablicy, niezależna od formatu źródłowego:
- węzły: kształty, tekst, obrazy, sticky notes, węzły mapy myśli,
- krawędzie/połączenia (w tym punkty zaczepienia, ważne np. dla draw.io),
- grupy i warstwy,
- style (kolor, grubość, czcionka),
- pole `shapeType` / `shapeLibrary` dla kształtów specjalistycznych (np. `"drawio:uml.class"`), żeby nierozpoznane elementy dało się zachować jako tzw. **opaque shape** — wizualnie poprawny (renderowany z oryginalnych danych wektorowych, nie jako zrzut ekranu), ale z zachowanymi danymi źródłowymi na wypadek eksportu z powrotem do formatu oryginalnego.

Cała reszta systemu (importery, eksportery, edytor) operuje na tym modelu — to jedyny element, który *musi* być zaprojektowany bardzo starannie od początku.

### 3.2 System importu/eksportu (pluginy formatów)
Każdy format = osobny, modularny plugin tłumaczący dane na/z uniwersalnego modelu. Priorytety na start:

**Formaty otwarte / z dobrą dokumentacją (najniższe ryzyko):**
- `.excalidraw` (JSON, w pełni otwarty)
- `.drawio` (XML, w pełni otwarty)
- SVG (uniwersalny format wymiany)
- **IWB/CFF (`.iwb`)** — otwarty standard 1EdTech (dawniej Becta/IMS Global) do tablic edukacyjnych, oparty o SVG + własne tagi XML. Obsługiwany (przynajmniej częściowo) przez Samsung, BenQ EZWrite, Promethean ActivInspire, SMART Notebook, Mimio i inne. **To pojedynczy plugin, który potencjalnie otwiera od razu bardzo dużą grupę producentów sprzętu edukacyjnego** — wysoki priorytet.
  - Uwaga: mimo formalnej standaryzacji, różni producenci różnie go implementują (rozszerzenia, częściowa zgodność) — importer musi być odporny na warianty i wymaga testów na realnych plikach z konkretnych urządzeń.

**Formaty przez API (średnie ryzyko, wymagają integracji i utrzymania):**
- Miro (REST API)
- FigJam/Figma (API)
- Microsoft Whiteboard/Teams (Microsoft Graph API, eksport SVG wektorowy — wysoka wierność)
- Zoom Whiteboard (REST API + webhooki, możliwa integracja live; eksport PDF)

**Formaty zamknięte/nieudokumentowane (wysokie ryzyko, do oceny per przypadek):**
- własne formaty producentów bez publicznej dokumentacji — traktowane jako `opaque` (obraz/tło) do czasu ew. reverse-engineeringu.

**PDF** — osobny importer działający na dwóch trybach: parsowanie wektorowe (ścieżki + tekst) i fallback rastrowy (obraz w tle), z jasnym komunikatem dla użytkownika, który tryb został użyty.

### 3.3 Silnik edycji / renderowania
- Nie budować od zera — oprzeć się na sprawdzonym, otwartym silniku canvas (np. rdzeń Excalidraw lub tldraw, oba MIT) i rozbudować go pod uniwersalny model.
- Warstwa abstrakcji wejścia (`InputSample`: `{x, y, pressure?, tilt?, timestamp}`) oparta na standardzie Pointer Events — działa spójnie w przeglądarce, Electron/Tauri i (częściowo) na urządzeniach mobilnych. Brak nacisku/tiltu w danych = łagodny fallback (stała grubość linii), nie błąd.

### 3.4 Współdzielenie i synchronizacja
- CRDT (np. Yjs) jako podstawa edycji współbieżnej — rozwiązuje konflikty automatycznie, sprawdzony wzorzec w tej klasie narzędzi.
- Serwer synchronizacji (np. własny serwer WebSocket / Hocuspocus).

### 3.5 Backend i self-hosting (wymóg architektoniczny, nie dodatek)
- Cały backend jako kontenery (Docker/docker-compose, docelowo Helm chart) — serwer sync, baza (Postgres), storage plików S3-kompatybilny (np. MinIO) do trzymania danych lokalnie w firmie.
- Auth jako moduł wymienny: SSO/LDAP/Active Directory jako opcja dla wdrożeń firmowych.
- Brak twardej zależności od internetu do działania podstawowych funkcji; opcjonalny lokalny/offline rejestr pluginów dla środowisk odciętych od sieci.
- Do decyzji: licencja (MIT/Apache = pełna swoboda hostowania przez każdego, w tym komercyjnie; AGPL = wymusza otwartość zmian u każdego, kto hostuje własny SaaS na tym kodzie) — wybór wpłynie na to, jaki ekosystem wokół projektu powstanie.

### 3.6 System pluginów (rozszerzalność)
Trzy kategorie pluginów, każdy w sandboxie (iframe/Web Worker + ograniczone, deklarowane w manifeście uprawnienia — istotne w kontekście sieci firmowych, gdzie wyciek danych przez plugin musi być niemożliwy):
1. **Pluginy formatu/importu** — jak wyżej (IWB, CAD/DXF, itd.).
2. **Pluginy integracji ze źródłami danych** — np. serwery dokumentacji technicznej, wiki firmowe: wciąganie dokumentów jako obiektów z linkiem do źródła, komentowanie/dyskusja przypięta do elementu na tablicy, opcjonalne powiadamianie o zmianach w źródle.
3. **Pluginy narzędziowe** — nowe kształty, narzędzia rysunku, dodatkowe eksporty.

---

## 3.7 Natywny format zapisu i szyfrowanie

Własny format zapisu **`.devbrd`** jako podstawowy sposób zapisu/eksportu projektu z platformy. W pierwszej wersji to **zaawansowany kontener JSON** (nagłówek `format`, `version` schematu, `meta` oraz `document` z uniwersalnym modelem) — prosty, czytelny i wersjonowany. Docelowo może ewoluować do kontenera ZIP (JSON + załączniki/obrazy w środku, podobnie jak `.docx`), gdy pojawi się potrzeba trzymania zasobów binarnych obok modelu.

> Stan implementacji: format `.devbrd` jest już zaimplementowany w kliencie web — eksport i import (round-trip), z kontrolą wersji schematu (import odrzuca pliki nowsze niż obsługiwana wersja). Docelowo logika przeniesie się do `packages/core` i `packages/crypto`.

Dwa niezależne poziomy szyfrowania do rozważenia:

- **Szyfrowanie pliku (at-rest)** — kontener szyfrowany AES z hasłem/kluczem przy zapisie na dysk lub nośnik wymienny (pendrive). Chroni plik, jeśli fizyczny nośnik zostanie zgubiony lub skradziony. Prosty do wdrożenia, niezależny od reszty systemu — dobry punkt startowy, szczególnie istotny dla wdrożeń on-premise z wrażliwymi danymi (np. CAD).
- **Szyfrowanie end-to-end / zero-knowledge (dla wersji chmurowej)** — dane na serwerze szyfrowane tak, że operator platformy nie ma dostępu do treści, tylko posiadacze klucza (zespół/organizacja). Szyfrowanie/deszyfrowanie po stronie klienta. Kompromis: utrudnia lub wyklucza funkcje serwerowe zależne od treści (wyszukiwanie pełnotekstowe, generowanie miniatur na liście projektów) — wymaga świadomej decyzji projektowej, dla kogo ta funkcja jest (np. jako opcja dla klientów o podwyższonych wymaganiach bezpieczeństwa, nie tryb domyślny).

---

## 3.8 Integracja z tablicami ze spotkań online (Teams, Zoom)

Kolejna kategoria źródeł, obok tablic fizycznych i aplikacji desktopowych — tablice używane podczas wideokonferencji. Ważne jest rozróżnienie dwóch niezależnych tematów, które łatwo pomylić:

**A) Odczyt/import zawartości z natywnego Whiteboard danej platformy spotkań**

- **Microsoft Whiteboard (Teams)** — dostęp przez Microsoft Graph API do zasobów Whiteboard, z eksportem do PNG lub **SVG (wektorowy)**. Ważne zastrzeżenie: to dostęp **asynchroniczny/na żądanie** ("pobierz aktualny stan tablicy, kiedy chcesz"), nie ma potwierdzenia, że zasób "whiteboard" wspiera mechanizm subskrypcji/webhooków Graph API dający żywy strumień zdarzeń w czasie rzeczywistym. W praktyce oznacza to import okresowy albo na żądanie, nie prawdziwy live-sync z natywną tablicą Teams.
- **Zoom Whiteboard** — osobne REST API do tworzenia/zarządzania tablicami oraz **udokumentowane webhooki** informujące o nowej zawartości pojawiającej się na tablicy podczas spotkania — to daje realną szansę na integrację bliższą "na żywo" (do zweryfikowania w praktyce co do rzeczywistych opóźnień i ograniczeń). Dodatkowo eksport do PDF z poziomu Video SDK.

Wniosek: prawdziwa integracja live z *natywną* tablicą jest bardziej realna dla Zoom niż dla Teams. Dla Teams realistyczny zakres to import po zakończeniu spotkania lub na żądanie użytkownika, nie ciągła synchronizacja.

**B) Uruchomienie własnej platformy w trakcie spotkania (nie integracja z cudzym Whiteboard)**

To odrębny temat — scenariusz "dołączam do spotkania i chcę załadować swój projekt z serwera", opisany w kolejnej sekcji. Nie polega na podłączeniu się pod natywny Whiteboard, tylko na uruchomieniu Twojej własnej aplikacji obok lub wewnątrz okna spotkania.

Oba tematy z punktu A pasują do już zaplanowanej kategorii "pluginy importu/integracji ze źródłami danych" w architekturze pluginów (pkt 3.6).

---

## 3.9 Uruchomienie platformy podczas spotkania (scenariusz użytkownika)

Odrębna kwestia od importu z natywnej tablicy (pkt 3.8) — chodzi o to, żeby uczestnicy mogli w trakcie spotkania załadować i wspólnie edytować własny projekt z serwera platformy:

- **Wariant podstawowy (zero integracji z Teams/Zoom)**: uczestnicy po prostu otwierają aplikację webową/desktopową w osobnym oknie obok spotkania, logują się i wybierają projekt — działa to identycznie na każdej platformie spotkań, bo cała synchronizacja na żywo idzie przez własną warstwę CRDT platformy (pkt 3.4), niezależnie od Teams/Zoom. Zerowy koszt integracyjny, dobry punkt startowy (MVP).
- **Wariant głębszy (appka osadzona w oknie spotkania)**: rejestracja platformy jako aplikacji Teams (manifest, kontekst `meetingStage`/`meetingSidePanel`) — appka renderuje się jako iframe wewnątrz Teams, obok (nie zamiast) natywnego Whiteboard czy PowerPoint Live. Microsoft udostępnia do tego Live Share SDK (oparty o Fluid Framework, darmowa hostowana synchronizacja), ale **rekomendowane jest niekorzystanie z niego jako głównego mechanizmu synchronizacji** — działa on wyłącznie wewnątrz Teams, więc oparcie na nim całej logiki współdzielenia oznaczałoby budowanie osobnej warstwy sync dla każdej platformy spotkań (Zoom, web, desktop) zamiast jednej wspólnej. Lepiej: appka w Teams to tylko "opakowanie" (manifest + iframe), a dane nadal płyną przez własną warstwę CRDT platformy, spójną wszędzie.

---

## 3.10 Struktura repozytorium i podział na moduły

Ponieważ warstwy z pkt 3.1–3.9 współdzielą jeden model danych i mają być wielokrotnie używane przez **rodzinę klientów** (web, desktop, tablica dotykowa, mobile) oraz serwer, naturalnym układem jest **monorepo** (np. pnpm/Turborepo) z wyraźnym rozdziałem „logika niezależna od środowiska" vs „konkretna aplikacja". Podział to nie tylko porządek w katalogach — to granice, które wymuszają, żeby rdzeń nie zależał od przeglądarki ani od serwera, i żeby dodanie kolejnego klienta nie oznaczało duplikacji logiki (szerzej: pkt 4A).

Proponowany szkielet (nazwy poglądowe, do doprecyzowania):

```
whiteboard-engine/
├─ packages/                # kod współdzielony, niezależny od środowiska
│  ├─ core/                 # uniwersalny model dokumentu (pkt 3.1) — źródło prawdy,
│  │                        #   zero zależności od DOM/serwera; typy, walidacja, wersjonowanie schematu
│  ├─ api-client/           # typowany klient REST API — wspólny dla WSZYSTKICH klientów (pkt 4A)
│  ├─ importers/            # pluginy formatów (pkt 3.2): excalidraw, drawio, svg, iwb, pdf, cad…
│  │                        #   każdy importer: plik źródłowy → core, i odwrotnie (eksport)
│  ├─ engine/               # silnik edycji/renderowania (pkt 3.3) na bazie tldraw/Excalidraw-core
│  ├─ sync/                 # warstwa CRDT (pkt 3.4): mapowanie core ↔ Yjs, klient WebSocket
│  ├─ crypto/               # szyfrowanie kontenera .devbrd i E2E (pkt 3.7)
│  └─ ui/                   # KLOCKI UI: toolbar, panele, host canvasu, badge wierności, dialogi
│     └─ profiles/          # gotowe kompozycje klocków: desktop / touch-board / compact (pkt 4A)
├─ apps/                    # konkretne aplikacje klienckie — SKŁADAJĄ klocki, nie zawierają logiki (pkt 4A)
│  ├─ web/                  # React/Vite — główny cel; składa profil desktop + touch
│  ├─ desktop/              # opakowanie Tauri/Electron nad apps/web (ten sam skład)
│  ├─ board-kiosk/          # OSOBNY program: profil dotykowy, okrojony, dla tablic kioskowych
│  └─ mobile/               # React Native + Skia lub WebView (późniejsza faza)
├─ server/                  # backend self-hostowalny (pkt 3.5)
│  ├─ api/                  # REST/HTTP: projekty, użytkownicy, uprawnienia, upload plików
│  ├─ sync-server/          # serwer WebSocket / Hocuspocus dla CRDT
│  ├─ auth/                 # moduł wymienny: lokalne konta / SSO / LDAP / AD
│  ├─ storage/              # abstrakcja nad Postgres + S3-kompatybilnym storage (MinIO)
│  └─ admin-console/        # konsola administracyjna w stylu BIOS/TUI (pkt 3.11)
├─ plugins/                 # pluginy uruchamiane w sandboxie (pkt 3.6) — osobno od core
├─ deploy/                  # docker-compose, Helm chart, konfiguracja on-premise
├─ fixtures/                # korpus realnych plików testowych per format (pkt 5.1)
└─ docs/                    # ten dokument i dalsza dokumentacja
```

Zasady wiążące ten układ:
- **`packages/core` nie importuje niczego z `apps/`, `server/` ani z przeglądarki.** To gwarantuje, że model działa tak samo w każdym kliencie, na serwerze (np. przy konwersji wsadowej) i w testach.
- **Importery zależą wyłącznie od `core`**, nie od silnika renderującego — dzięki temu konwersja pliku nie wymaga uruchamiania UI.
- **`packages/api-client` jest jedyną drogą klientów do backendu** — wszystkie aplikacje z `apps/` (i ewentualni klienci zewnętrzni) konsumują ten sam, typowany kontrakt. Backend nie odróżnia jednego klienta od drugiego.
- **`apps/*` nie zawierają logiki — tylko wybierają, które klocki `packages/ui` i który profil złożyć** (pkt 4A). Dodanie „specjalnej wersji dla tablicy X" = nowy folder w `apps/` + kilka linii kompozycji, zero duplikacji.
- **Klient i serwer dzielą typy modelu z `core`**, więc zmiana modelu propaguje się typami, a nie ręcznym utrzymywaniem dwóch definicji.

---

## 3.11 Konsola administracyjna serwera (tryb „BIOS-like" / TUI)

Osobny „klient" innego rodzaju niż aplikacje z pkt 4A — nie do rysowania, tylko do **zarządzania instalacją on-premise**. Dla wdrożeń firmowych (pkt 3.5) administrator potrzebuje panelu sterowania serwerem, który działa **niezależnie od głównej aplikacji graficznej i od internetu** — najlepiej lokalnie, na terminalu serwera lub przez SSH, w środowiskach odciętych od sieci.

Forma: **pseudo-graficzny interfejs tekstowy (TUI) w stylu starego BIOS-a / setupu** — ramki, menu, obsługa strzałkami i klawiaturą, brak wymogu przeglądarki czy myszy. To celowy wybór: taki interfejs działa wszędzie (goła konsola, SSH, KVM), jest lekki i pasuje do maszyny serwerowej bez środowiska graficznego.

Zakres funkcji konsoli:
- **Dostęp w sieci firmowej** — konfiguracja nasłuchu (adresy/porty), reguły dostępu do serwera w obrębie sieci lokalnej, tryb offline/air-gapped, lokalny rejestr pluginów (pkt 3.5–3.6).
- **Lista tablic (projektów)** — przegląd wszystkich tablic na serwerze, właściciel, rozmiar, data, opcje archiwizacji/usunięcia (usuwanie zawsze z potwierdzeniem).
- **Lista użytkowników** — konta lokalne oraz zmapowane z SSO/LDAP/AD (pkt 3.5); przegląd, blokowanie, reset.
- **Lista i zarządzanie dostępami (uprawnieniami)** — kto ma dostęp do której tablicy i na jakim poziomie (odczyt/edycja/właściciel), zarządzanie rolami i grupami.
- **Zarządzanie użytkownikami** — tworzenie/edycja kont, przypisywanie do grup/ról, integracja z modułem `auth`.
- **Stan i utrzymanie serwera** — status usług (`api`, `sync-server`, baza, storage), kopie zapasowe, podgląd logów.

Uwaga architektoniczna: konsola **nie zawiera własnej logiki biznesowej** — jest kolejnym konsumentem tego samego API/warstwy serwerowej co reszta systemu (spójnie z zasadą „shell = kompozycja, nie logika" z pkt 4A), tyle że renderowanym w trybie tekstowym. Uprawnienia administracyjne są wymagane i osobne od zwykłych kont (najwyższy poziom dostępu).

---

## 4. Platformy klienckie

Strategia: **web-first**, potem pozostałe środowiska jako pochodne tego samego silnika.

1. **Web** — aplikacja React/Vite, główny silnik renderujący.
2. **Desktop (Windows i inne)** — ta sama aplikacja opakowana w Tauri (lżejsze, Rust) lub Electron (szersze wsparcie bibliotek). Względnie "darmowe" dzięki wspólnej bazie z wersją web.
3. **Mobile** — trudniejsze ze względu na gesty dotykowe/canvas; opcje: React Native + Skia (`@shopify/react-native-skia`) dla wydajnego natywnego renderera, albo WebView z appką webową jako rozwiązanie startowe.
4. **Fizyczne tablice interaktywne (np. Samsung Flip i podobne)**:
   - Jeśli urządzenie pozwala instalować zwykłe aplikacje Android (otwarty system z Home i sklepem/side-loadem) — aplikacja mobilna działa tam natywnie jak na tablecie, wsparcie dotyku/pióra przez standardowe Android `MotionEvent`/Pointer Events.
   - Jeśli urządzenie jest zamkniętym systemem "kioskowym" (jak w opisanym przypadku Samsung Flip) — appka instalacyjna odpada. Alternatywy:
     - tablica jako zewnętrzny monitor dotykowy (HDMI/USB-C + touch passthrough) dla komputera z Twoją appką desktopową — najczystsze rozwiązanie, jeśli sprzęt to wspiera;
     - gniazdo OPS na wymienny moduł PC, jeśli tablica je ma;
     - w ostateczności: **przepływ plikowy przez USB** — eksport z natywnego oprogramowania tablicy (np. do `.iwb`) → import do platformy przez pendrive, bez połączenia na żywo. To realny, wystarczający scenariusz, gdy live-integracja nie jest możliwa.
   - Nie zakładać z góry wsparcia dla konkretnego modelu — każdy sprzęt wymaga faktycznej weryfikacji na urządzeniu (macierz kompatybilności: producent × model × system × jakość raportowania nacisku pióra × dostępne tryby eksportu).

---

## 4A. Rodzina klientów i profile UI

Platforma nie ma **jednego** uniwersalnego interfejsu, lecz **rodzinę klientów** — aplikacji podobnych do siebie, ale dostosowanych do kontekstu użycia (przeglądarka, desktop, tablica dotykowa, mobile, a nawet dedykowane „specjalne wersje"). Wszystkie łączy jedno: **konsumują ten sam backend przez wspólny `packages/api-client` i operują na tym samym modelu `packages/core`**. Różni je wyłącznie powłoka (UI) i warstwa wejścia. Zasada przewodnia: **jeden „mózg", wiele „twarzy"**.

### 4A.1 Co wspólne, co osobne

| Warstwa | Wspólna czy osobna per klient | Dlaczego |
|---|---|---|
| API (REST) — kontrakt | **wspólna** (`packages/api-client`) | każdy klient rozmawia z backendem tak samo; backend nie odróżnia klientów |
| Model dokumentu (`core`) | **wspólna** | ta sama tablica znaczy to samo wszędzie |
| Sync / CRDT (`sync`) | **wspólna** | współpraca na żywo działa **między różnymi klientami naraz** (web + tablica + desktop w jednym pokoju) |
| Silnik renderujący (`engine`) | **wspólna** (biblioteka) | identyczny obraz tablicy niezależnie od klienta |
| **Powłoka / shell UI** | **osobna** — kompozycja klocków `ui/` | web ≠ tablica ≠ mobile: inny layout, inne rozmiary celów |
| Warstwa wejścia (mysz/dotyk/pióro) | **osobna** | inne urządzenia, inne gesty; oparta na `InputSample` z pkt 3.3 |

Wniosek architektoniczny: **„klient" = wspólny rdzeń + osobna powłoka.** Powłoka to nie odrębna logika, tylko inna kompozycja tych samych komponentów z `packages/ui`.

### 4A.2 Trzy poziomy „inności" klienta

1. **Ten sam program, inny layout** (web vs desktop) — różni się tylko rozmieszczenie stref UI; jedna baza kodu. Większość przypadków.
2. **Ten sam program, profil dotykowy** (tablica interaktywna) — pływający, przeciągalny pasek narzędzi, powiększone cele dotykowe, gesty wielopunktowe, palm rejection. To osobny **profil UI** (`ui/profiles/touch-board`), nie osobny program.
3. **Osobny program** (np. `apps/board-kiosk` na zamkniętą tablicę, okrojony klient do sali konferencyjnej, dedykowana appka Android na Samsung Flip) — fizycznie inny build, ale importuje `core` + `api-client` + wybrane klocki `ui`. Dla backendu **nieodróżnialny** od reszty, bo mówi tym samym API.

Wszystkie trzy poziomy są legalne w tej samej architekturze, bo granica jest w jednym miejscu: każdy klient to konsument tego samego API + `core`, różniący się tylko powłoką. Do decyzji (pkt 9): czy `api-client` publikujemy również jako **osobną paczkę dla klientów zewnętrznych**, którzy chcieliby budować własne aplikacje na to API.

### 4A.3 Strefy UI i dwie szkoły interfejsu

Research istniejących narzędzi pokazuje dwie szkoły: **„aplikacja desktopowa"** (SMART Notebook, Promethean — pasek menu + toolbar + boczne zakładki Page Sorter/Gallery/Properties, praca stronicowa) oraz **„canvas-first"** (Excalidraw, tldraw, FigJam, Miro — nieskończony canvas z minimalnym, pływającym chrome). Ponieważ uniwersalny model to graf węzłów/krawędzi na nieskończonej płaszczyźnie, **bazą jest szkoła canvas-first**, z opcjonalnym panelem stron/miniatur dla importów stronicowych (SMART/Promethean).

Niezależnie od profilu każdy klient komponuje się z tych samych 6 stref (klocki `packages/ui`):

```
┌─────────────────────────────────────────────┐
│ [menu] [nazwa projektu]   [awatary] [Share]  │ ← górna strefa (współpraca, share)
├──────┬──────────────────────────────┬────────┤
│ stro-│                              │ Panel  │
│ ny/  │        CANVAS                │ właści-│ ← kontekstowy: pojawia się
│ war- │   (nieskończony)             │ wości  │   po zaznaczeniu obiektu
│ stwy │                              │        │
│(opc.)│                              │        │
├──────┴──────────────────────────────┴────────┤
│  [toolbar narzędzi]           [zoom] [mapa]   │ ← dolna strefa (narzędzia, nawigacja)
└─────────────────────────────────────────────┘
   ↑ profil touch-board: toolbar pływający i przeciągalny, blisko ręki użytkownika
```

Sześć stref: **canvas**, **toolbar narzędzi**, **panel właściwości** (kontekstowy), **nawigacja** (zoom/mini-mapa), **warstwa współpracy** (kursory, awatary, obecność), **zarządzanie dokumentem** (miniatury stron / przeglądarka projektów). Profil = który zestaw stref i w jakim rozmieszczeniu/rozmiarze złożyć.

### 4A.4 Profil dotykowy — wymagania specyficzne dla tablic

Odróżnia platformę od czystego Excalidraw i wymaga osobnego profilu (`ui/profiles/touch-board`):
- **Pływający, przeciągalny toolbar** — na dużym ekranie stały pasek u góry jest poza zasięgiem ręki.
- **Palm rejection** — dłoń oparta o ekran nie może rysować; rozróżnianie palec / pióro / dłoń.
- **Gesty wielopunktowe** (np. 3/4/5 palców → undo / usuń / warstwy) i obsługa wielu punktów dotyku naraz (kilku użytkowników przy jednej tablicy).
- Wejście oparte na `InputSample` (pkt 3.3) z łagodnym fallbackiem przy braku nacisku/tiltu.

### 4A.5 Wyróżniki UI platformy (brak u konkurencji)

- **Badge poziomu wierności** (pkt 2) widoczny na canvasie przy imporcie — np. „Poziom 2: geometria edytowalna, brak semantyki".
- **Wskaźnik opaque shape** — obiekt renderowany poprawnie, ale oznaczony „dane źródłowe zachowane, edycja ograniczona".
- **Przełącznik trybu** tablica ↔ mapa myśli (pkt 5) nad tym samym modelem.
- **Automatyczny wybór profilu** (desktop / touch-board / mobile) wg wykrytego urządzenia, z możliwością ręcznego przełączenia.

---

## 5. Rozszerzenia specjalistyczne

- **CAD**: plugin obsługujący DXF/DWG/STEP — rzuty 2D, wymiary, adnotacje jako edytowalne warstwy. Ograniczenie: wymiary z plików PDF (nawet wektorowych) tracą semantykę (nie są już żywymi obiektami powiązanymi z geometrią) — da się odzyskać tylko wygląd, nie relację. Pełna semantyka wymaga natywnego formatu CAD, nie PDF.
- **Mapy myśli**: osobny "tryb" nad tym samym modelem węzłów/krawędzi, bez potrzeby oddzielnej architektury.

---

## 5.1 Zagadnienia przekrojowe (jakość, wierność, ryzyka)

Kwestie, które nie należą do jednej warstwy, ale rzutują na cały projekt i najtaniej jest je zaadresować od początku:

- **Wersjonowanie schematu modelu.** Skoro `.devbrd` (pkt 3.7) to natywny format zapisu, każdy dokument musi nieść pole `version`/`schemaVersion`, a `packages/core` — jawną ścieżkę migracji między wersjami. Bez tego pierwsze zapisane pliki staną się długiem technicznym w chwili pierwszej zmiany modelu. Migracje traktować jak migracje bazy danych: jednokierunkowe, testowane, nieodwracalne bez świadomej decyzji.
- **Mapowanie modelu na CRDT.** Yjs (pkt 3.4) jest wskazany, ale sposób odwzorowania uniwersalnego modelu na struktury `Y.Map`/`Y.Array` jest nietrywialny — zagnieżdżone grupy, warstwy i punkty zaczepienia krawędzi są typowym źródłem trudnych do odtworzenia konfliktów. To osobna decyzja projektowa (i osobny zestaw testów współbieżności), nie „efekt uboczny" wyboru biblioteki.
- **Polityka utraty danych przy round-trip.** Trzeba jawnie zdefiniować, co się dzieje, gdy użytkownik **edytuje** import poziomu 2 (PDF wektorowy) lub opaque shape i eksportuje z powrotem do formatu źródłowego: co jest bezstratne, co degraduje się do „martwej" geometrii, a przy czym UI musi ostrzec, że zapis wsteczny gubi część danych. Zasada wierności z sekcji 2 działa w obie strony — także przy eksporcie.
- **Testy golden-file jako element architektury, nie uwaga na marginesie.** Powtarzające się w dokumencie „wymaga testów na realnych plikach" należy podnieść do rangi procesu: katalog `fixtures/` z realnymi plikami per format + testy `import → model → eksport → porównanie` dla każdego importera. To jedyny wiarygodny sposób na pilnowanie zgodności z wariantami formatów (zwłaszcza IWB, różnie implementowanym przez producentów).
- **Wydajność canvasu przy dużych tablicach.** Narzędzia tej klasy (Miro, tldraw) mierzą się z tysiącami obiektów. Od początku zakładać renderowanie tylko widocznego obszaru (wirtualizacja / culling) i budżet wydajnościowy — to często granica między „zabawką" a „narzędziem produkcyjnym".
- **Dostępność (a11y) i internacjonalizacja (i18n).** Dla narzędzia edukacyjnego i wdrożeń w sektorze publicznym dostępność (obsługa klawiaturą, kontrast, czytniki ekranu) bywa wymogiem przetargowym, a nie funkcją „nice to have". Wielojęzyczność interfejsu zaplanować w warstwie `packages/ui` od startu, a nie doklejać później.
- **Ryzyko prawne parsowania zamkniętych formatów.** Reverse-engineering formatów producentów (`.notebook`, `.flipchart` i podobne) bywa ograniczony przez EULA lub przepisy typu DMCA w niektórych jurysdykcjach. To świadome ryzyko do odnotowania per format — niezależne od wyboru licencji samego projektu (pkt 9).

---

## 6. Sugerowana kolejność realizacji (fazowanie)

1. Uniwersalny model danych + edytor na bazie sprawdzonego silnika open-source (Excalidraw/tldraw).
2. Importery/eksportery dla formatów w pełni otwartych: `.excalidraw`, `.drawio`, SVG.
3. Plugin IWB/CFF — wysoki priorytet, bo jednym pluginem obejmuje wielu producentów tablic edukacyjnych naraz.
4. Warstwa synchronizacji/współdzielenia (CRDT) + backend deployowalny on-premise od samego początku.
5. Aplikacja desktopowa (Tauri/Electron) — relatywnie tania rozbudowa wersji web.
6. Integracje przez API (Miro, FigJam, Microsoft Whiteboard, Zoom Whiteboard) — bardziej pracochłonne, podatne na zmiany zewnętrzne.
7. Aplikacja mobilna / wsparcie dla fizycznych tablic — na końcu, wymaga testów na realnym sprzęcie.
8. Pluginy CAD i integracje z systemami dokumentacji technicznej — jako rozszerzenia dla zespołów specjalistycznych.
9. Szyfrowanie natywnego formatu zapisu (at-rest) — równolegle do wersji desktop/self-hosted; szyfrowanie end-to-end jako opcja dla wersji chmurowej w dalszej kolejności.

**Definicja MVP w kategoriach użytkownika (nie tylko technicznych).** Powyższe fazowanie opisuje *co* budujemy, ale pierwsze wydanie warto zdefiniować przez konkretny scenariusz użytkownika, żeby nie utknąć w budowaniu rdzenia bez działającego produktu. Propozycja pierwszego wydania:

> *„Użytkownik otwiera plik `.excalidraw`, `.drawio`, SVG lub `.iwb`, edytuje go w przeglądarce razem z drugą osobą w czasie rzeczywistym, zapisuje jako `.devbrd` i eksportuje z powrotem — a całość może stać na własnym serwerze przez `docker-compose`."*

Wszystko poza tym zdaniem (CAD, mobile, integracje API, szyfrowanie E2E, tablice fizyczne) jest świadomie *poza* pierwszym wydaniem.

---

## 7. Lista planowanych/docelowych formatów tablic

Zestawienie formatów natywnych, pogrupowane wg otwartości. Część producentów nie udostępnia plików lokalnych w ogóle (produkty czysto chmurowe) — wtedy jedyną drogą jest integracja przez API, nie import pliku.

### 7.1 Formaty otwarte lub udokumentowane (najwyższy priorytet)

| Format / narzędzie | Rozszerzenie | Charakterystyka |
|---|---|---|
| IWB / Common File Format | `.iwb` | Otwarty standard 1EdTech (dawniej Becta/IMS Global), oparty o SVG + XML. Wspierany (przynajmniej częściowo) przez SMART Notebook, Promethean ActivInspire, BenQ EZWrite i inne — patrz pkt 7.2. |
| Excalidraw | `.excalidraw` | JSON, w pełni otwarty i udokumentowany. |
| draw.io / diagrams.net | `.drawio` | XML, w pełni otwarty. |
| SVG | `.svg` | Uniwersalny format wymiany wektorowej, wspierany jako eksport przez wiele narzędzi (m.in. Microsoft Whiteboard). |
| OpenBoard / Open-Sankoré | `.ubz` | Otwarte, open-source'owe oprogramowanie tablicowe (następca Sankoré), format oparty o kontener ZIP. |

### 7.2 Formaty producentów sprzętu edukacyjnego (zamknięte, ale znane/rozpoznawalne)

| Producent / narzędzie | Format | Uwagi |
|---|---|---|
| SMART Notebook | `.notebook` (nowsze), `.gallery`, `.xbk` (starsze wersje) | Bardzo rozpowszechniony w edukacji; wspiera też eksport/import `.iwb`. |
| Promethean ActivInspire | `.flipchart` (`.flp`) | Format "flipchart"; następcy: ClassFlow (przeglądarkowy, zakończony), Explain Everything Whiteboard. |
| Promethean ClassFlow / Explain Everything Whiteboard | brak lokalnego pliku (chmura) | Warto zweryfikować dostępność API po stronie Promethean/Explain Everything. |
| mozaBook | własny format | Producent: Mozaik Education. |
| Prowise Presenter | własny format + konwerter z `.notebook` | Prowise oferuje własny konwerter plików SMART Notebook — potencjalna wskazówka co do struktury formatu. |
| Gynzy | brak lokalnego pliku (chmura) | Do weryfikacji dostępność API. |
| Google Jamboard | `.jam` | Produkt wycofywany przez Google — istotne tylko jako format migracyjny (odzyskiwanie starych plików), nie jako cel długoterminowy. |

### 7.3 Formaty narzędzi diagramowania i map myśli (uzupełniająco)

| Narzędzie | Format |
|---|---|
| Microsoft Visio | `.vsdx` |
| XMind | `.xmind` |
| Coggle / MindMeister / Ayoa (iMindMap) | głównie chmurowe, eksport do formatów pochodnych (np. OPML, `.imx` dla iMindMap) |

### 7.4 Narzędzia czysto chmurowe (bez lokalnego formatu — tylko integracja API)

Miro, Mural, FigJam (współdzieli silnik plikowy `.fig` z Figma, ale w praktyce dostęp przez API), Lucidspark, Conceptboard, Stormboard, Canva Whiteboards — dla tej grupy jedyna sensowna droga importu to REST API danego dostawcy (tak jak zaplanowano dla Miro/FigJam w pkt 3.2), nie parser pliku.

**Uwaga**: lista producentów sprzętu edukacyjnego jest długa i rozdrobniona (Hitachi StarBoard, Cleverboard/Mimio Lynx, eBeam Scrapbook, EasiTeach i inne) — dokładne formaty tych mniejszych graczy wymagają odrębnego researchu przy realnych plikach, najlepiej zaczynając od tych, do których jest faktyczny dostęp sprzętowy (patrz pkt 7, otwarte pytania).

---

## 8. Lista integracji z platformami spotkań

| Platforma | Sposób integracji | Charakter | Uwagi |
|---|---|---|---|
| Microsoft Teams / Whiteboard | Microsoft Graph API | Odczyt/eksport na żądanie (async); appka własna jako Teams app (manifest + `meetingStage`) | Eksport natywny do SVG (wektorowy) i PNG. Brak potwierdzenia wsparcia webhooków dla zasobu Whiteboard — nie zakładać live-sync z natywną tablicą. |
| Zoom | Zoom Whiteboard REST API + webhooki; Zoom Apps SDK (embedding) | Możliwy import na żądanie oraz potencjalny live-sync przez webhooki (do zweryfikowania w praktyce) | Dodatkowy eksport do PDF z poziomu Video SDK. |
| Cisco Webex | Webex Whiteboard (natywna funkcja spotkań) + Webex Developer API/Widgets (do osadzania własnej appki) | Natywne zrzuty tablicy zapisywane jako PDF tylko do odczytu; brak potwierdzonego API do programistycznego odczytu/eksportu treści tablicy w czasie rzeczywistym | Webex sprzętowo wspiera "Embedded Apps" (Miro, Mural są już oficjalnie zintegrowane jako aplikacje na urządzeniach Webex Board/Desk) — to możliwy wzorzec do naśladowania dla własnej appki. |
| Google Meet | Brak natywnej tablicy własnej Google (Jamboard wycofany) — tylko dodatki (add-ony) firm trzecich | Integracja przez Google Workspace Marketplace jako dodatek do sprzętu Meet | Obecnie oficjalnie wspierane dodatki to Figma/FigJam, Lucidspark i Miro — potencjalny wzorzec/dokumentacja do sprawdzenia, jak zarejestrować własny dodatek tego typu. |

---

## 9. Otwarte pytania do dalszej pracy

- Wybór licencji open-source (MIT/Apache vs AGPL).
- Dokładny wybór silnika bazowego dla edytora (Excalidraw-core vs tldraw SDK) — porównanie API, licencji, łatwości rozbudowy.
- Weryfikacja realnych plików `.iwb` z konkretnych urządzeń (Samsung i inne) pod kątem zgodności ze specyfikacją 1EdTech.
- Zakres MVP — które formaty i platformy wchodzą w pierwsze wydanie (patrz propozycja w pkt 6).
- Sposób mapowania uniwersalnego modelu na struktury CRDT (Yjs) — zwłaszcza grup, warstw i punktów zaczepienia krawędzi (pkt 5.1).
- Strategia wersjonowania i migracji schematu modelu / formatu `.devbrd` od pierwszego wydania (pkt 5.1).
- Polityka utraty danych przy eksporcie wstecznym (round-trip) dla importów poziomu 2 i opaque shapes (pkt 5.1).
- Ryzyko prawne reverse-engineeringu zamkniętych formatów producentów (EULA/DMCA) — do oceny per format (pkt 5.1).
- Zakres wymagań dostępności (a11y) i języków interfejsu (i18n) dla pierwszych wdrożeń, zwłaszcza edukacyjnych/publicznych (pkt 5.1).
- Wybór narzędzi monorepo (pnpm/Turborepo/Nx) i granic pakietów zgodnie ze strukturą z pkt 3.10.
- Czy `packages/api-client` publikować jako osobną paczkę dla klientów zewnętrznych budujących własne aplikacje na API platformy (pkt 4A.2).
- Zestaw profili UI na start i kryteria automatycznego wyboru profilu wg urządzenia (pkt 4A.4–4A.5).