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

Własny format kontenerowy (np. `.uwb`, w praktyce ZIP z JSON-em uniwersalnego modelu w środku, podobnie jak działa `.docx`) jako podstawowy sposób zapisu/eksportu projektu z platformy. Dwa niezależne poziomy szyfrowania do rozważenia:

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

## 5. Rozszerzenia specjalistyczne

- **CAD**: plugin obsługujący DXF/DWG/STEP — rzuty 2D, wymiary, adnotacje jako edytowalne warstwy. Ograniczenie: wymiary z plików PDF (nawet wektorowych) tracą semantykę (nie są już żywymi obiektami powiązanymi z geometrią) — da się odzyskać tylko wygląd, nie relację. Pełna semantyka wymaga natywnego formatu CAD, nie PDF.
- **Mapy myśli**: osobny "tryb" nad tym samym modelem węzłów/krawędzi, bez potrzeby oddzielnej architektury.

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

---

## 7. Lista planowanych/docelowych formatów tablic

Zestawienie formatów natywnych, pogrupowane wg otwartości. Część producentów nie udostępnia plików lokalnych w ogóle (produkty czysto chmurowe) — wtedy jedyną drogą jest integracja przez API, nie import pliku.

### 8.1 Formaty otwarte lub udokumentowane (najwyższy priorytet)

| Format / narzędzie | Rozszerzenie | Charakterystyka |
|---|---|---|
| IWB / Common File Format | `.iwb` | Otwarty standard 1EdTech (dawniej Becta/IMS Global), oparty o SVG + XML. Wspierany (przynajmniej częściowo) przez SMART Notebook, Promethean ActivInspire, BenQ EZWrite i inne — patrz pkt 8.2. |
| Excalidraw | `.excalidraw` | JSON, w pełni otwarty i udokumentowany. |
| draw.io / diagrams.net | `.drawio` | XML, w pełni otwarty. |
| SVG | `.svg` | Uniwersalny format wymiany wektorowej, wspierany jako eksport przez wiele narzędzi (m.in. Microsoft Whiteboard). |
| OpenBoard / Open-Sankoré | `.ubz` | Otwarte, open-source'owe oprogramowanie tablicowe (następca Sankoré), format oparty o kontener ZIP. |

### 8.2 Formaty producentów sprzętu edukacyjnego (zamknięte, ale znane/rozpoznawalne)

| Producent / narzędzie | Format | Uwagi |
|---|---|---|
| SMART Notebook | `.notebook` (nowsze), `.gallery`, `.xbk` (starsze wersje) | Bardzo rozpowszechniony w edukacji; wspiera też eksport/import `.iwb`. |
| Promethean ActivInspire | `.flipchart` (`.flp`) | Format "flipchart"; następcy: ClassFlow (przeglądarkowy, zakończony), Explain Everything Whiteboard. |
| Promethean ClassFlow / Explain Everything Whiteboard | brak lokalnego pliku (chmura) | Warto zweryfikować dostępność API po stronie Promethean/Explain Everything. |
| mozaBook | własny format | Producent: Mozaik Education. |
| Prowise Presenter | własny format + konwerter z `.notebook` | Prowise oferuje własny konwerter plików SMART Notebook — potencjalna wskazówka co do struktury formatu. |
| Gynzy | brak lokalnego pliku (chmura) | Do weryfikacji dostępność API. |
| Google Jamboard | `.jam` | Produkt wycofywany przez Google — istotne tylko jako format migracyjny (odzyskiwanie starych plików), nie jako cel długoterminowy. |

### 8.3 Formaty narzędzi diagramowania i map myśli (uzupełniająco)

| Narzędzie | Format |
|---|---|
| Microsoft Visio | `.vsdx` |
| XMind | `.xmind` |
| Coggle / MindMeister / Ayoa (iMindMap) | głównie chmurowe, eksport do formatów pochodnych (np. OPML, `.imx` dla iMindMap) |

### 8.4 Narzędzia czysto chmurowe (bez lokalnego formatu — tylko integracja API)

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
- Zakres MVP — które formaty i platformy wchodzą w pierwsze wydanie.