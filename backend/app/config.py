from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    database_url: str = "sqlite:///./data/intranet.db"
    oc_database_url: str = "sqlite:///./data/oc.db"
    sgc_database_url: str = "sqlite:///./data/sgc.db"
    financiero_database_url: str = "sqlite:///./data/financiero.db"
    access_token_expire_minutes: int = 480  # 8 horas

    # Credenciales del admin inicial (se crea solo si no existe ningún admin)
    first_admin_email: str = "admin@zymo.com"
    first_admin_password: str = "Admin123*"

    # Orígenes CORS permitidos (separados por coma)
    cors_origins: str = "http://localhost:5173,http://localhost:81"

    # Módulo Financiero
    facturas_dir: str = "/app/data/facturas"

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

    # URL base de la intranet (para links en emails)
    intranet_url: str = "http://localhost:81"

    # ── Módulo Gerencial (PostgreSQL — piloto migración) ──────────────────────
    gerencial_database_url: str = "sqlite:///./data/gerencial.db"  # Override con PostgreSQL en producción

    # ── Agentes IA ────────────────────────────────────────────────────────────
    agents_database_url: str = "sqlite:///./data/agents.db"
    gemini_api_key_gerencial: str = ""
    gemini_api_key_administrativo: str = ""
    perplexity_api_key: str = ""
    agent_check_interval_minutes: int = 120
    agent_docs_dir: str = "/app/data/agent_docs"
    agent_logs_dir: str = "/app/data/agent_logs"
    agent_memory_dir: str = "/app/data/agent_memory"
    lightrag_working_dir: str = "/app/data/lightrag"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
