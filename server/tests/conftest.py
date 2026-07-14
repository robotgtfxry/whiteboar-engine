"""Konfiguracja testów.

Kieruje `DATABASE_URL` na SQLite w pamięci, żeby testy importera i endpointu `/convert`
(który nie dotyka bazy) działały bez Postgresa/psycopg. Testy dotykające bazy same
nadpisują zależności (`get_db`) lub wymagają realnej bazy.

Ścieżkę importu pakietu `app` zapewnia pytest (`pythonpath = .` w `pytest.ini`).
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
