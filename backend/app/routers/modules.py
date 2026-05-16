from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Module
from app.schemas import ModuleCreate, ModuleResponse
from app.auth import require_admin, get_current_user

router = APIRouter()


@router.post("/", response_model=ModuleResponse, status_code=201)
async def create_module(
    data: ModuleCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new module (admin only)."""
    existing = await db.execute(select(Module).where(Module.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Module code '{data.code}' already exists.")

    module = Module(
        name=data.name,
        code=data.code,
        total_weeks=data.total_weeks,
    )
    db.add(module)
    await db.flush()

    return ModuleResponse(
        id=module.id,
        name=module.name,
        code=module.code,
        professor=None,
        total_weeks=module.total_weeks,
        created_at=module.created_at,
    )


@router.get("/", response_model=list[ModuleResponse])
async def list_modules(db: AsyncSession = Depends(get_db)):
    """List all modules (public - needed for login context)."""
    from app.models import User

    result = await db.execute(select(Module).order_by(Module.name))
    modules = result.scalars().all()

    responses = []
    for m in modules:
        # Get professor name if assigned
        prof_name = None
        prof_q = await db.execute(select(User).where(User.module_id == m.id))
        prof = prof_q.scalar_one_or_none()
        if prof:
            prof_name = prof.name

        responses.append(ModuleResponse(
            id=m.id,
            name=m.name,
            code=m.code,
            professor=prof_name,
            total_weeks=m.total_weeks,
            created_at=m.created_at,
        ))

    return responses

    return responses


@router.delete("/{module_id}", status_code=204)
async def delete_module(
    module_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a module (admin only)."""
    result = await db.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found.")
    await db.delete(module)
    await db.flush()
