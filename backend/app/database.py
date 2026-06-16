from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# En production sur Render, il faut configurer le pool de connexions
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,             # Limite le nombre de connexions simultanées sur l'instance Free
    max_overflow=10,         # Connexions temporaires supplémentaires autorisées
    pool_recycle=300,        # Recycler les connexions toutes les 5 minutes pour éviter les coupures Render
    pool_pre_ping=True       # 🚀 CRUCIAL : Vérifie que la connexion est vivante avant chaque requête
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()