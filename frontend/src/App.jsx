import React, { useState, useEffect, useRef } from 'react';
import { 
  Stethoscope, 
  User, 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  Droplet, 
  Apple, 
  Ban, 
  Loader2, 
  Heart, 
  Clock, 
  Sparkles, 
  FileText,
  UserCheck,
  Plus,
  Trash2,
  ChevronRight,
  Info,
  History,
  Lock,
  Mail,
  LogOut,
  Key,
  Eye,
  EyeOff,
  UserPlus,
  Database,
  Upload,
  Camera,
  X,
  MessageSquare,
  Send,
  Bot,
  UserCog,
  Save
} from 'lucide-react';

// URL de base de votre API FastAPI
const API_BASE_URL = "https://madadoc-backend.onrender.com/api";

// Utilitaire de décodage manuel des claims du JWT
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function MadadocAI() {
  // --- ÉTATS GLOBAUX ---
  const [token, setToken] = useState(localStorage.getItem('madadoc_token') || null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('analyse'); 
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // --- ÉTATS AUTHENTIFICATION ---
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [avatarBase64, setAvatarBase64] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- ÉTATS MODIFICATION DU PROFIL ---
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // --- ÉTATS MOTEUR DE DIAGNOSTIC ---
  const [diagnosticForm, setDiagnosticForm] = useState({
    age: '', sexe: 'Masculin', poids: '', symptomes: '', intensite: 5, duree: ''
  });
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);

  // --- ÉTATS HISTORIQUE ---
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- ÉTATS CHATBOT (MADABOT) ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: 'Bonjour ! Je suis MadaBot. Comment puis-je vous aider aujourd\'hui ?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  const chatEndRef = useRef(null);

  // --- EFFET : ANALYSE ET MISE À JOUR DU CURRENT USER DEPUIS LE JWT ---
  useEffect(() => {
    if (token) {
      localStorage.setItem('madadoc_token', token);
      const decoded = decodeJWT(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        const userObj = {
          id: decoded.sub,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role,
          avatar: decoded.avatar
        };
        setCurrentUser(userObj);
        // Initialise le formulaire de profil avec les données actuelles
        setProfileForm({ name: decoded.name, email: decoded.email });
        setProfileAvatar(decoded.avatar || '');
      } else {
        handleLogout();
      }
    } else {
      localStorage.removeItem('madadoc_token');
      setCurrentUser(null);
    }
  }, [token]);

  // --- EFFET : CHARGEMENT DE L'HISTORIQUE DEPUIS L'API ---
  useEffect(() => {
    if (currentUser && activeTab === 'historique') {
      fetchHistory();
    }
  }, [currentUser, activeTab]);

  // --- EFFET : DEFILEMENT CHAT ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const triggerNotification = (type, message) => {
    if (type === 'error') {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // =========================================================================
  // APPELS API : AUTHENTIFICATION
  // =========================================================================
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg('');

    try {
      if (isRegisterMode) {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: authForm.name,
            email: authForm.email,
            password: authForm.password,
            avatar: avatarBase64
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Échec de l'inscription.");
        
        triggerNotification('success', "Compte créé avec succès ! Connectez-vous.");
        setIsRegisterMode(false);
        setAuthForm(prev => ({ ...prev, password: '' }));
      } else {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Identifiants invalides.");
        
        setToken(data.access_token);
        triggerNotification('success', "Connexion réussie !");
      }
    } catch (err) {
      triggerNotification('error', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setCurrentResult(null);
    setHistoryList([]);
    setAvatarBase64('');
    setProfileAvatar('');
    setAuthForm({ name: '', email: '', password: '' });
    setActiveTab('analyse');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerNotification('error', "L'image ne doit pas dépasser 2 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setAvatarBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // =========================================================================
  // APPELS API : MODIFICATION DU PROFIL
  // =========================================================================
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileForm.name,
          avatar: profileAvatar
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || "Impossible de mettre à jour le profil.");
      
      // Si l'API renvoie un nouveau token mis à jour
      if (data.access_token) {
        setToken(data.access_token);
      } else {
        // Sinon, on met simplement à jour l'état local du user
        setCurrentUser(prev => ({
          ...prev,
          name: profileForm.name,
          avatar: profileAvatar
        }));
      }
      
      triggerNotification('success', "Votre profil a été mis à jour avec succès.");
    } catch (err) {
      triggerNotification('error', err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerNotification('error', "L'image ne doit pas dépasser 2 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setProfileAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // =========================================================================
  // APPELS API : MOTEUR CLINIQUE ET HISTORIQUE
  // =========================================================================
  const handleLaunchAnalysis = async (e) => {
    e.preventDefault();
    if (!diagnosticForm.symptomes.trim()) return;
    
    setAnalysisLoading(true);
    setCurrentResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/analysis/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(diagnosticForm)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || "Une erreur est survenue lors de l'analyse.");
      
      setCurrentResult(data);
      triggerNotification('success', "Analyse clinique terminée avec succès.");
    } catch (err) {
      triggerNotification('error', err.message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Erreur historique:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistoryItem = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/analysis/history/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setHistoryList(prev => prev.filter(item => item.id !== id));
        triggerNotification('success', "Consultation supprimée.");
      }
    } catch (err) {
      triggerNotification('error', "Impossible de supprimer cet élément.");
    }
  };

  // =========================================================================
  // APPELS API : CHATBOT MADABOT
  // =========================================================================
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    
    const updatedMessages = [...chatMessages, { sender: 'user', text: userMessage }];
    setChatMessages(updatedMessages);
    setChatLoading(true);

    try {
      const formattedHistory = updatedMessages.slice(1, -1); 

      const res = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: userMessage,
          history: formattedHistory
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "MadaBot est indisponible.");

      setChatMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'bot', text: `Désolé, j'ai rencontré une erreur : ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // =========================================================================
  // INTERFACE 1 : ÉCRAN D'AUTHENTIFICATION
  // =========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
        
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-30 bg-gradient-to-tr from-emerald-50 via-white to-teal-50" />
        
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden opacity-20">
          <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tr from-emerald-300 to-teal-300 blur-[130px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-emerald-200 to-green-200 blur-[130px]" />
        </div>

        <div className="sm:mx-auto w-full max-w-md relative z-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/20 mb-4">
            <Stethoscope className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            MadaDoc AI
          </h2>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto px-2">
            Assistant clinique intelligent et diagnostiqueur algorithmique optimisé par Google Gemini.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto w-full max-w-md relative z-10">
          <div className="bg-white/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-200/80 sm:px-10">
            
            {errorMsg && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-2 text-red-700 text-xs animate-shake">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start space-x-2 text-emerald-700 text-xs">
                <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nom Complet</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="text" required minLength={2}
                        value={authForm.name}
                        onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                        placeholder="Ex: Dr. Jean Rabe"
                        className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Avatar de Profil</label>
                    <div className="flex items-center space-x-4">
                      <div className="h-14 w-14 rounded-xl bg-white border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                        {avatarBase64 ? (
                          <img src={avatarBase64} alt="Previsualisation" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <label className="cursor-pointer bg-white hover:bg-slate-50 border border-slate-300 px-3 py-2 rounded-xl text-xs text-slate-700 font-medium transition-colors shadow-sm select-none">
                        <Upload className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-slate-500 cursor-pointer" /> Choisir une photo
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="email" required
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    placeholder="nom@exemple.com"
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mot de passe</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"} required minLength={6}
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 rounded-xl py-3 pl-10 pr-12 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5 cursor-pointer" /> : <Eye className="h-5 w-5 cursor-pointer" />}
                  </button>
                </div>
              </div>

              <button
                type="submit" disabled={authLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-emerald-500/10 mt-2"
              >
                {authLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : isRegisterMode ? (
                  <UserPlus className="h-5 w-5 mr-2" />
                ) : (
                  <UserCheck className="h-5 w-5 mr-2" />
                )}
                {isRegisterMode ? "Créer mon compte patient" : "Se connecter de manière sécurisée"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center">
              <button
                type="button" onClick={() => { setIsRegisterMode(!isRegisterMode); setErrorMsg(''); }}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer transition-colors"
              >
                {isRegisterMode ? "Vous possédez déjà un compte ? Connectez-vous" : "Nouveau sur la plateforme ? Créez un profil patient"}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // INTERFACE 2 : APPLICATION PRINCIPALE CONNECTÉE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none antialiased text-slate-800">
      
      {/* Barre de navigation supérieure */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                MadaDoc AI
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                Live Engine
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <nav className="flex space-x-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('analyse')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'analyse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Activity className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-emerald-600" /> Analyse clinique
              </button>
              <button
                onClick={() => setActiveTab('historique')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'historique' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <History className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-slate-500" /> Historique
              </button>
              <button
                onClick={() => setActiveTab('profil')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${activeTab === 'profil' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <UserCog className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5 text-blue-600" /> Mon Profil
              </button>
            </nav>

            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
              <div 
                onClick={() => setActiveTab('profil')}
                className="h-9 w-9 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                title="Accéder au profil"
              >
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-bold text-slate-600 text-sm">{currentUser.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{currentUser.name}</p>
                <p className="text-[10px] font-medium text-slate-400 capitalize">{currentUser.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 flex items-center justify-center cursor-pointer transition-all"
                title="Se déconnecter de la session"
              >
                <LogOut className="h-4 w-4 cursor-pointer" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Zone de notifications */}
      {errorMsg && (
        <div className="max-w-4xl mx-auto w-full px-4 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 shadow-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="max-w-4xl mx-auto w-full px-4 mt-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs flex items-center space-x-2 shadow-sm">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Corps principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ONGLET 1 : ANALYSE DES SYMPTOMES */}
        {activeTab === 'analyse' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center space-x-2.5 mb-6 pb-4 border-b border-slate-100">
                <Sparkles className="h-5 w-5 text-emerald-600 animate-spin-slow" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Nouveau Diagnostic</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Décrivez vos maux pour l'algorithme médical.</p>
                </div>
              </div>

              <form onSubmit={handleLaunchAnalysis} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Âge</label>
                    <input
                      type="text" required placeholder="Ex: 32 ans"
                      value={diagnosticForm.age}
                      onChange={(e) => setDiagnosticForm({...diagnosticForm, age: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sexe</label>
                    <select
                      value={diagnosticForm.sexe}
                      onChange={(e) => setDiagnosticForm({...diagnosticForm, sexe: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Masculin">Masculin</option>
                      <option value="Féminin">Féminin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Poids (kg)</label>
                    <input
                      type="number" required placeholder="Ex: 70"
                      value={diagnosticForm.poids}
                      onChange={(e) => setDiagnosticForm({...diagnosticForm, poids: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Durée des troubles</label>
                    <input
                      type="text" required placeholder="Ex: 2 jours"
                      value={diagnosticForm.duree}
                      onChange={(e) => setDiagnosticForm({...diagnosticForm, duree: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Intensité de la douleur</label>
                    <span className="text-xs font-bold text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50">{diagnosticForm.intensite}/10</span>
                  </div>
                  <input
                    type="range" min="1" max="10"
                    value={diagnosticForm.intensite}
                    onChange={(e) => setDiagnosticForm({...diagnosticForm, intensite: parseInt(e.target.value)})}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description complète des symptômes</label>
                  <textarea
                    required rows="4"
                    value={diagnosticForm.symptomes}
                    onChange={(e) => setDiagnosticForm({...diagnosticForm, symptomes: e.target.value})}
                    placeholder="Décrivez avec précision ce que vous ressentez (ex: maux de tête pulsatiles, accompagnés de légères nausées...)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit" disabled={analysisLoading}
                  className="w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-sm text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-emerald-600/10"
                >
                  {analysisLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyse clinique IA en cours...
                    </>
                  ) : (
                    <>
                      <Stethoscope className="h-4 w-4 mr-2" />
                      Lancer l'évaluation médicale
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-6">
              {analysisLoading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm flex flex-col items-center justify-center space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 animate-bounce">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Génération de l'analyse en cours</h4>
                    <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                      L'intelligence artificielle clinique consulte ses connaissances pour structurer vos recommandations...
                    </p>
                  </div>
                </div>
              )}

              {!analysisLoading && !currentResult && (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 shadow-sm">
                  <FileText className="h-10 w-10 text-slate-300" />
                  <p className="text-xs font-medium max-w-xs leading-relaxed">
                    Aucun rapport clinique généré pour le moment. Remplissez le formulaire médical pour lancer l'IA.
                  </p>
                </div>
              )}

              {!analysisLoading && currentResult && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className={`px-6 py-2.5 text-white flex items-center justify-between text-xs font-bold uppercase tracking-wider ${
                      currentResult.urgence === 'critique' ? 'bg-gradient-to-r from-red-600 to-rose-600' :
                      currentResult.urgence === 'modere' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                      'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}>
                      <div className="flex items-center space-x-1.5">
                        <ShieldAlert className="h-4 w-4" />
                        <span>Urgence : {currentResult.urgence}</span>
                      </div>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">Gemini 2.5 Engine</span>
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-extrabold text-slate-900 mb-2">{currentResult.titreDiagnostic}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{currentResult.explication}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                    <h4 className="font-bold text-slate-900 text-sm mb-4 flex items-center">
                      <Heart className="h-4 w-4 text-rose-500 mr-2" /> Proposition thérapeutique indicative
                    </h4>
                    <div className="space-y-3">
                      {currentResult.medicaments?.map((med, index) => (
                        <div key={index} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">{med.nom}</p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Posologie : {med.posologie}</p>
                            {med.alerte && (
                              <p className="text-[10px] text-amber-600 bg-amber-50 inline-block px-1.5 py-0.5 rounded border border-amber-100 font-medium mt-1.5">
                                ⚠ {med.alerte}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600 tracking-wider">
                              <Clock className="h-3 w-3 inline mr-1 -mt-0.5" /> {med.duree}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider flex items-center">
                        <Droplet className="h-3.5 w-3.5 mr-1" /> Recommandés
                      </p>
                      <ul className="space-y-1.5">
                        {currentResult.nutrition?.conseilles?.map((item, i) => (
                          <li key={i} className="text-xs font-medium text-slate-600 flex items-start">
                            <span className="text-emerald-500 mr-1.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-teal-600 uppercase tracking-wider flex items-center">
                        <Apple className="h-3.5 w-3.5 mr-1" /> Fruits & Locaux
                      </p>
                      <ul className="space-y-1.5">
                        {currentResult.nutrition?.legumesFruits?.map((item, i) => (
                          <li key={i} className="text-xs font-medium text-slate-600 flex items-start">
                            <span className="text-teal-500 mr-1.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-red-500 uppercase tracking-wider flex items-center">
                        <Ban className="h-3.5 w-3.5 mr-1" /> Interdits
                      </p>
                      <ul className="space-y-1.5">
                        {currentResult.nutrition?.interdits?.map((item, i) => (
                          <li key={i} className="text-xs font-medium text-slate-600 flex items-start">
                            <span className="text-red-400 mr-1.5">•</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-slate-950 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Action requise immédiate</p>
                      <p className="text-xs font-bold text-slate-200">{currentResult.actionRequise}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-emerald-400 flex-shrink-0 ml-4">
                      <Info className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ONGLET 2 : HISTORIQUE DES REQUÊTES */}
        {activeTab === 'historique' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Historique des diagnostics</h3>
                <p className="text-[11px] text-slate-400 font-medium">Consultez l'ensemble de vos rapports cliniques stockés de manière sécurisée.</p>
              </div>
              <button 
                onClick={fetchHistory}
                className="text-xs text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Actualiser
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 flex justify-center items-center text-slate-400 text-xs">
                <Loader2 className="h-5 w-5 animate-spin mr-2 text-emerald-600" /> Chargement de l'historique...
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium space-y-2">
                <Database className="h-8 w-8 mx-auto text-slate-300" />
                <p>Aucune consultation enregistrée dans votre dossier médical.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyList.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors bg-slate-50/50 flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                          {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={`text-[10px] uppercase font-black tracking-wider px-1.5 rounded ${
                          item.result.urgence === 'critique' ? 'bg-red-100 text-red-700' :
                          item.result.urgence === 'modere' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.result.urgence}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{item.result.titreDiagnostic}</h4>
                        <p className="text-xs text-slate-600 font-medium mt-1 italic">Symptômes : {item.input_data.symptomes}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-400 font-medium flex gap-4">
                        <span>Âge: {item.input_data.age}</span>
                        <span>Sexe: {item.input_data.sexe}</span>
                        <span>Intensité: {item.input_data.intensite}/10</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-all flex-shrink-0"
                      title="Supprimer ce dossier"
                    >
                      <Trash2 className="h-4 w-4 cursor-pointer" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
        NOUVEL ONGLET 3 : INTERFACE DE MODIFICATION DU PROFIL
        ========================================================================= */}
        {activeTab === 'profil' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-xl mx-auto animate-fadeIn">
            <div className="flex items-center space-x-2.5 mb-6 pb-4 border-b border-slate-100">
              <UserCog className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Paramètres du profil</h3>
                <p className="text-[11px] text-slate-400 font-medium">Mettez à jour vos informations publiques personnelles.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              
              {/* Changement de la photo d'avatar */}
              <div className="flex flex-col items-center space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center relative shadow-inner">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Avatar actuel" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <label className="cursor-pointer bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700 font-semibold shadow-sm transition-all select-none cursor-pointer flex items-center space-x-1.5">
                  <Upload className="h-3.5 w-3.5 text-slate-500 cursor-pointer" />
                  <span>Remplacer l'image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarChange} />
                </label>
                <p className="text-[10px] text-slate-400 font-medium">Format JPEG/PNG. Max 2 Mo.</p>
              </div>

              {/* Champ d'édition du Nom */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nom Complet ou Titre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text" required minLength={2}
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                    placeholder="Ex: Dr. Jean Rabe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Adresse Email (Désactivée car liée à l'ID d'authentification unique) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Adresse Email</span>
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded flex items-center"><Lock className="h-2.5 w-2.5 mr-1" /> Non modifiable</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  <input
                    type="email" disabled
                    value={profileForm.email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-400 cursor-not-allowed select-none focus:outline-none"
                  />
                </div>
              </div>

              {/* Bouton de sauvegarde */}
              <button
                type="submit" disabled={profileLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-blue-500/10 mt-4"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enregistrement des modifications...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Sauvegarder mon profil
                  </>
                )}
              </button>

            </form>
          </div>
        )}

      </main>

      {/* WIDGET FLOTTANT : MADABOT CHATBOT ASSISTANT */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        
        {isChatOpen && (
          <div className="w-[340px] sm:w-[380px] h-[480px] bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col mb-4 animate-scaleUp">
            
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 bg-white/10 rounded-xl flex items-center justify-center">
                  <Bot className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h4 className="text-xs font-bold">Conseiller Virtuel MadaBot</h4>
                  <p className="text-[10px] text-emerald-100 font-medium">Optimisé par Gemini 2.5 Flash</p>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-white/70 hover:text-white cursor-pointer transition-colors">
                <X className="h-5 w-5 cursor-pointer" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm font-medium ${
                    msg.sender === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-3 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2 text-slate-400 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span>MadaBot réfléchit...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChatMessage} className="p-2.5 bg-white border-t border-slate-100 flex items-center space-x-2">
              <input
                type="text" required
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Posez votre question de santé ici..."
                className="flex-1 bg-slate-100 border border-transparent rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:border-emerald-500 transition-all"
              />
              <button
                type="submit" disabled={!chatInput.trim() || chatLoading}
                className="h-8 w-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="h-4 w-4 cursor-pointer" />
              </button>
            </form>

          </div>
        )}

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="h-14 w-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:shadow-xl transform active:scale-95 transition-all duration-150 group relative cursor-pointer"
          title="Contacter l'assistant de santé"
        >
          {isChatOpen ? (
            <X className="h-6 w-6 cursor-pointer" />
          ) : (
            <>
              <MessageSquare className="h-6 w-6 group-hover:rotate-6 transition-transform cursor-pointer" />
              <span className="absolute -top-1 -right-1 h-4.5 w-4.5 bg-red-500 text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center text-white animate-bounce">
                1
              </span>
            </>
          )}
        </button>
      </div>

      {/* Pied de page */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p>© 2026 MadaDoc AI. Tous droits réservés.</p>
          <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
            Avertissement : Cette application fournit des évaluations algorithmiques assistées par IA à titre informatif. Elle ne remplace en aucun cas un avis, un diagnostic ou un traitement médical physique dispensé par un professionnel de santé.
          </p>
        </div>
      </footer>

    </div>
  );
}