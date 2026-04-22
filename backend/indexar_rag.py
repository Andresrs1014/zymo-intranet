"""
Script de indexación RAG — ZYMO Intranet
Uso: docker exec -i zymo-intranet-backend-1 python3 indexar_rag.py

Flujo:
  1. Detecta si hubo intentos previos (directorio lightrag con datos)
  2. Si los hubo, limpia antes de indexar para evitar corrupción
  3. Indexa todos los archivos .md encontrados en /app/data/agent_docs/
"""
import asyncio
import shutil
import sys
from pathlib import Path

LIGHTRAG_DIR = Path("/app/data/lightrag")
DOCS_DIR = Path("/app/data/agent_docs")


def verificar_intento_previo() -> bool:
    """Retorna True si existe un intento previo de indexación."""
    if not LIGHTRAG_DIR.exists():
        return False
    archivos = list(LIGHTRAG_DIR.rglob("*"))
    return len(archivos) > 0


def limpiar_lightrag():
    """Elimina el directorio lightrag y lo recrea vacío."""
    if LIGHTRAG_DIR.exists():
        shutil.rmtree(LIGHTRAG_DIR)
        print(f"  Directorio {LIGHTRAG_DIR} eliminado.")
    LIGHTRAG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  Directorio {LIGHTRAG_DIR} recreado limpio.")


async def indexar_todo():
    from app.agents.lightrag_service import indexar_texto

    archivos = sorted(DOCS_DIR.rglob("*.md"))

    if not archivos:
        print(f"\n[!] No se encontraron archivos .md en {DOCS_DIR}")
        print("    Verifica que los archivos estén en /app/data/agent_docs/")
        sys.exit(1)

    print(f"\nArchivos encontrados: {len(archivos)}")
    print("-" * 50)

    ok_count = 0
    fail_count = 0
    skip_count = 0

    for i, f in enumerate(archivos, 1):
        try:
            texto = f.read_text(encoding="utf-8", errors="ignore").strip()

            if not texto:
                print(f"  [{i}/{len(archivos)}] SKIP  {f.name} — vacío")
                skip_count += 1
                continue

            print(f"  [{i}/{len(archivos)}] ->    {f.name} ({len(texto):,} chars)...")
            ok = await indexar_texto(texto)

            if ok:
                print(f"  [{i}/{len(archivos)}] OK    {f.name}")
                ok_count += 1
            else:
                print(f"  [{i}/{len(archivos)}] FAIL  {f.name}")
                fail_count += 1

        except Exception as e:
            print(f"  [{i}/{len(archivos)}] ERROR {f.name}: {e}")
            fail_count += 1

    print("-" * 50)
    print(f"\nResultado: {ok_count} OK  |  {fail_count} FAIL  |  {skip_count} SKIP")

    if fail_count > 0:
        print("\n[!] Algunos archivos fallaron. Revisa los logs del backend para más detalle.")
        sys.exit(1)
    else:
        print("\n[✓] Indexación completada.")


def main():
    print("=" * 50)
    print("  ZYMO RAG — Indexación de documentos")
    print("=" * 50)

    # Verificar intentos previos
    if verificar_intento_previo():
        print("\n[!] Se detectó un intento previo de indexación.")
        print("    Limpiando datos corruptos antes de reiniciar...")
        limpiar_lightrag()
    else:
        print("\n[✓] No hay datos previos. Iniciando indexación limpia.")
        LIGHTRAG_DIR.mkdir(parents=True, exist_ok=True)

    # Indexar
    print("\nIniciando indexación...")
    asyncio.run(indexar_todo())


if __name__ == "__main__":
    main()
