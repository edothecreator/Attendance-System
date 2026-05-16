"""Initialize database tables, seed modules, and create default users."""
import asyncio
from app.database import engine, Base, async_session
from app.models import User, Student, FaceEmbedding, Module, Session, AttendanceRecord
from app.auth import hash_password
from sqlalchemy import select


MODULES = [
    {"name": "Analyse Numérique", "code": "AN"},
    {"name": "Algèbre", "code": "ALG"},
    {"name": "Programmation Orientée Objet", "code": "POO"},
    {"name": "Bases de Données", "code": "BD"},
    {"name": "Réseaux Informatiques", "code": "RI"},
    {"name": "Systèmes d'Exploitation", "code": "SE"},
    {"name": "Probabilités et Statistiques", "code": "PS"},
]

# Each professor gets assigned to one module
PROFESSORS = [
    {"username": "prof.benali", "password": "prof123", "name": "Prof. Benali", "module_code": "AN"},
    {"username": "prof.tazi", "password": "prof123", "name": "Prof. Tazi", "module_code": "ALG"},
    {"username": "prof.amrani", "password": "prof123", "name": "Prof. Amrani", "module_code": "POO"},
    {"username": "prof.kabbaj", "password": "prof123", "name": "Prof. Kabbaj", "module_code": "BD"},
    {"username": "prof.mouline", "password": "prof123", "name": "Prof. Mouline", "module_code": "RI"},
    {"username": "prof.hajji", "password": "prof123", "name": "Prof. Hajji", "module_code": "SE"},
    {"username": "prof.zerouali", "password": "prof123", "name": "Prof. Zerouali", "module_code": "PS"},
]


async def init():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully.")

    async with async_session() as db:
        # Check if already seeded
        result = await db.execute(select(User))
        if result.scalars().first():
            print("Database already seeded. Skipping.")
            return

        # Seed modules
        module_map = {}
        for m in MODULES:
            module = Module(**m)
            db.add(module)
            await db.flush()
            module_map[m["code"]] = module.id
        print(f"Seeded {len(MODULES)} modules.")

        # Create admin account
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            name="Administrator",
            role="admin",
            module_id=None,
        )
        db.add(admin)
        print("Created admin account (admin / admin123)")

        # Create professor accounts
        for prof in PROFESSORS:
            user = User(
                username=prof["username"],
                password_hash=hash_password(prof["password"]),
                name=prof["name"],
                role="professor",
                module_id=module_map[prof["module_code"]],
            )
            db.add(user)
        print(f"Created {len(PROFESSORS)} professor accounts (password: prof123)")

        await db.commit()

    print("\n--- Login Credentials ---")
    print("Admin:  admin / admin123")
    print("Profs:  prof.benali / prof123  (and similar for each professor)")


if __name__ == "__main__":
    asyncio.run(init())
