from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    database_url: str = "sqlite:///./data/intranet.db"
    access_token_expire_minutes: int = 480  # 8 horas

    # Credenciales del admin inicial (se crea solo si no existe ningún admin)
    first_admin_email: str = "admin@zymo.com"
    first_admin_password: str = "Admin123*"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
