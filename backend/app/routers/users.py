from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, require_compras
from app.database import get_db
from app.models.user import User
from sqlmodel import Session

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Alias de /auth/me para compatibilidad futura."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "sede": current_user.sede,
        "area": current_user.area,
    }


@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user: User = Depends(require_compras),
    db: Session = Depends(get_db),
):
    """Retorna datos básicos de un usuario por ID (para resolver nombres de auxiliares)."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "area": user.area,
    }
