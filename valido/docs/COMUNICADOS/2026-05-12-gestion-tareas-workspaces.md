# Gestión de Tareas — Workspaces por Líder

> Fecha: Mayo 2026
> Destinatarios: Líderes de equipo, Administradores

---

## ¿Qué cambia?

A partir de esta actualización, cada líder con acceso a **Gestión de Tareas** tiene su **propio workspace** independiente.

### Antes

```
Líder A + Líder B → Veían el mismo equipo "Desarrollo e Innovación"
```

### Ahora

```
Líder A → Workspace de Líder A (su equipo, sus tareas, sus miembros)
Líder B → Workspace de Líder B (su equipo, sus tareas, sus miembros)
```

---

## ¿Qué significa esto en la práctica?

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Equipo** | Compartido por todos | Cada líder crea su propio equipo |
| **Miembros** | Los mismos para todos | El líder agrega sus propios miembros |
| **Tareas** | Visibles para todo el equipo | Solo el líder y sus miembros ven las tareas |
| **KPIs y Gráficas** | Aggregate de todo el equipo | Solo datos del workspace |
| **Listas** | Valores predefinidos | El líder configura sus propios estados, etiquetas y plataformas |

---

## ¿Qué debe hacer el líder?

1. **Ingresar a Gestión de Tareas**
2. **Ir al Tab 3 (Configuración)**
3. **Agregar sus propios valores:**
   - Estados (ej: "En desarrollo", "Listo para test", "Completada")
   - Etiquetas (ej: "Bug", "Feature", "Refactor")
   - Plataformas (ej: "Logimat 1", "Logimat 2")
4. **Ir a "Configurar equipo"** para agregar los miembros de su equipo

---

## ¿Qué deben hacer los administradores?

1. Asignar la herramienta `tool_task_manage_dev` al usuario que será líder de equipo
2. Cada líder recibe automáticamente un workspace vacío
3. Los miembros del equipo deben ser agregados por el líder desde la herramienta

---

## Notas técnicas

- Los workspaces son **completamente independientes** entre sí
- Un usuario加入 a un workspace **no ve** las tareas de otro workspace
- Los administradores pueden ver todos los workspaces asignando la tool a múltiples usuarios

---

## Preguntas frecuentes

**¿Un líder puede ver el workspace de otro líder?**
No. Cada líder solo ve su propio workspace.

**¿Un miembro puede pertenecer a varios workspaces?**
Sí. Un usuario puede ser agregado por múltiples líderes a sus respectivos equipos.

**¿Se pierden los datos anteriores?**
No. El equipo existente se migró al primer administrador asignado.

---

## Contacto

Para soporte, contactar al equipo de desarrollo.