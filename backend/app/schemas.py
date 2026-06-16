from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# =========================================================================
# 1. SCHÉMAS POUR L'AUTHENTIFICATION ET LE PROFIL
# =========================================================================

class UserRegister(BaseModel):
    """Données requises pour l'inscription d'un nouveau patient."""
    name: str = Field(..., min_length=2, description="Nom complet du patient")
    email: EmailStr = Field(..., description="Adresse email valide")
    password: str = Field(..., min_length=6, description="Mot de passe d'au moins 6 caractères")
    avatar: Optional[str] = Field("", description="Chaîne de caractères Base64 de l'avatar")


class UserLogin(BaseModel):
    """Données requises pour la connexion."""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Données modifiables par l'utilisateur depuis son profil."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    avatar: Optional[str] = None


class UserResponse(BaseModel):
    """Données du profil renvoyées par l'API (Sécurisé : exclut le mot de passe)."""
    id: str
    name: str
    email: EmailStr
    role: str
    avatar: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Format du jeton de sécurité renvoyé après authentification ou mise à jour."""
    access_token: str
    token_type: str


# =========================================================================
# 2. SCHÉMAS POUR LE MOTEUR CLINIQUE GEMINI (RÉPONSES STRUCTURÉES)
# =========================================================================

class DiagnosisInput(BaseModel):
    """Formulaire de symptômes soumis par le patient."""
    age: str = Field(..., description="Ex: '34 ans' ou '6 mois'")
    sexe: str = Field(..., description="Masculin ou Féminin")
    poids: str = Field(..., description="Poids en kg")
    symptomes: str = Field(..., description="Description textuelle des maux")
    intensite: int = Field(..., ge=1, le=10, description="Échelle de douleur de 1 à 10")
    duree: str = Field(..., description="Ex: '3 jours', '2 heures'")


class MedicamentSchema(BaseModel):
    """Structure d'un médicament dans l'ordonnance simulée."""
    nom: str = Field(..., description="Nom du médicament")
    posologie: str = Field(..., description="Instructions de prise")
    duree: str = Field(..., description="Durée totale du traitement")
    alerte: str = Field(..., description="Contre-indications ou effets secondaires notables")


class NutritionSchema(BaseModel):
    """Recommandations alimentaires générées par l'IA."""
    conseilles: List[str] = Field(..., description="Aliments ou boissons fortement recommandés")
    legumesFruits: List[str] = Field(..., description="Fruits et légumes locaux bénéfiques")
    interdits: List[str] = Field(..., description="Aliments à proscrire temporairement")
    hydratation: str = Field(..., description="Conseils spécifiques sur la consommation d'eau/liquides")


class DiagnosisResult(BaseModel):
    """
    Format final strict renvoyé par l'IA Gemini 2.5 et le backend.
    Sert de schéma de validation de sortie pour 'application/json'.
    """
    urgence: str = Field(..., description="Degré d'urgence : 'critique', 'modere', ou 'faible'")
    titreDiagnostic: str = Field(..., description="Nom ou nature de l'affection suspectée")
    explication: str = Field(..., description="Analyse vulgarisée de l'état de santé")
    medicaments: List[MedicamentSchema] = Field(..., description="Liste des médicaments suggérés")
    nutrition: NutritionSchema = Field(..., description="Plan nutritionnel adapté")
    actionRequise: str = Field(..., description="Consigne immédiate pour le patient (ex: repos, consultation)")


# =========================================================================
# 3. SCHÉMAS POUR L'HISTORIQUE ET LE CHATBOT
# =========================================================================

class HistoryResponse(BaseModel):
    """Format de retour pour un élément de l'historique des consultations."""
    id: int
    date: datetime
    input_data: Dict[str, Any]  # Contient le dictionnaire des données saisies par le patient
    result: Dict[str, Any]      # Contient l'objet DiagnosisResult généré à l'époque

    class Config:
        from_attributes = True


class ChatMessageInput(BaseModel):
    """Message envoyé à MadaBot contenant le texte actuel et l'historique des échanges."""
    text: str = Field(..., description="Nouveau message de l'utilisateur")
    history: List[Dict[str, str]] = Field(
        ..., 
        description="Mémoire de la discussion sous la forme: [{'sender': 'user'|'bot', 'text': '...'}]"
    )