# Plan Híbrido: Node.js (Principal) + Python (Complementario)

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + TS)                    │
│                   Vite + Tailwind + shadcn/ui                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Nginx)                        │
│                    Balanceo + Cache + SSL                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND PRINCIPAL                          │
│                      Node.js + Express                          │
│                    + Prisma + TypeScript                        │
└─────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼ (Conexión directa)                 ▼ (Llamadas internas http)
┌─────────────────────────┐            ┌──────────────────────────┐
│   PostgreSQL (Main DB)  │            │ SERVICIOS COMPLEMENTARIOS│
│                         │            │ Python + FastAPI         │
│                         │            │ (ML, AI Chat, PDFs)      │
└─────────────────────────┘            └──────────────────────────┘
```

---

## Definición de Responsabilidades

### 🟢 Node.js (Core Principal)

Todo el sistema de gestión de proyectos, la persistencia, la lógica de negocio y la automatización del sistema:

| Módulo | Tecnología | Descripción |
|--------|------------|-------------|
| **Autenticación** | Express + JWT + bcrypt | Login, registro, tokens, middleware |
| **Gestión de Tareas** | Express + Prisma | CRUD completo, filtros, estados |
| **Subproyectos** | Express + Prisma | ROI, inversiones, estadísticas |
| **Equipo** | Express + Prisma | Miembros, colores, insignias |
| **Comentarios** | Express + Prisma | Historial, canal WhatsApp |
| **Evidencias** | Express + Multer | Archivos, validación, almacenamiento |
| **Encuestas** | Express + Prisma | Satisfacción, NPS, respuestas |
| **Reportes Dinámicos** | Express + Prisma | Dashboard, métricas, exportación Excel |
| **Alertas** | Express + Nodemailer | Emails, enlaces de WhatsApp |
| **Jobs Programados (Core)** | node-cron | Limpieza automática, respaldos semanales |
| **Frontend SPA** | React + Vite | UI completa e interactiva |
| **PWA** | Workbox / VitePWA | Service Worker para modo offline |

### 🟡 Python (Servicios Complementarios)

Procesos que requieren capacidades matemáticas, de analítica o IA donde Python destaca:

| Módulo | Tecnología | Descripción |
|--------|------------|-------------|
| **Chat IA / Asistente** | FastAPI + LangChain/OpenAI | NLP, respuestas contextuales del proyecto |
| **Análisis Predictivo** | FastAPI + scikit-learn | Predicción de riesgos y ROI del subproyecto |
| **Procesamiento de Documentos** | FastAPI + pdfminer/docx | Análisis e indexación de instructivos |
| **Reportes PDF Complejos** | FastAPI + WeasyPrint | Generación de PDFs estilizados con HTML/CSS |
| **Jobs Programados (ML)** | APScheduler | Re-entrenamiento programado de modelos de riesgo |

---

## Arquitectura Detallada

### 1. Backend Node.js (Puerto 3000)

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts       # Cliente de Prisma
│   │   ├── env.ts            # Variables de entorno
│   │   └── mail.ts          # Configuración de Nodemailer
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── taskController.ts
│   │   ├── subprojectController.ts
│   │   ├── teamController.ts
│   │   ├── alertController.ts
│   │   ├── reportController.ts
│   │   └── surveyController.ts
│   ├── middleware/
│   │   ├── authenticate.ts   # Verificación de JWT
│   │   ├── validate.ts       # Validador de express-validator
│   │   └── rateLimit.ts      # Límite de peticiones
│   ├── models/               # Schemas auxiliares
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   ├── subprojects.ts
│   │   ├── team.ts
│   │   ├── alerts.ts
│   │   ├── reports.ts
│   │   └── surveys.ts
│   ├── services/
│   │   ├── taskService.ts
│   │   ├── alertService.ts
│   │   ├── reportService.ts
│   │   └── exportService.ts
│   ├── jobs/
│   │   └── scheduler.ts      # Cron jobs del sistema (node-cron)
│   ├── utils/
│   │   ├── constants.ts
│   │   └── helpers.ts
│   └── app.ts               # Servidor Express
├── prisma/
│   ├── schema.prisma
│   └── seed.ts               # Semilla con datos iniciales (seedTeam, seedTasks)
└── package.json
```

### 2. Servicios Python (Puerto 8000 - Privado)

```
python-services/
├── services/
│   ├── ai_assistant/
│   │   ├── main.py          # FastAPI - Chat IA
│   │   ├── chains.py        # Lógica de LangChain
│   │   └── prompts.py       # Prompts del sistema
│   ├── ml_predictor/
│   │   ├── main.py          # FastAPI - Predicciones de riesgo
│   │   ├── models/
│   │   │   ├── risk_model.pkl
│   │   │   └── roi_model.pkl
│   │   └── training.py      # Scripts de entrenamiento
│   ├── document_processor/
│   │   ├── main.py          # FastAPI - Análisis de instructivos
│   │   └── parser.py        # Extracción de PDF/DOCX
│   └── pdf_generator/
│       ├── main.py          # FastAPI - PDFs estilizados
│       └── templates/       # Plantillas HTML/CSS
├── requirements.txt         # Dependencias (FastAPI, LangChain, scikit-learn, WeasyPrint)
├── Dockerfile
└── .env
```

#### Dependencias clave de Python (`requirements.txt`):
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
langchain==0.1.0
langchain-openai==0.0.2
scikit-learn==1.4.0
pandas==2.2.0
numpy==1.26.3
weasyprint==60.2
python-docx==1.1.0
pdfminer.six==20221105
httpx==0.26.0
```

---

## Comunicación Entre Servicios

Dado que los servicios de Python se ejecutan dentro de la red privada de Docker, el backend de Node.js actúa como puerta de enlace (API Gateway interna) para la comunicación:

```typescript
// Backend Node.js - Llamadas internas a servicios Python (sin exposición externa)

// Chat IA
const aiResponse = await axios.post('http://python-services:8000/ai/chat', {
  question: userQuestion,
  context: { tasks, subprojects, team }
});

// Predicción de riesgo
const prediction = await axios.post('http://python-services:8000/ml/predict-risk', {
  taskId: task.id,
  features: { progress, priority, blocked, daysLeft }
});

// Procesar documento
const analysis = await axios.post('http://python-services:8000/docs/analyze', {
  fileId: evidence.id,
  filePath: evidence.path
});
```

---

## Modelo de Datos Compartido

### PostgreSQL (Base única)

La persistencia la controla Node.js con Prisma. Python consume los datos requeridos mediante las llamadas del backend de Node.js o mediante conexión de solo lectura en caso de entrenamientos masivos de ML.

```prisma
// En backend Node.js - schema.prisma

model User {
  id        Int       @id @default(autoincrement())
  name      String
  initials  String
  color     String    @default("#5461c8")
  email     String    @unique
  phone     String
  isActive  Boolean   @default(true)
  tasks     Task[]
  aiConversations AIConversation[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Subproject {
  id            Int       @id @default(autoincrement())
  name          String
  goal          String?
  investment    Float     @default(0)
  expectedReturn Float    @default(0)
  tasks         Task[]
  alerts        Alert[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Task {
  id              Int             @id @default(autoincrement())
  subprojectId    Int
  subproject      Subproject      @relation(fields: [subprojectId], references: [id])
  ownerId         Int
  owner           User            @relation(fields: [ownerId], references: [id])
  name            String
  status          String          @default("Backlog")
  priority        String          @default("Media")
  startDate       DateTime
  endDate         DateTime
  progress        Int             @default(0)
  points          Int             @default(3)
  investmentCost  Float           @default(0)
  optimizationCost Float          @default(0)
  executionCost   Float           @default(0)
  blocked         Boolean         @default(false)
  dependencyId    Int?
  dependency      Task?           @relation("TaskDependency", fields: [dependencyId], references: [id])
  dependents      Task[]          @relation("TaskDependency")
  prediction      TaskPrediction?
  completedAt     DateTime?
  comments        Comment[]
  evidence        Evidence[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model Comment {
  id        Int       @id @default(autoincrement())
  taskId    Int
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  text      String
  channel   String    @default("web") // "web" o "whatsapp"
  createdAt DateTime  @default(now())
}

model Evidence {
  id        Int       @id @default(autoincrement())
  taskId    Int
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  name      String
  fileType  String
  size      Int
  filePath  String
  createdAt DateTime  @default(now())
}

model Survey {
  id          Int       @id @default(autoincrement())
  name        String
  role        String
  satisfaction Int
  ease        Int
  utility     Int
  nps         Int
  comment     String?
  createdAt   DateTime  @default(now())
}

model Alert {
  id            Int        @id @default(autoincrement())
  subprojectId  Int
  subproject    Subproject @relation(fields: [subprojectId], references: [id])
  change        String
  taskId        Int?
  taskName      String?
  recipients    String     // JSON array almacenado como string
  createdAt     DateTime   @default(now())
}

// Nuevo: Historial del Chat IA de soporte
model AIConversation {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Json     // [{"role": "user", "content": "..."}]
  createdAt DateTime @default(now())
}

// Nuevo: Predicciones generadas por el servicio ML
model TaskPrediction {
  id          Int      @id @default(autoincrement())
  taskId      Int      @unique
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  riskScore   Float    // 0.0 - 1.0
  likelyDelay Int?     // Días de retraso estimados
  computedAt  DateTime @default(now())
}
```

---

## Implementación por Fases

### Fase 1: Setup Core Node.js y Migración (Semanas 1-4)
1. **Configuración inicial**: Setup de Express + Prisma + TypeScript.
2. **Base de Datos**: Migraciones y Seed Script para precargar los datos de prueba (`seedTasks`, `seedSubprojects` y `seedTeam`).
3. **Autenticación**: JWT login/register.
4. **CRUD Completo**: Tareas, Subproyectos, Comentarios, Encuestas y Equipo.
5. **Frontend**: Migración de la UI SPA actual a React + Vite + Tailwind + shadcn/ui.

### Fase 2: Chat IA Integrado (Semanas 5-6)
1. **Setup de FastAPI**: Creación del contenedor de servicios Python.
2. **Integración con LangChain**: Generación de respuestas sobre tareas del proyecto pasándole el contexto JSON desde Node.js.
3. **Conexión Frontend**: Panel de chat IA de soporte en la vista `Soporte`.
4. **Persistencia**: Almacenamiento de conversaciones en la tabla `AIConversation` mediante Node.js.

### Fase 3: Análisis Predictivo de Riesgo (Semanas 7-8)
1. **Modelado en Python**: Carga de scikit-learn y entrenamiento con datos del historial.
2. **API de Predicción**: Endpoint en FastAPI que recibe el payload de una tarea y calcula el score de riesgo.
3. **Persistencia y Dashboard**: Node.js llama a Python, guarda el resultado en `TaskPrediction` y el frontend lo dibuja en el Dashboard.

### Fase 4: Documentos y Generación de PDF (Semanas 9-10)
1. **Extracción**: Implementación del analizador de instructivos subidos usando `pdfminer`/`docx`.
2. **Reportes PDF**: FastAPI recibe la estructura del informe gerencial desde Node.js y la renderiza usando WeasyPrint (HTML a PDF con CSS).

### Fase 5: Jobs y Optimización (Semanas 11-12)
1. **node-cron**: Tareas periódicas configuradas en Node.js (limpieza, backups).
2. **Cache**: Redis para optimizar la carga del Dashboard ejecutivo.
3. **Despliegue**: Docker Compose seguro listo para producción.

---

## Ventajas de Esta Arquitectura

| Aspecto | Beneficio |
|---------|-----------|
| **Seguridad de Red** | Python no se expone a internet. Node.js actúa como Gateway único que audita y autoriza llamadas. |
| **Separación de Lógica** | Node.js maneja la lógica relacional pesada. Python procesa tareas matemáticas pesadas. |
| **Cero Duplicación de ORM** | Python se mantiene stateless en la mayoría de sus endpoints, evitando duplicar configuraciones de base de datos. |
| **Mantenibilidad** | Esquemas consistentes gestionados por Prisma y migración transparente de LocalStorage. |

---

## Docker Compose Final

```yaml
version: '3.8'

services:
  # Frontend SPA (React + Vite)
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

  # Backend Principal (Node.js)
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/helix
      - PYTHON_SERVICE_URL=http://python-services:8000
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=supersecrettoken
    depends_on:
      - db
      - redis

  # Servicios Python (FastAPI) - Privado
  python-services:
    build: ./python-services
    expose:
      - "8000"
    environment:
      - OPENAI_API_KEY=your-key-here
      - DATABASE_URL=postgresql://user:pass@db:5432/helix

  # Base de Datos
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=helix
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Cache
  redis:
    image: redis:7-alpine

  # Nginx (API Gateway externo)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
```

---

## Recomendación Final

**Esta arquitectura híbrida es ideal si:**
- ✅ Quieres consistencia Node.js en el core de tu sistema CRUD.
- ✅ Necesitas integrar inteligencia artificial, análisis de texto y machine learning robusto a futuro.
- ✅ Deseas un flujo de reportes en PDF con diseño web premium (WeasyPrint).
- ✅ Quieres mantener protegida la capa de procesamiento y análisis de datos en una red interna privada.