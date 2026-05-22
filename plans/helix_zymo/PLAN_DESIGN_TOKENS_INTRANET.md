# Plan de Design Tokens: Helix Zymo en la Intranet

## Contexto

El `design-tokens.json` de Helix define una identidad visual propia con:
- **Marca**: rojo `#ef3340` + cian `#00a8c8`
- **Tipografía**: Montserrat (peso 700/800/900)
- **Sidebar oscuro**: gradiente `#343b46 → #4a5360 → #2c333d`
- **Fondo limpio**: `#f4f6fa` con superficies blancas

La intranet usa:
- **Color primario**: azul `hsl(218 100% 27%)`
- **Tipografía**: Barlow
- **Tema**: shadcn/ui con CSS variables HSL en `:root`
- **Sistema de clases**: Tailwind CSS

**Estrategia**: Los tokens de Helix se integran como un **scope CSS aislado** (`[data-module="helix"]`)
y como una extensión del `tailwind.config`. El tema global de la intranet **no cambia**. Helix
aporta su identidad solo dentro de sus componentes.

---

## Estructura de Implementación

```
frontend/src/
├── styles/
│   └── helix.css              ← variables CSS de Helix (nuevo)
├── lib/
│   └── helixTokens.ts         ← constantes TypeScript (nuevo)
└── components/herramientas/helix/
    └── HelixProvider.tsx      ← wrapper que activa el scope CSS
```

`helix.css` se importa **solo** en `HelixPage.tsx`, nunca globalmente.

---

## 1. Archivo CSS: `styles/helix.css`

```css
/* ============================================================
   HELIX ZYMO — Design Tokens
   Scope: [data-module="helix"]
   No afecta el tema global de la intranet.
   ============================================================ */

@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap');

[data-module="helix"] {

  /* --- Paleta primaria de marca --- */
  --helix-accent:          #ef3340;
  --helix-accent-2:        #4e5968;
  --helix-accent-dark:     #3f4652;
  --helix-ai:              #00a8c8;
  --helix-ai-2:            #7c5cff;

  /* --- Semánticos --- */
  --helix-done:            #1f9d6a;
  --helix-warning:         #f5a623;
  --helix-danger:          #ef3340;

  /* --- Neutros / Fondo --- */
  --helix-bg:              #f4f6fa;
  --helix-surface:         #ffffff;
  --helix-surface-2:       #eef1f6;
  --helix-ink:             #121420;
  --helix-muted:           #5c6374;
  --helix-line:            #d8dde8;
  --helix-glass:           rgba(255,255,255,0.78);

  /* --- Sidebar --- */
  --helix-sidebar-bg:      linear-gradient(180deg, #343b46 0%, #4a5360 48%, #2c333d 100%);
  --helix-sidebar-text:    #f7fbfa;
  --helix-sidebar-muted:   #c2caef;
  --helix-sidebar-nav:     #e5e9ff;
  --helix-sidebar-hover:   linear-gradient(90deg, rgba(0,168,200,0.22), rgba(255,255,255,0.1));
  --helix-sidebar-border:  rgba(255,255,255,0.12);

  /* --- Topbar --- */
  --helix-topbar-bg:       linear-gradient(135deg, rgba(58,66,78,0.99), rgba(90,101,116,0.96) 56%, rgba(239,51,64,0.82));
  --helix-topbar-text:     #ffffff;
  --helix-topbar-border:   linear-gradient(90deg, transparent, #00a8c8, #ef3340, transparent);

  /* --- Estados (badges/pills) --- */
  --helix-ok-text:         #116b49;
  --helix-ok-bg:           rgba(31,157,106,0.12);
  --helix-warning-text:    #8a5200;
  --helix-warning-bg:      rgba(245,158,11,0.16);
  --helix-danger-text:     #a21220;
  --helix-danger-bg:       rgba(239,51,64,0.12);

  /* --- Fondos especiales --- */
  --helix-card-bg:         #fbfcff;
  --helix-card-glass:      linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.78));
  --helix-stat-card:       linear-gradient(135deg, rgba(0,168,200,0.06), transparent 42%), #fbfcff;
  --helix-bar-track:       #e1e5f4;
  --helix-chat-input:      #f7f9fc;

  /* --- Sombras --- */
  --helix-shadow-card:     0 12px 30px rgba(35,38,45,0.08), inset 0 1px 0 rgba(255,255,255,0.75);
  --helix-shadow-soft:     0 10px 22px rgba(25,29,41,0.06);
  --helix-shadow-task:     0 8px 18px rgba(35,38,45,0.05);
  --helix-shadow-default:  0 18px 42px rgba(35,38,45,0.12);
  --helix-shadow-btn:      0 10px 24px rgba(239,51,64,0.18);
  --helix-shadow-topbar:   0 22px 48px rgba(58,66,78,0.2), inset 0 0 42px rgba(0,168,200,0.1);
  --helix-shadow-nav:      inset 4px 0 0 #00a8c8, 0 10px 22px rgba(0,0,0,0.14);

  /* --- Gradientes --- */
  --helix-grad-brand:      linear-gradient(135deg, #ef3340, #00a8c8);
  --helix-grad-bar:        linear-gradient(90deg, #00a8c8, #ef3340, #7c5cff);
  --helix-grad-gantt:      linear-gradient(90deg, #ef3340, #4e5968);
  --helix-grad-msg:        linear-gradient(135deg, #ef3340, #7c5cff);
  --helix-grad-body:       radial-gradient(circle at top right, rgba(239,51,64,0.06), transparent 28%),
                           linear-gradient(180deg, #f7f8fb 0%, #f4f6fa 46%, #eef1f6 100%);
  --helix-grad-header:     linear-gradient(90deg, #00a8c8, #ef3340, transparent);

  /* --- Bordes --- */
  --helix-border-card:     1px solid rgba(0,168,200,0.18);
  --helix-border-default:  1px solid #d8dde8;
  --helix-border-brand:    1px solid rgba(0,168,200,0.24);
  --helix-border-ai:       4px solid #ef3340;

  /* --- Tipografía --- */
  --helix-font:            "Montserrat", "Helvetica Now Display", Arial, ui-sans-serif, system-ui, sans-serif;
  --helix-fw-bold:         700;
  --helix-fw-extrabold:    800;
  --helix-fw-black:        900;

  /* --- Escala tipográfica --- */
  --helix-text-micro:      0.68rem;
  --helix-text-tiny:       0.72rem;
  --helix-text-small:      0.76rem;
  --helix-text-caption:    0.78rem;
  --helix-text-body-sm:    0.82rem;
  --helix-text-body:       0.84rem;
  --helix-text-body-def:   0.9rem;
  --helix-text-base:       0.94rem;
  --helix-text-base-def:   1rem;
  --helix-text-h-sm:       1.18rem;
  --helix-text-h:          1.28rem;
  --helix-text-h-lg:       1.4rem;
  --helix-text-h-xl:       1.45rem;
  --helix-text-display:    1.55rem;
  --helix-text-display-lg: 1.95rem;
  --helix-text-hero:       clamp(2rem, 3vw, 3.05rem);

  /* --- Line-heights --- */
  --helix-lh-tight:        1;
  --helix-lh-compact:      1.15;
  --helix-lh-normal:       1.35;
  --helix-lh-relaxed:      1.45;
  --helix-lh-spacious:     1.5;
  --helix-lh-wide:         1.55;
  --helix-lh-extra:        1.58;

  /* --- Border radius --- */
  --helix-r-soft:          6px;
  --helix-r-regular:       8px;
  --helix-r-medium:        10px;
  --helix-r-large:         12px;
  --helix-r-full:          999px;

  /* --- Transiciones --- */
  --helix-transition:      160ms ease;
  --helix-transition-md:   200ms ease;

  /* --- Spacing (base 4px) --- */
  --helix-sp-1:  2px;
  --helix-sp-2:  4px;
  --helix-sp-3:  6px;
  --helix-sp-4:  8px;
  --helix-sp-5:  10px;
  --helix-sp-6:  12px;
  --helix-sp-7:  14px;
  --helix-sp-8:  16px;
  --helix-sp-9:  18px;
  --helix-sp-10: 20px;
  --helix-sp-11: 22px;
  --helix-sp-12: 24px;
  --helix-sp-14: 28px;
  --helix-sp-15: 30px;
}
```

---

## 2. Extensión de Tailwind: `tailwind.config.js`

Agregar bajo `theme.extend` para poder usar clases como `bg-helix-accent`, `text-helix-ai`, etc.

```js
// tailwind.config.js — agregar dentro de theme.extend

colors: {
  helix: {
    accent:      "#ef3340",
    "accent-2":  "#4e5968",
    ai:          "#00a8c8",
    "ai-2":      "#7c5cff",
    done:        "#1f9d6a",
    warning:     "#f5a623",
    danger:      "#ef3340",
    ink:         "#121420",
    muted:       "#5c6374",
    line:        "#d8dde8",
    bg:          "#f4f6fa",
    surface:     "#ffffff",
    "surface-2": "#eef1f6",
    card:        "#fbfcff",
    sidebar:     "#2c333d",
    "bar-track": "#e1e5f4",
  },
},
fontFamily: {
  helix: [
    "Montserrat",
    "Helvetica Now Display",
    "Arial",
    "ui-sans-serif",
    "system-ui",
    "sans-serif",
  ],
},
boxShadow: {
  "helix-card":    "0 12px 30px rgba(35,38,45,0.08), inset 0 1px 0 rgba(255,255,255,0.75)",
  "helix-soft":    "0 10px 22px rgba(25,29,41,0.06)",
  "helix-task":    "0 8px 18px rgba(35,38,45,0.05)",
  "helix-default": "0 18px 42px rgba(35,38,45,0.12)",
  "helix-btn":     "0 10px 24px rgba(239,51,64,0.18)",
  "helix-nav":     "inset 4px 0 0 #00a8c8, 0 10px 22px rgba(0,0,0,0.14)",
},
borderRadius: {
  "helix-soft":    "6px",
  "helix-regular": "8px",
  "helix-medium":  "10px",
  "helix-large":   "12px",
},
```

---

## 3. Constantes TypeScript: `lib/helixTokens.ts`

Para usar los colores en código JS (gráficas Recharts, canvas, cálculos dinámicos):

```typescript
// lib/helixTokens.ts

export const HELIX_COLORS = {
  accent:    "#ef3340",
  accentDark:"#3f4652",
  ai:        "#00a8c8",
  aiPurple:  "#7c5cff",
  done:      "#1f9d6a",
  warning:   "#f5a623",
  danger:    "#ef3340",
  ink:       "#121420",
  muted:     "#5c6374",
  line:      "#d8dde8",
  bg:        "#f4f6fa",
  surface:   "#ffffff",
  card:      "#fbfcff",
  sidebar:   "#2c333d",
  barTrack:  "#e1e5f4",
} as const;

export const HELIX_GRADIENTS = {
  brand:   "linear-gradient(135deg, #ef3340, #00a8c8)",
  bar:     "linear-gradient(90deg, #00a8c8, #ef3340, #7c5cff)",
  gantt:   "linear-gradient(90deg, #ef3340, #4e5968)",
  message: "linear-gradient(135deg, #ef3340, #7c5cff)",
  topbar:  "linear-gradient(135deg, rgba(58,66,78,0.99), rgba(90,101,116,0.96) 56%, rgba(239,51,64,0.82))",
  sidebar: "linear-gradient(180deg, #343b46 0%, #4a5360 48%, #2c333d 100%)",
} as const;

// Colores para gráficas Recharts
export const HELIX_CHART_COLORS = [
  HELIX_COLORS.ai,
  HELIX_COLORS.accent,
  HELIX_COLORS.aiPurple,
  HELIX_COLORS.done,
  HELIX_COLORS.warning,
  "#4e5968",
] as const;

// Avatar colors (los mismos del prototipo)
export const HELIX_AVATAR_COLORS = [
  "#ef3340",
  "#5461c8",
  "#002f43",
  "#1f9d6a",
] as const;
```

---

## 4. Wrapper del módulo: `HelixProvider.tsx`

```tsx
// components/herramientas/helix/HelixProvider.tsx

import "../../styles/helix.css"; // Solo se carga con este componente

interface HelixProviderProps {
  children: React.ReactNode;
}

export function HelixProvider({ children }: HelixProviderProps) {
  return (
    <div data-module="helix" className="font-helix">
      {children}
    </div>
  );
}
```

Se usa como wrapper en `HelixPage.tsx`:

```tsx
// pages/herramientas/helix/HelixPage.tsx
import { HelixProvider } from "@/components/herramientas/helix/HelixProvider";

export default function HelixPage() {
  return (
    <HelixProvider>
      <HelixLayout />
    </HelixProvider>
  );
}
```

---

## 5. Tokens de Estado → Clases Tailwind

Para estados de actividades (semáforo visual), usar la paleta de estado de Helix:

| Estado | Fondo | Texto | Clase Tailwind |
|--------|-------|-------|----------------|
| Terminado | `rgba(31,157,106,0.12)` | `#116b49` | `bg-helix-done/10 text-[#116b49]` |
| En curso | `rgba(0,168,200,0.12)` | `#006e87` | `bg-helix-ai/10 text-[#006e87]` |
| Planificado | `rgba(78,89,104,0.12)` | `#4e5968` | `bg-helix-accent-2/10 text-helix-accent-2` |
| Bloqueado | `rgba(239,51,64,0.12)` | `#a21220` | `bg-helix-danger/10 text-[#a21220]` |
| Backlog | `rgba(18,20,32,0.06)` | `#5c6374` | `bg-helix-ink/[0.06] text-helix-muted` |

Para prioridades:

| Prioridad | Color | Clase |
|-----------|-------|-------|
| Crítica | `#ef3340` | `text-helix-accent` |
| Alta | `#f5a623` | `text-helix-warning` |
| Media | `#4e5968` | `text-helix-accent-2` |
| Baja | `#5c6374` | `text-helix-muted` |

---

## 6. Tipografía: Estrategia de Adopción

La intranet usa **Barlow** globalmente. Helix usa **Montserrat** como fuente de marca.

**Opción recomendada (coexistencia):**
- El cuerpo del módulo Helix usa `font-helix` (Montserrat) para títulos, KPIs y headings.
- El texto corriente de formularios y tablas puede mantener `font-sans` (Barlow) para coherencia
  con el resto de la intranet.
- La clase `font-helix` se aplica a `HelixProvider` y se sobreescribe en elementos específicos
  si se necesita Barlow.

**Cómo se ve en componentes:**

```tsx
// Títulos y KPIs — Montserrat
<h1 className="font-helix font-extrabold text-[length:var(--helix-text-display)] text-helix-ink">
  Dashboard
</h1>

// Métricas grandes
<span className="font-helix font-black text-[length:var(--helix-text-hero)] text-helix-accent">
  {kpi.value}
</span>

// Texto corriente — puede quedarse con Barlow heredado
<p className="text-sm text-helix-muted">
  Última actualización: hoy
</p>
```

---

## 7. Componentes Clave y Cómo Usan los Tokens

### Tarjeta de Actividad (Scrum Board)
```tsx
<div
  className="rounded-[var(--helix-r-large)] border border-[var(--helix-line)] bg-helix-card
             shadow-helix-task hover:shadow-helix-soft transition-shadow"
  style={{ transition: "var(--helix-transition-md)" }}
>
  {/* Indicador de prioridad */}
  <div className="h-1 rounded-t-[var(--helix-r-large)]"
       style={{ background: "var(--helix-accent)" }} />
  ...
</div>
```

### Barra de progreso
```tsx
<div className="h-2 rounded-[var(--helix-r-full)] bg-helix-bar-track overflow-hidden">
  <div
    className="h-full rounded-[var(--helix-r-full)]"
    style={{
      width: `${avance}%`,
      background: "var(--helix-grad-bar)",
      boxShadow: "0 0 12px rgba(0,168,200,0.22)"
    }}
  />
</div>
```

### Badge de estado
```tsx
// Terminado
<span className="px-2 py-0.5 rounded-[var(--helix-r-full)] text-[length:var(--helix-text-caption)]
                 font-semibold bg-helix-done/10 text-[#116b49]">
  Terminado
</span>
```

### KPI card del Dashboard
```tsx
<div
  className="rounded-[var(--helix-r-large)] shadow-helix-card border border-[var(--helix-line)]"
  style={{ background: "var(--helix-stat-card)" }}
>
  <p className="font-helix font-black text-[length:var(--helix-text-hero)] text-helix-accent">
    {value}
  </p>
  <p className="text-[length:var(--helix-text-body-sm)] text-helix-muted">
    {label}
  </p>
</div>
```

### Botón primario de Helix
```tsx
<button
  className="rounded-[var(--helix-r-regular)] px-4 py-2 font-helix font-bold text-white
             text-[length:var(--helix-text-body-def)]"
  style={{
    background: "var(--helix-grad-brand)",
    boxShadow: "var(--helix-shadow-btn)",
    transition: "var(--helix-transition)"
  }}
>
  {label}
</button>
```

---

## 8. Checklist de Implementación

- [ ] Crear `frontend/src/styles/helix.css` con todas las variables CSS
- [ ] Extender `tailwind.config.js` con colores, fuentes y sombras de Helix
- [ ] Crear `frontend/src/lib/helixTokens.ts` con constantes para JS
- [ ] Crear `HelixProvider.tsx` con el scope `data-module="helix"`
- [ ] Usar `font-helix` solo en headings y KPIs; mantener Barlow en texto corriente
- [ ] Importar `helix.css` únicamente desde `HelixProvider.tsx`
- [ ] Validar que los tokens de estado (colores de semáforo) se usen consistentemente
- [ ] Verificar que la fuente Montserrat carga correctamente (Google Fonts o local)
- [ ] Confirmar que el scope CSS no filtra estilos fuera del módulo Helix
