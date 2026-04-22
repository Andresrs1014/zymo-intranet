"""
Script de indexación RAG — ZYMO Intranet

Uso (en el servidor, desde ~/apps/zymo-intranet/backend/):
    python3 indexar_rag.py

Flujo:
  1. Detecta si hubo intentos previos (directorio lightrag con datos)
  2. Si los hubo, limpia antes de indexar para evitar corrupción
  3. Indexa todos los archivos .md de las dos carpetas de contexto
"""
import asyncio
import os
import shutil
import sys
from pathlib import Path

# ── Rutas — ajustar si cambian en el servidor ──────────────────────────────────

# Directorio de trabajo de LightRAG (se sobreescribe con env var si existe)
LIGHTRAG_DIR = Path(os.getenv("LIGHTRAG_WORKING_DIR", "/home/analista_desarrollo/apps/zymo-intranet/backend/data/lightrag"))

# Carpetas con los archivos .md a indexar
DOCS_DIRS = [
    Path("/tmp/docs_zymo"),
    Path("/tmp/docs_zymo_administrativo"),
]


# ── Lógica principal ───────────────────────────────────────────────────────────

def verificar_intento_previo() -> bool:
    if not LIGHTRAG_DIR.exists():
        return False
    return any(LIGHTRAG_DIR.rglob("*"))


def limpiar_lightrag():
    if LIGHTRAG_DIR.exists():
        shutil.rmtree(LIGHTRAG_DIR)
        print(f"  Directorio {LIGHTRAG_DIR} eliminado.")
    LIGHTRAG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  Directorio {LIGHTRAG_DIR} recreado limpio.")


async def indexar_todo():
    # Sobreescribir la ruta de LightRAG en settings para que el singleton use la correcta
    os.environ["LIGHTRAG_WORKING_DIR"] = str(LIGHTRAG_DIR)

    from app.agents.lightrag_service import indexar_texto

    # Recopilar todos los .md de todas las carpetas
    archivos = []
    for d in DOCS_DIRS:
        if not d.exists():
            print(f"  [!] Carpeta no encontrada: {d} — se omite")
            continue
        encontrados = sorted(d.rglob("*.md"))
        print(f"  {len(encontrados):>3} archivos en {d}")
        archivos.extend(encontrados)

    if not archivos:
        print("\n[!] No se encontraron archivos .md en ninguna carpeta.")
        sys.exit(1)

    print(f"\nTotal a indexar: {len(archivos)} archivos")
    print("-" * 52)

    ok_count = 0
    fail_count = 0
    skip_count = 0

    for i, f in enumerate(archivos, 1):
        try:
            texto = f.read_text(encoding="utf-8", errors="ignore").strip()

            if not texto:
                print(f"  [{i:>2}/{len(archivos)}] SKIP  {f.name}")
                skip_count += 1
                continue

            print(f"  [{i:>2}/{len(archivos)}] ->    {f.name} ({len(texto):,} chars)...")
            ok = await indexar_texto(texto)

            if ok:
                print(f"  [{i:>2}/{len(archivos)}] OK    {f.name}")
                ok_count += 1
            else:
                print(f"  [{i:>2}/{len(archivos)}] FAIL  {f.name}")
                fail_count += 1

        except Exception as e:
            print(f"  [{i:>2}/{len(archivos)}] ERROR {f.name}: {e}")
            fail_count += 1

    print("-" * 52)
    print(f"\nResultado:  {ok_count} OK  |  {fail_count} FAIL  |  {skip_count} SKIP")

    if fail_count > 0:
        print("\n[!] Algunos archivos fallaron. Revisa los logs para más detalle.")
        sys.exit(1)
    else:
        print("\n[✓] Indexación completada exitosamente.")


def main():
    print("=" * 52)
    print("  ZYMO RAG — Indexación de documentos")
    print("=" * 52)
    print(f"\nLightRAG dir : {LIGHTRAG_DIR}")
    for d in DOCS_DIRS:
        print(f"Docs dir     : {d}")

    if verificar_intento_previo():
        print("\n[!] Intento previo detectado — limpiando antes de indexar...")
        limpiar_lightrag()
    else:
        print("\n[✓] Sin datos previos. Indexación limpia.")
        LIGHTRAG_DIR.mkdir(parents=True, exist_ok=True)

    print("\nIniciando indexación...")
    asyncio.run(indexar_todo())


if __name__ == "__main__":
    main()
