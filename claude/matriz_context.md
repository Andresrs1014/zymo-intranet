# Project Matrix

Aplicación de gestión de proyectos con matriz de priorización.

## Estructura

```
Matriz/
├── backend/     # API REST con FastAPI + SQLModel
└── frontend/    # SPA con React + Vite + Tailwind CSS v3
```

## Backend

### Requisitos
- Python 3.11+
- Crear entorno virtual e instalar dependencias

```bash
cd backend
py -3 -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
```

### Configuración
Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `SECRET_KEY` | Clave JWT — genera con `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Por defecto SQLite local (`sqlite:///./data/matrix.db`) |
| `WEBHOOK_SECRET` | Secreto compartido con Power Automate |

### Iniciar servidor

```bash
python run.py
# API disponible en http://localhost:8000
# Docs en http://localhost:8000/docs
```

---

## Frontend

### Requisitos
- Node.js 18+

```bash
cd frontend
npm install
npm run dev
# App disponible en http://localhost:5173
```

### Stack
- React 19 + TypeScript
- Vite 7
- Tailwind CSS v3
- shadcn/ui
- Zustand (estado global)
- React Router v7

---

## Variables de entorno

El archivo `backend/.env` **nunca se sube al repositorio**. Usa `backend/.env.example` como plantilla.
