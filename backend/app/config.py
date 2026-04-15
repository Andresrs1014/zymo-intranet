from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    database_url: str = "sqlite:///./data/intranet.db"
    oc_database_url: str = "sqlite:///./data/oc.db"
    sgc_database_url: str = "sqlite:///./data/sgc.db"
    access_token_expire_minutes: int = 480  # 8 horas

    # Credenciales del admin inicial (se crea solo si no existe ningún admin)
    first_admin_email: str = "admin@zymo.com"
    first_admin_password: str = "Admin123*"

    # Orígenes CORS permitidos (separados por coma)
    cors_origins: str = "http://localhost:5173,http://localhost:81"

    # OC Automatizaciones
    # Secret para validar que el webhook viene de Power Automate (opcional)
    oc_webhook_secret: str = ""

    # Correo — SMTP Office 365
    smtp_host: str = "smtp.office365.com"
    smtp_port: int = 587
    smtp_user: str = ""        # ej: compras@zymologistica.com
    smtp_password: str = ""
    smtp_from: str = ""        # igual al smtp_user normalmente
    email_directora: str = ""  # email de quien aprueba cotizaciones

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
