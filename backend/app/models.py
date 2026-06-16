import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="patient")
    
    # Dossier médical permanent (géré à vide par défaut à l'inscription)
    allergies = Column(Text, default="")
    antecedents = Column(Text, default="")
    avatar = Column(Text, default="")  # Stockage de la chaîne de caractères Base64

    # Relation un-à-plusieurs vers l'historique des consultations
    histories = relationship("DiagnosisHistory", back_populates="user", cascade="all, delete-orphan")


class DiagnosisHistory(Base):
    __tablename__ = "diagnosis_histories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Données cliniques d'entrée fournies par le patient
    age = Column(String, nullable=False)
    sexe = Column(String, nullable=False)
    poids = Column(String, nullable=False)
    symptomes = Column(Text, nullable=False)
    intensite = Column(Integer, nullable=False)
    duree = Column(String, nullable=False)
    
    # Instantané (snapshot) du dossier médical au moment de cette consultation exacte
    allergies_snapshot = Column(Text, default="")
    antecedents_snapshot = Column(Text, default="")
    
    # Résultat médical structuré complet retourné par l'IA Gemini (stocké au format JSON stringifié)
    result_json = Column(Text, nullable=False)

    user = relationship("User", back_populates="histories")