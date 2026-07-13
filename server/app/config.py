from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Konfiguracja serwera. Wartości można nadpisać zmiennymi środowiskowymi
    (lub plikiem .env) — np. DATABASE_URL, CORS_ORIGINS."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Domyślnie wskazuje na Postgres z deploy/docker-compose.yml wystawiony na localhost.
    database_url: str = "postgresql+psycopg://whiteboard:whiteboard@localhost:5432/whiteboard"

    # Lista dozwolonych originów dla CORS (przecinkami). Używana obok regexu poniżej.
    cors_origins: str = "http://localhost:5173"

    # Regex dla dev: dowolny port na localhost/127.0.0.1 (żeby Vite mógł wskoczyć na 5174 itd.).
    # W produkcji zawęź do konkretnych domen (albo ustaw pusty i korzystaj tylko z cors_origins).
    cors_origin_regex: str = r"http://(localhost|127\.0\.0\.1)(:\d+)?"

    # Dane konta admina zakładanego przy starcie.
    admin_email: str = "admin@local"
    admin_name: str = "Administrator"
    admin_password: str = "admin"  # ZMIEŃ w produkcji (zmienna ADMIN_PASSWORD).

    # JWT.
    jwt_secret: str = "dev-secret-change-me"  # ZMIEŃ w produkcji (zmienna JWT_SECRET).
    jwt_expire_minutes: int = 720

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
