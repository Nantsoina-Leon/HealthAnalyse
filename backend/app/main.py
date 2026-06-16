import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from app.config import settings
from app.database import engine, Base, get_db
import app.models as models
import app.schemas as schemas
import app.auth as auth
from app.services.gemini import analyser_symptomes_ia, generer_reponse_chatbot

# Création automatique des tables au démarrage
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version="2026.1.0")

executor = ThreadPoolExecutor(max_workers=4)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # On teste avec * pour lever tout doute
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# =========================================================================
# 1. MODULE D'AUTHENTIFICATION (ROUTES PUBLIQUES)
# =========================================================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)): # 🚀 Ajout de async
    db_user = db.query(models.User).filter(models.User.email == user_in.email.lower()).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Un compte existe déjà avec cette adresse email."
        )
    
    new_user = models.User(
        id=auth.generate_user_id(),
        name=user_in.name,
        email=user_in.email.lower(),
        hashed_password=auth.get_password_hash(user_in.password),
        avatar=user_in.avatar
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/auth/login", response_model=schemas.TokenResponse)
async def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)): # 🚀 Ajout de async
    user = db.query(models.User).filter(models.User.email == credentials.email.lower()).first()
    if not user or not auth.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Identifiants de connexion incorrects."
        )
    
    token = auth.create_access_token(user)
    return {"access_token": token, "token_type": "bearer"}


# =========================================================================
# 2. MODULE DE GESTION DU PROFIL UTILISATEUR (ROUTE SÉCURISÉE)
# =========================================================================

@app.put("/api/user/profile", response_model=schemas.TokenResponse)
async def update_profile( # 🚀 Ajout de async (Régle l'erreur ERR_CONNECTION_CLOSED)
    user_update: schemas.UserUpdate, 
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    if user_update.email and user_update.email.lower() != current_user.email:
        email_conflict = db.query(models.User).filter(models.User.email == user_update.email.lower()).first()
        if email_conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Cette adresse email est déjà utilisée."
            )
        current_user.email = user_update.email.lower()

    if user_update.name: 
        current_user.name = user_update.name
    if user_update.avatar: 
        current_user.avatar = user_update.avatar
    if user_update.password: 
        current_user.hashed_password = auth.get_password_hash(user_update.password)

    db.commit()
    db.refresh(current_user)
    
    new_token = auth.create_access_token(current_user)
    return {"access_token": new_token, "token_type": "bearer"}


# =========================================================================
# 3. MODULE DU MOTEUR CLINIQUE ET DE L'HISTORIQUE (ROUTES SÉCURISÉES)
# =========================================================================

@app.post("/api/analysis/launch", response_model=schemas.DiagnosisResult)
async def launch_analysis( # 🚀 Reste en async def
    analysis_input: schemas.DiagnosisInput, 
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    try:
        loop = asyncio.get_running_loop()
        result_data = await loop.run_in_executor(
            executor, 
            analyser_symptomes_ia, 
            analysis_input, 
            current_user
        )
        
        new_history = models.DiagnosisHistory(
            user_id=current_user.id,
            age=analysis_input.age,
            sexe=analysis_input.sexe,
            poids=analysis_input.poids,
            symptomes=analysis_input.symptomes,
            intensite=analysis_input.intensite,
            duree=analysis_input.duree,
            allergies_snapshot=current_user.allergies,
            antecedents_snapshot=current_user.antecedents,
            result_json=json.dumps(result_data)
        )
        db.add(new_history)
        db.commit()
        
        return result_data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Erreur lors du traitement de l'analyse clinique : {str(e)}"
        )


@app.get("/api/analysis/history", response_model=List[schemas.HistoryResponse])
async def get_history( # 🚀 Ajout de async
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    histories = db.query(models.DiagnosisHistory)\
                  .filter(models.DiagnosisHistory.user_id == current_user.id)\
                  .order_by(models.DiagnosisHistory.date.desc()).all()
    
    formatted_history = []
    for h in histories:
        formatted_history.append({
            "id": h.id,
            "date": h.date,
            "input_data": {
                "age": h.age, "sexe": h.sexe, "poids": h.poids, "symptomes": h.symptomes,
                "intensite": h.intensite, "duree": h.duree, 
                "allergies": h.allergies_snapshot, "antecedents": h.antecedents_snapshot
            },
            "result": json.loads(h.result_json)
        })
    return formatted_history


@app.delete("/api/analysis/history/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_item( # 🚀 Ajout de async
    history_id: int, 
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    item = db.query(models.DiagnosisHistory)\
             .filter(models.DiagnosisHistory.id == history_id, models.DiagnosisHistory.user_id == current_user.id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Élément d'historique introuvable ou non autorisé."
        )
    db.delete(item)
    db.commit()


@app.delete("/api/analysis/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_history( # 🚀 Ajout de async
    current_user: models.User = Depends(auth.get_current_user), 
    db: Session = Depends(get_db)
):
    db.query(models.DiagnosisHistory).filter(models.DiagnosisHistory.user_id == current_user.id).delete()
    db.commit()


# =========================================================================
# 4. MODULE CONVERSATIONNEL - MADABOT (ROUTE SÉCURISÉE)
# =========================================================================

@app.post("/api/chat/message")
async def chat_message(
    payload: schemas.ChatMessageInput, 
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        loop = asyncio.get_running_loop()
        reply = await loop.run_in_executor(
            executor, 
            generer_reponse_chatbot, 
            payload.text, 
            payload.history, 
            current_user
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Erreur de communication avec MadaBot : {str(e)}"
        )