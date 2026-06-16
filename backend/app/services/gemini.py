import json
from google import genai
from google.genai import types
from app.config import settings
from app.models import User
from app.schemas import DiagnosisInput, DiagnosisResult

# Initialisation du client officiel Google GenAI
client = genai.Client(api_key=settings.GEMINI_API_KEY)

def analyser_symptomes_ia(form: DiagnosisInput, user: User) -> dict:
    """
    Analyse les symptômes en utilisant Gemini en forçant une réponse JSON stricte 
    conforme au modèle DiagnosisResult attendu par le frontend.
    """
    prompt = f"""
    Vous êtes un médecin expert et un assistant clinique virtuel. Analysez les données du patient suivant :
    - Âge : {form.age}
    - Sexe : {form.sexe}
    - Poids : {form.poids} kg
    - Allergies connues : {user.allergies or "Aucune"}
    - Antécédents médicaux : {user.antecedents or "Aucun"}
    - Symptômes actuels : {form.symptomes}
    - Intensité déclarée : {form.intensite}/10
    - Durée des troubles : {form.duree}

    Évaluez minutieusement le degré d'urgence ('critique', 'modere', ou 'faible').
    Prenez impérativement en compte ses allergies pour éliminer tout risque d'interaction médicamenteuse dans vos conseils.
    """

    # Appel de l'API Gemini avec Structured Outputs
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction="Vous êtes un assistant de santé algorithmique de haute précision. Vous devez impérativement formuler des conseils avisés et structurer votre réponse exactement selon le format JSON requis.",
            response_mime_type="application/json",
            response_schema=DiagnosisResult,
            temperature=0.2
        ),
    )
    
    return json.loads(response.text)

def generer_reponse_chatbot(user_message: str, history: list, user: User) -> str:
    """
    Génère une réponse conversationnelle pour MadaBot en maintenant le contexte.
    """
    system_prompt = f"""
    Vous êtes MadaBot, l'assistant de santé virtuel bienveillant de la plateforme MadaDoc AI.
    Vous parlez à l'utilisateur : {user.name}.
    Ses allergies : {user.allergies or 'Aucune'}. Ses antécédents : {user.antecedents or 'Aucun'}.
    
    Règles de conduite :
    1. Répondez de manière concise, chaleureuse et professionnelle.
    2. Si l'utilisateur décrit des signes de détresse vitale (oppression poitrine, étouffement, etc.), dites-lui immédiatement et clairement de contacter le SAMU (15 / 112).
    3. Vous pouvez donner des conseils généraux mais rappelez que vous ne remplacez pas une consultation médicale directe.
    """
    
    # Reconstruction de l'historique pour le SDK Gemini
    contents = []
    for msg in history:
        role = "user" if msg.get("sender") == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg.get("text"))]))
    
    # Ajout du dernier message utilisateur
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7
        )
    )
    return response.text