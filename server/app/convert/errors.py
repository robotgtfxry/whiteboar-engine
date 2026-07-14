"""Wyjątki warstwy konwersji formatów.

Routery mapują `ConvertError` na HTTP 400 (błąd danych wejściowych), a nie 500.
"""


class ConvertError(ValueError):
    """Plik wejściowy jest nieprawidłowy lub nieobsługiwany przez importer."""
