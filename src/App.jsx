import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile 
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Camera, Send, Loader2, MapPin, Menu, Bell, User, 
  MessageSquare, Mail, Bot, X, LogOut, History, Home, 
  CheckCircle, Image as ImageIcon, Eye, EyeOff, ChevronDown, ChevronUp,
  Briefcase, Hammer, Search, Navigation, 
  Smartphone, Power, Zap, Phone, HelpCircle, Users, CheckSquare, 
  ArrowLeft, MoreVertical, Trash2, Pin, Star, ToggleLeft, ToggleRight, Award, AlertCircle, RotateCcw, Activity, AlertTriangle,
  Eye as EyeIcon, Map as MapIcon
} from 'lucide-react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// --- 1. CONFIGURACIÓN E IMÁGENES ---
const IMG_STATUS_DONE = "https://cdn-icons-png.flaticon.com/512/190/190411.png"; 
const IMG_STATUS_CANCEL = "https://cdn-icons-png.flaticon.com/512/190/190406.png"; 

// --- FIX LEAFLET (EVITA PANTALLA BLANCA POR MAPAS) ---
try {
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
  }
} catch (e) { console.warn("Leaflet fix skipped", e); }

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: "infrasalud-v2.firebaseapp.com",
  projectId: "infrasalud-v2",
  storageBucket: "infrasalud-v2.firebasestorage.app", 
  messagingSenderId: "961700690762",
  appId: "1:961700690762:web:339d81776dea1aa3041fb3",
  measurementId: "G-RP8TZDSY00"
};

let app, auth, db, storage;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) { console.error("Firebase Init Error:", e); }

const HOSPITAL_SPECIALTIES = ["Electricidad Clínica", "Gasfitería", "Climatización", "Equipamiento Médico", "Redes", "Infraestructura", "Limpieza", "Otro"];

const MOCK_WORKERS = [
  { id: 'w1', firstName: 'Juan', lastName: 'Pérez', specialty: 'Electricidad Clínica', fullPhone: '+56 9 1111 2222', showPhone: true, dist: 2.5, isOnline: true, location: { coords: { lat: -33.45, lng: -70.66 } } },
  { id: 'w2', firstName: 'Mario', lastName: 'Gómez', specialty: 'Gasfitería', fullPhone: '+56 9 3333 4444', showPhone: false, dist: 5.1, isOnline: false, location: { coords: { lat: -33.46, lng: -70.65 } } },
  { id: 'w3', firstName: 'Ana', lastName: 'López', specialty: 'Climatización', fullPhone: '+56 9 5555 6666', showPhone: true, dist: 1.2, isOnline: true, location: { coords: { lat: -33.44, lng: -70.67 } } },
];
const CANCEL_REASONS = ["No acuerdo de precio", "Sin respuesta", "Otra solución", "Demora", "Actitud", "Otro"];

// --- 2. UTILIDADES ---
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
  var R = 6371; 
  var dLat = (lat2-lat1) * (Math.PI/180);  
  var dLon = (lon2-lon1) * (Math.PI/180);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

const safeDate = (timestamp) => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

const formatTimeAgo = (timestamp) => {
  try {
    const now = new Date();
    const date = safeDate(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return 'Ahora';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours} h`;
    return `${days} d`;
  } catch (e) { return ''; }
};

const formatShortDate = (timestamp) => {
  try { return safeDate(timestamp).toLocaleDateString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'}); } catch (e) { return ''; }
}

const simulateAdvancedAI = (text) => {
  const lower = (text || '').toLowerCase();
  let urgency = "Media"; let category = "Mantenimiento General";
  if (["fuego", "incendio", "gas", "chispa", "corazón", "uci"].some(k => lower.includes(k))) { urgency = "Alta"; category = "Emergencia Crítica"; }
  else if (["agua", "luz", "enchufe", "aire", "clima"].some(k => lower.includes(k))) { urgency = "Media"; category = "Reparación"; }
  else if (["pintura", "limpieza", "jardín"].some(k => lower.includes(k))) { urgency = "Baja"; category = "Mantenimiento"; }
  return { urgency, category, risk_analysis: `IA: Detectado ${category} prioridad ${urgency}` };
};

// --- 3. COMPONENTES UI GLOBALES ---
const CustomAlertModal = ({ isOpen, title, message, onClose, type = 'info' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {type === 'error' ? <AlertCircle size={32}/> : <CheckCircle size={32}/>}
          </div>
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
          <button onClick={onClose} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-transform active:scale-95">Entendido</button>
        </div>
      </div>
    </div>
  );
};

const CustomConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center"><AlertTriangle size={32}/></div>
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel} className="flex-1 py-3 border-2 border-slate-100 rounded-xl font-bold text-slate-600">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-black">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 4. COMPONENTE AVATAR ---
const Avatar = ({ userData, size = "w-10 h-10", onClick, className = "" }) => {
  const [error, setError] = useState(false);
  const imageUrl = userData?.profileImageURL;
  const name = userData?.firstName || userData?.name || userData?.displayName || "?";
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  
  if (imageUrl && !error) {
    return <img src={imageUrl} alt="profile" className={`${size} rounded-full object-cover shadow-sm border-2 border-white bg-white ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick} onError={() => setError(true)} />;
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-bold text-white shadow-sm border-2 border-white ${onClick ? 'cursor-pointer' : ''} ${className}`} style={{ backgroundColor: userData?.role === 'worker' ? '#f97316' : '#2563eb' }} onClick={onClick}>
      {initial}
    </div>
  );
};

// --- 5. MODAL DE UBICACIÓN (MAPA DE PERFIL) ---
const UserLocationModal = ({ targetUser, onClose }) => {
  const hasLocation = targetUser?.location?.coords;
  const position = hasLocation ? [targetUser.location.coords.lat, targetUser.location.coords.lng] : [-33.4489, -70.6693]; 

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-[400] bg-white text-slate-800 p-2 rounded-full shadow-lg hover:bg-slate-100"><X size={20}/></button>
        
        <div className="h-64 w-full bg-slate-100 relative z-0">
           {hasLocation ? (
             <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={position}>
                  <Popup>{targetUser.firstName} está aquí.</Popup>
                </Marker>
             </MapContainer>
           ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
               <MapPin size={48} className="mb-2 opacity-50"/>
               <p className="text-sm font-bold">Ubicación no disponible</p>
             </div>
           )}
        </div>
        
        <div className="p-6 bg-white relative z-10 -mt-6 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
           <div className="flex flex-col items-center">
              <div className="relative -mt-16 mb-3">
                 <Avatar userData={targetUser} size="w-24 h-24" className="border-4 border-white shadow-xl"/>
              </div>
              <h2 className="text-2xl font-black text-slate-800">{targetUser?.firstName || 'Usuario'} {targetUser?.lastName || ''}</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase mt-1">
                {targetUser?.role === 'worker' ? targetUser.specialty : 'Cliente'}
              </span>
              <div className="w-full mt-6 space-y-3">
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm"><Phone size={18}/></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Contacto</p>
                        <p className="text-sm font-bold text-slate-700">{targetUser?.fullPhone || 'No compartido'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm"><MapPin size={18}/></div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Dirección</p>
                        <p className="text-sm font-bold text-slate-700 truncate w-48">{targetUser?.location?.address || 'Sin dirección'}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- 6. SIDEBAR ---
const Sidebar = ({ isOpen, onClose, user, userData, logout, onNavigate }) => {
  const handleNav = (tab) => { onNavigate(tab); onClose(); };
  return (
    <>
      <div className={`fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />
      <div className={`fixed top-0 left-0 bottom-0 w-72 bg-white shadow-2xl transform transition-transform z-[160] flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-56 bg-slate-900 flex flex-col items-center justify-center text-white relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
          <div className="relative mb-3 cursor-pointer" onClick={() => handleNav('profile')}>
             <Avatar userData={userData} size="w-24 h-24" className="shadow-xl relative z-10"/>
          </div>
          <p className="font-bold text-lg relative z-10">{userData?.firstName || user.displayName}</p>
          <p className="text-xs opacity-70 relative z-10">{user.email}</p>
        </div>
        <div className="flex-1 p-6 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Mi Cuenta</p>
          <button onClick={() => handleNav('profile')} className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition text-slate-700 font-medium"><User size={20} className="text-blue-500" /> Perfil</button>
          <button onClick={() => handleNav('help')} className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition text-slate-700 font-medium"><HelpCircle size={20} className="text-blue-500" /> Ayuda</button>
        </div>
        <div className="p-6 border-t border-slate-100"><button onClick={logout} className="w-full p-4 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm"><LogOut size={20}/> Cerrar Sesión</button></div>
      </div>
    </>
  );
};

// --- 7. LOGIN SCREEN ---
const LoginScreen = () => {
  const [view, setView] = useState('login'); 
  const [role, setRole] = useState('user');
  const [name, setName] = useState(''); const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(''); const [countryCode, setCountryCode] = useState('+56');
  const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [confirmPass, setConfirmPass] = useState('');
  const [specialty, setSpecialty] = useState(HOSPITAL_SPECIALTIES[0]);
  const [showPass, setShowPass] = useState(false);
  const [passStrength, setPassStrength] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({text: '', type: ''});
  const countries = [{ code: '+56', flag: '🇨🇱' }, { code: '+54', flag: '🇦🇷' }, { code: '+51', flag: '🇵🇪' }, { code: '+57', flag: '🇨🇴' }, { code: '+52', flag: '🇲🇽' }];
  
  useEffect(() => { let score = 0; if (pass.length >= 6) score++; if (pass.length >= 8) score++; if (/[A-Z]/.test(pass)) score++; if (/[0-9]/.test(pass)) score++; setPassStrength(score); }, [pass]);
  
  const handleAuth = async (e) => {
    e.preventDefault(); setLoading(true); setMsg({text: '', type: ''});
    try {
      if (view === 'register') {
        if (!name || !lastName || !phone) throw new Error("Faltan datos.");
        if (pass !== confirmPass) throw new Error("Contraseñas no coinciden.");
        if (passStrength < 2) throw new Error("Contraseña débil.");
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(userCred.user, { displayName: `${name} ${lastName}` });
        await setDoc(doc(db, "users", userCred.user.uid), {
          firstName: name, lastName: lastName, fullPhone: `${countryCode} ${phone}`,
          email: email, role: role, specialty: role === 'worker' ? specialty : null,
          location: null, createdAt: serverTimestamp(), isOnline: true, profileImageURL: null, showPhone: true
        });
      } else { await signInWithEmailAndPassword(auth, email, pass); }
    } catch (err) { setMsg({text: err.message.replace('Firebase:', ''), type: 'error'}); }
    setLoading(false);
  };

  const handleRecover = async (method) => {
    setLoading(true); setMsg({text: '', type: ''});
    try {
      if (method === 'email') { if (!email) throw new Error("Ingresa correo."); await sendPasswordResetEmail(auth, email); setMsg({text: "✅ Enlace enviado.", type: 'success'}); } 
      else { if (!phone) throw new Error("Ingresa número."); setTimeout(() => { setMsg({text: `📩 SMS enviado`, type: 'success'}); setLoading(false); }, 1500); return; }
    } catch (err) { setMsg({text: err.message, type: 'error'}); }
    setLoading(false);
  };

  if (view === 'login') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl">
            <div className="flex flex-col items-center mb-8">
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Infra<span className="text-blue-600">Salud</span></h1>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestión de Mantenimiento</p>
            </div>
            <h2 className="text-xl font-bold text-center text-slate-800 mb-6">Iniciar Sesión</h2>
            <form onSubmit={handleAuth} className="space-y-4"><input required type="email" placeholder="Correo" className="w-full p-3 bg-slate-50 border rounded-xl" onChange={e => setEmail(e.target.value)} /><div className="relative"><input required type={showPass ? "text" : "password"} placeholder="Contraseña" className="w-full p-3 bg-slate-50 border rounded-xl pr-10" onChange={e => setPass(e.target.value)} /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400"><Eye size={18}/></button></div><button disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Entrar"}</button></form>{msg.text && <p className={`text-center text-xs mt-4 font-bold ${msg.type==='error'?'text-red-500':'text-green-600'}`}>{msg.text}</p>}<div className="mt-6 text-center space-y-3"><p onClick={() => setView('forgot-select')} className="text-slate-500 text-sm cursor-pointer hover:text-blue-600">¿Olvidaste tu contraseña?</p><div className="h-px bg-slate-200 w-full"></div><p onClick={() => setView('role-select')} className="text-blue-600 font-bold text-sm cursor-pointer hover:underline">¿No tienes cuenta? Regístrate</p></div>
        </div>
    </div>
  );

  if (view === 'forgot-select' || view === 'forgot-email' || view === 'forgot-sms') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans"><div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl animate-in slide-in-from-right"><h2 className="text-xl font-black text-center text-slate-800 mb-6">{view === 'forgot-select' ? "Recuperar Acceso" : "Datos de contacto"}</h2>{view === 'forgot-select' ? (<div className="space-y-3"><button onClick={() => setView('forgot-email')} className="w-full p-4 border-2 border-slate-100 rounded-2xl flex items-center gap-3 hover:border-blue-500"><Mail className="text-blue-600"/><span className="font-bold text-slate-700">Por Gmail</span></button><button onClick={() => setView('forgot-sms')} className="w-full p-4 border-2 border-slate-100 rounded-2xl flex items-center gap-3 hover:border-green-500"><Smartphone className="text-green-600"/><span className="font-bold text-slate-700">Por SMS</span></button></div>) : (<>{view === 'forgot-email' ? <input type="email" placeholder="Correo" className="w-full p-3 bg-slate-50 border rounded-xl mb-4" onChange={e => setEmail(e.target.value)} /> : <div className="flex gap-2 mb-4"><select className="w-[35%] bg-slate-50 border rounded-xl px-2 text-sm" onChange={e => setCountryCode(e.target.value)}>{countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}</select><input type="tel" placeholder="Número" className="flex-1 p-3 bg-slate-50 border rounded-xl" onChange={e => setPhone(e.target.value)} /></div>}<button onClick={() => handleRecover(view === 'forgot-email' ? 'email' : 'sms')} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Enviar Código"}</button>{msg.text && <p className={`text-center text-xs mt-4 p-2 rounded ${msg.type==='error'?'text-red-500 bg-red-50':'text-green-600 bg-green-50'}`}>{msg.text}</p>}</>)}<p onClick={() => setView(view === 'forgot-select' ? 'login' : 'forgot-select')} className="text-center text-slate-400 text-xs cursor-pointer mt-6">Volver</p></div></div>
  );
  if (view === 'role-select') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans"><div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl space-y-4 animate-in zoom-in-95"><h2 className="text-2xl font-black text-center text-slate-800">¿Quién eres?</h2><button onClick={() => { setRole('user'); setView('register'); }} className="w-full p-6 border-2 border-blue-100 bg-blue-50 rounded-2xl flex items-center gap-4 hover:border-blue-500 transition-all group"><div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110"><User size={28}/></div><div className="text-left"><h3 className="font-bold text-blue-900 text-lg">USUARIO</h3><p className="text-xs text-blue-600 font-medium">Busco soluciones</p></div></button><button onClick={() => { setRole('worker'); setView('register'); }} className="w-full p-6 border-2 border-orange-100 bg-orange-50 rounded-2xl flex items-center gap-4 hover:border-orange-500 transition-all group"><div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110"><Hammer size={28}/></div><div className="text-left"><h3 className="font-bold text-orange-900 text-lg">TRABAJADOR</h3><p className="text-xs text-orange-600 font-medium">Ofrezco servicios</p></div></button><p onClick={() => setView('login')} className="text-center text-slate-400 text-xs cursor-pointer mt-6">Volver al Login</p></div></div>
  );
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans"><div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl animate-in slide-in-from-right"><div className={`text-center p-4 rounded-2xl mb-6 ${role === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}><p className="text-xs font-bold uppercase opacity-70">Registrando como</p><h2 className="text-2xl font-black">{role === 'user' ? 'USUARIO' : 'TRABAJADOR'}</h2></div><form onSubmit={handleAuth} className="space-y-4"><div className="flex gap-2"><input required type="text" placeholder="Nombre" className="w-1/2 p-3 bg-slate-50 border rounded-xl text-sm" onChange={e => setName(e.target.value)} /><input required type="text" placeholder="Apellido" className="w-1/2 p-3 bg-slate-50 border rounded-xl text-sm" onChange={e => setLastName(e.target.value)} /></div><div className="flex gap-2"><select className="w-[40%] bg-slate-50 border rounded-xl px-2 text-sm font-bold" onChange={e => setCountryCode(e.target.value)}>{countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}</select><input required type="tel" placeholder="Teléfono" className="flex-1 p-3 bg-slate-50 
border rounded-xl text-sm" onChange={e => setPhone(e.target.value)} /></div>{role === 'worker' && <div className="bg-orange-50 p-3 rounded-xl border border-orange-200"><label className="text-xs font-bold text-orange-700 uppercase block mb-1">Especialidad</label><select className="w-full bg-white p-2 rounded-lg text-sm" onChange={e => setSpecialty(e.target.value)}>{HOSPITAL_SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>}<input required type="email" placeholder="Correo Gmail" className="w-full p-3 bg-slate-50 border rounded-xl text-sm" onChange={e => setEmail(e.target.value)} /><div className="relative"><input required type={showPass ? "text" : "password"} placeholder="Contraseña" className="w-full p-3 bg-slate-50 border rounded-xl text-sm pr-10" onChange={e => setPass(e.target.value)} /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400"><Eye size={18}/></button></div><div className="flex gap-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className={`h-full flex-1 ${passStrength > 0 ? (passStrength===1?'bg-red-500':passStrength===2?'bg-yellow-500':'bg-green-500') : ''}`}></div><div className={`h-full flex-1 ${passStrength > 1 ? (passStrength===2?'bg-yellow-500':'bg-green-500') : ''}`}></div><div className={`h-full flex-1 ${passStrength > 2 ? 'bg-green-500' : ''}`}></div><div className={`h-full flex-1 ${passStrength > 3 ? 'bg-green-600' : ''}`}></div></div><input required type="password" placeholder="Confirmar Contraseña" className="w-full p-3 bg-slate-50 border rounded-xl text-sm" onChange={e => setConfirmPass(e.target.value)} /><button disabled={loading} className={`w-full text-white py-4 rounded-xl font-bold shadow-lg ${role === 'user' ? 'bg-blue-600' : 'bg-orange-500'}`}>{loading ? <Loader2 className="animate-spin mx-auto"/> : "Finalizar Registro"}</button></form>{msg.text && <p className="text-red-500 text-center text-xs mt-4">{msg.text}</p>}<button onClick={() => setView('role-select')} className="block w-full text-center mt-6 text-slate-400 font-bold text-xs">Cambiar Rol</button></div></div>
  );
};

// --- 8. PERFIL (PANTALLA) ---
const MyProfileScreen = ({ user, userData, onBack }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(userData?.firstName || '');
  const [newLastName, setNewLastName] = useState(userData?.lastName || '');
  const [newPhone, setNewPhone] = useState(userData?.fullPhone || '');
  const [showPhone, setShowPhone] = useState(userData?.showPhone || false);
  const [stats, setStats] = useState({ rating: 0, jobs: 0 });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const isWorker = userData.role === 'worker';
    const q = query(collection(db, 'reports'), where(isWorker ? "workerId" : "uid", "==", user.uid), where("status", "==", "completed"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => d.data());
      const totalJobs = docs.length;
      if (totalJobs > 0) {
        const totalRating = docs.reduce((acc, curr) => acc + (isWorker ? (curr.workerRating || 0) : (curr.userRating || 0)), 0);
        setStats({ rating: (totalRating / totalJobs).toFixed(1), jobs: totalJobs });
      } else { setStats({ rating: "N/A", jobs: 0 }); }
    });
    return () => unsub();
  }, [user, userData]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { firstName: newName, lastName: newLastName, fullPhone: newPhone, showPhone: showPhone });
      await updateProfile(user, { displayName: `${newName} ${newLastName}` });
      setIsEditing(false); alert("Perfil actualizado");
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `profile_images/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", user.uid), { profileImageURL: url });
    } catch(e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col animate-in fade-in z-[300] overflow-y-auto">
      <div className="h-16 bg-white flex items-center px-4 justify-between shadow-sm sticky top-0 z-20">
        <button onClick={onBack}><ArrowLeft size={24} className="text-slate-700"/></button>
        <h2 className="font-bold text-lg text-slate-800">Mi Perfil</h2>
        <button onClick={() => setIsEditing(!isEditing)} className="text-blue-600 font-bold text-sm">{isEditing ? 'Cancelar' : 'Editar'}</button>
      </div>
      <div className="flex-1 p-6 space-y-6 pb-24">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => isEditing && fileInputRef.current.click()}>
            <Avatar userData={userData} size="w-28 h-28" className="shadow-2xl"/>
            {isEditing && <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center"><Camera className="text-white"/></div>}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} accept="image/*" disabled={!isEditing}/>
          </div>
          <h1 className="text-xl font-black text-slate-800 mt-3">{userData.firstName} {userData.lastName}</h1>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase mt-1">{userData?.role === 'worker' ? userData.specialty : 'Cliente'}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center"><Star className="text-yellow-400 fill-yellow-400 mb-1" size={24}/><span className="text-2xl font-black text-slate-800">{stats.rating}</span><span className="text-[10px] text-slate-400 uppercase font-bold">Nota</span></div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center"><Award className="text-blue-500 mb-1" size={24}/><span className="text-2xl font-black text-slate-800">{stats.jobs}</span><span className="text-[10px] text-slate-400 uppercase font-bold">{userData.role === 'worker' ? 'Trabajos' : 'Pedidos'}</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Datos Personales</h3>
          <div className="space-y-3">
             <div><label className="text-[10px] font-bold text-slate-400 uppercase">Nombre</label><input disabled={!isEditing} value={newName} onChange={e=>setNewName(e.target.value)} className="w-full border-b py-1 text-sm bg-transparent font-medium"/></div>
             <div><label className="text-[10px] font-bold text-slate-400 uppercase">Apellido</label><input disabled={!isEditing} value={newLastName} onChange={e=>setNewLastName(e.target.value)} className="w-full border-b py-1 text-sm bg-transparent font-medium"/></div>
             <div><label className="text-[10px] font-bold text-slate-400 uppercase">Correo</label><input disabled value={userData.email} className="w-full border-b py-1 text-sm text-slate-500 bg-transparent"/></div>
             <div><label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label><input disabled={!isEditing} value={newPhone} onChange={e=>setNewPhone(e.target.value)} className="w-full border-b py-1 text-sm bg-transparent font-medium"/></div>
             <div className="flex items-center justify-between pt-2"><div><p className="text-sm font-bold text-slate-700">Mostrar Teléfono</p><p className="text-[10px] text-slate-400">Visible en el chat</p></div><button disabled={!isEditing} onClick={() => setShowPhone(!showPhone)} className={`transition-colors ${showPhone ? 'text-green-500' : 'text-slate-300'}`}>{showPhone ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}</button></div>
          </div>
        </div>
        {isEditing && <button onClick={handleSave} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg">{loading ? <Loader2 className="animate-spin mx-auto"/> : "Guardar Cambios"}</button>}
      </div>
    </div>
  );
};

// --- 9. COMPONENTE NOTIFICACIONES ---
const NotificationPanel = ({ notifications, setNotifications, isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  const removeNotification = (index) => { const updated = [...notifications]; updated.splice(index, 1); setNotifications(updated); };
  return (
    <>
      <div className="fixed inset-0 z-[80]" onClick={onClose}></div>
      <div className="absolute top-16 right-4 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-[90] animate-in zoom-in-95 origin-top-right overflow-hidden">
        <div className="p-3 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-sm text-slate-700">Notificaciones</h3><span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{notifications.length}</span></div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? <div className="p-4 text-center text-slate-400 text-xs">Sin notificaciones nuevas</div> : notifications.map((n, i) => (
             <div key={i} className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex flex-col gap-2">
               <div className="flex justify-between items-start">
                   <div><p className="text-xs font-bold text-slate-800">{n.title}</p><p className="text-[10px] text-slate-500 mt-1">{n.body}</p></div>
                   <button onClick={(e) => { e.stopPropagation(); removeNotification(i); }} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-slate-200"><X size={14} /></button>
               </div>
               {/* BOTÓN "VER" AÑADIDO */}
               <button onClick={(e) => { e.stopPropagation(); onSelect(n.report); onClose(); removeNotification(i); }} className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors"><EyeIcon size={12}/> Ver Solicitud</button>
             </div>
            ))}
        </div>
      </div>
    </>
  );
};

// --- 10. MAPA ---
const LocationPickerAdvanced = ({ onConfirm, initialAddress, onClose }) => {
  const [query, setQuery] = useState(initialAddress || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [center, setCenter] = useState({ lat: -33.4489, lng: -70.6693 });
  const [position, setPosition] = useState({ lat: -33.4489, lng: -70.6693 });
  const mapRef = useRef(null);
  const isTypingRef = useRef(false);
  const MapEvents = () => {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
      const onMoveEnd = async () => { if (isTypingRef.current) return; const { lat, lng } = map.getCenter(); setPosition({ lat, lng }); try { const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`); const data = await res.json(); if (data?.display_name) setQuery(data.display_name.split(',')[0]); } catch (e) {} };
      map.on('moveend', onMoveEnd); return () => map.off('moveend', onMoveEnd);
    }, [map]);
    return null;
  };

  useEffect(() => { const timer = setTimeout(async () => { if (query.length > 3 && isTypingRef.current) { try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=cl&limit=5`); const data = await res.json(); setSuggestions(data); } catch (e) {} } else { setSuggestions([]); } }, 500); return () => clearTimeout(timer); }, [query]);
  const handleSelect = (place) => { const lat = parseFloat(place.lat); const lon = parseFloat(place.lon); setCenter({ lat, lng: lon });
  setPosition({ lat, lng: lon }); setQuery(place.display_name.split(',')[0]); setSuggestions([]); isTypingRef.current = false; if(mapRef.current) mapRef.current.setView([lat, lon], 16); };
  const handleGPS = () => { setLoadingLoc(true); navigator.geolocation.getCurrentPosition((pos) => { const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setCenter(newPos); setPosition(newPos); setQuery("Ubicación GPS"); setLoadingLoc(false); isTypingRef.current = false; if(mapRef.current) mapRef.current.setView(newPos, 16); }, () => { alert("Activa el GPS."); setLoadingLoc(false); }, { enableHighAccuracy: true });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] relative">
        {onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 z-[1000] bg-red-500 text-white p-2 rounded-full shadow-xl hover:bg-red-600 transition-colors"><X size={24}/></button>
        )}
        <div className="p-4 bg-white border-b z-20 space-y-3"><h2 className="text-lg font-black text-slate-800 text-center">Ubicación</h2><div className="relative"><Search className="absolute left-3 top-3.5 text-slate-400" size={20}/><input value={query} onFocus={() => { isTypingRef.current = true; }} onBlur={() => setTimeout(() => { isTypingRef.current = false; }, 200)} onChange={e => setQuery(e.target.value)} placeholder="Buscar calle..." className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"/>{suggestions.length > 0 && (<ul className="absolute top-full left-0 right-0 bg-white 
border border-slate-200 rounded-xl mt-1 shadow-xl max-h-48 overflow-y-auto z-50">{suggestions.map((s, i) => (<li key={i} onClick={() => handleSelect(s)} className="p-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer text-xs text-slate-700 flex items-center gap-2"><MapPin size={12}/> <span className="truncate">{s.display_name}</span></li>))}</ul>)}</div><button onClick={handleGPS} disabled={loadingLoc} className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2">{loadingLoc ?
<Loader2 className="animate-spin" size={14}/> : <Navigation size={14}/>} GPS Actual</button></div>
        <div className="flex-1 relative w-full h-full bg-slate-100"><MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }} zoomControl={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapEvents /></MapContainer><div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[500] pointer-events-none"><img src="https://cdn-icons-png.flaticon.com/512/447/447031.png" className="w-10 h-10 drop-shadow-xl mb-1"/></div></div>
        <div className="p-4 bg-white border-t z-20"><button onClick={() => onConfirm(query || "Ubicación Mapa", position)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black">Confirmar</button></div>
      </div>
    </div>
  );
};

// --- 11. MODAL DETALLE DE TRABAJO ---
const JobDetailModal = ({ job, onClose, onDiscard, onDelete, onAccept }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/50 animate-in fade-in">
    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
      <div className="relative h-48 bg-slate-100 shrink-0">
        <img src={job.thumbnail} className="w-full h-full object-cover" />
        <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"><X size={20}/></button>
      </div>
      <div className="p-5 flex-1 overflow-y-auto space-y-5">
        <div className="flex justify-between items-start"><div><span className={`text-xs font-bold px-2 py-1 rounded uppercase ${job.status === 'completed' ? 'bg-green-100 text-green-600' : job.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{job.status === 'completed' ?
'Completado' : job.status === 'cancelled' ? 'Cancelado' : job.ai?.urgency}</span><h2 className="text-xl font-black text-slate-800 mt-2">{job.ai?.category ||
'Trabajo'}</h2><p className="text-sm text-slate-500">{job.locationString}</p></div></div>
        
        {/* DESCRIPCIÓN IA */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
            <h3 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1"><Bot size={14}/> Diagnóstico IA</h3>
            <p className="text-sm font-medium text-slate-800">{job.ai?.risk_analysis || "Sin análisis disponible."}</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2"><h3 className="text-xs font-bold text-slate-700 uppercase">Detalle</h3><p className="text-sm text-slate-600">"{job.description}"</p></div>
        {job.status === 'completed' && (<div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100"><h3 className="text-xs font-bold text-yellow-700 uppercase mb-2">Reseñas</h3>{job.userReview && <div className="mb-2"><p className="text-xs font-bold text-slate-700">Cliente:</p><p className="text-sm italic text-slate-600">"{job.userReview}" ({job.userRating}★)</p></div>}{job.workerReview && <div><p className="text-xs font-bold text-slate-700">Trabajador:</p><p className="text-sm italic text-slate-600">"{job.workerReview}" ({job.workerRating}★)</p></div>}</div>)}
      </div>
      
      {/* BOTONES DE ACCIÓN */}
      <div className="p-4 border-t bg-slate-50 flex gap-2">
          {onDiscard && (
              <button onClick={() => { onDiscard(job.id); onClose(); }} className="flex-1 border-2 border-slate-200 text-slate-500 py-3 rounded-xl font-bold hover:bg-slate-100">Descartar</button>
          )}
          {onDelete && job.status === 'open' && (
              <button onClick={() => { onDelete(job.id); onClose(); }} className="flex-1 border-2 border-red-100 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 flex justify-center items-center gap-2"><Trash2 size={16}/> Eliminar</button>
          )}
          {onAccept && (job.status === 'open' || job.status === 'pending_approval') ? (
              <button onClick={() => { onAccept(job); }} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black">Aceptar Trabajo</button>
          ) : (
              <button onClick={onClose} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg">Cerrar</button>
          )}
      </div>
    </div>
  </div>
);

// --- 12. INBOX SCREEN ---
const InboxScreen = ({ user, userData, onShowConfirm, onShowAlert }) => {
  const [activeTab, setActiveTab] = useState('primary');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [deletedChats, setDeletedChats] = useState([]);
  const [usersDataCache, setUsersDataCache] = useState({});
  const [activeMenu, setActiveMenu] = useState(null); 
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const allReports = snap.docs.map(d => ({id: d.id, ...d.data()}));
      const myChats = allReports.filter(r => (r.uid === user.uid || r.workerId === user.uid) && r.status !== 'open');
      setChats(myChats);
      
      const userIdsToFetch = new Set();
      myChats.forEach(c => { 
        if(c.uid && c.uid !== user.uid) userIdsToFetch.add(c.uid); 
        if(c.workerId && c.workerId !== user.uid) userIdsToFetch.add(c.workerId); 
      });

      const newCache = {...usersDataCache};
      for (const id of userIdsToFetch) { 
        if(!newCache[id] && id) {
          try {
             const docRef = doc(db, "users", id);
             const docSnap = await getDoc(docRef); 
             if(docSnap.exists()) newCache[id] = docSnap.data(); 
          } catch (error) {
             console.error("Error fetching user for cache:", id, error);
          }
        } 
      }
      setUsersDataCache(newCache);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const isWorker = userData.role === 'worker';
  const visibleChats = chats.filter(c => !deletedChats.includes(c.id));
  
  const filteredChats = visibleChats.filter(chat => { 
      const otherId = isWorker ? chat.uid : chat.workerId;
      const cachedUser = usersDataCache[otherId];
      const name = (isWorker ? chat.userName : chat.workerName) || (cachedUser ? (cachedUser.firstName + ' ' + cachedUser.lastName) : 'Usuario');
      return (name || '').toLowerCase().includes(searchTerm.toLowerCase()); 
  });

  const pendingChats = filteredChats.filter(c => c.status === 'pending_approval');
  const finishedChats = filteredChats.filter(c => c.status === 'completed' || c.status === 'cancelled');
  const activeChats = filteredChats.filter(c => c.status === 'accepted' || c.status === 'finish_requested');

  const handleDeleteAll = () => {
      setShowHeaderMenu(false);
      onShowConfirm({
          title: "Eliminar Chats",
          message: "¿Estás seguro de que quieres vaciar tu bandeja de entrada?",
          onConfirm: () => {
              setDeletedChats(chats.map(c => c.id));
              onShowAlert("Bandeja vaciada", "Todos los chats han sido ocultados.");
          }
      });
  };
  
  const handleDeleteOne = (id) => {
      setActiveMenu(null);
      onShowConfirm({
          title: "Ocultar Chat",
          message: "¿Deseas ocultar este chat?",
          onConfirm: () => setDeletedChats(prev => [...prev, id])
      });
  };

  const renderChatRow = (chat, type) => {
      const otherId = isWorker ? chat.uid : chat.workerId;
      const cachedUser = usersDataCache[otherId];
      const displayName = (isWorker ? chat.userName : chat.workerName) || (cachedUser?.firstName ? `${cachedUser.firstName} ${cachedUser.lastName}` : "Usuario");
      const subRole = cachedUser?.role === 'worker' ? cachedUser.specialty : 'Cliente';
      const isUnread = chat.status === 'finish_requested' && chat.uid !== user.uid; 
      let icon = null;
      if (type === 'finished') icon = chat.status === 'completed' ? IMG_STATUS_DONE : IMG_STATUS_CANCEL;

      return (
        <div key={chat.id} className="relative mb-2">
            <div onClick={() => setSelectedChat(chat)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${type === 'pending' ? 'bg-orange-50 border-orange-100 hover:bg-orange-100' : type === 'finished' ? 'bg-slate-50 border-slate-100 opacity-80 hover:opacity-100' : 'bg-white border-slate-50 hover:bg-slate-50'}`}>
              <div className="relative">
                  {icon ? <img src={icon} className="w-12 h-12 object-contain" /> : <Avatar userData={cachedUser || {firstName: displayName}} size="w-12 h-12"/>}
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                      <div>
                          <h3 className={`font-bold truncate text-sm ${isUnread ? 'text-black' : 'text-slate-800'}`}>{displayName}</h3>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{subRole}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatTimeAgo(chat.timestamp)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <p className={`text-xs truncate ${type==='pending'?'font-bold text-orange-700': isUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {type === 'finished' ? (chat.status === 'completed' ? 'Trabajo Completado' : 'Trabajo Cancelado') : (chat.ai?.category || 'Mensaje nuevo')}
                      </p>
                      {isUnread && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full ml-2 shrink-0 shadow-sm animate-pulse"></div>}
                  </div>
              </div>
              {type !== 'finished' && <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === chat.id ? null : chat.id); }} className="p-2 hover:bg-black/5 rounded-full"><MoreVertical size={16} className="text-slate-400"/></button>}
            </div>
            {activeMenu === chat.id && (
                <div className="absolute right-4 top-10 bg-white shadow-xl border border-slate-100 rounded-lg z-20 w-32 overflow-hidden animate-in fade-in zoom-in-95">
                    <button className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Pin size={12}/> Destacar</button>
                    <button onClick={() => handleDeleteOne(chat.id)} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={12}/> Ocultar</button>
                </div>
            )}
        </div>
      );
  };

  if (selectedChat) return <ChatScreen user={user} report={selectedChat} onClose={() => setSelectedChat(null)} onShowAlert={onShowAlert} />;

  return (
    <div className="h-full bg-white flex flex-col font-sans" onClick={() => { setShowHeaderMenu(false); setActiveMenu(null); }}>
      <div className="px-4 py-3 border-b bg-white sticky top-0 z-10 space-y-2">
          <div className="flex justify-between items-center relative">
              <h1 className="text-xl font-bold text-slate-800">Chats</h1>
              <button onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }} className="p-2 hover:bg-slate-100 rounded-full"><MoreVertical size={20} className="text-slate-400"/></button>
              {showHeaderMenu && (
                  <div className="absolute right-0 top-10 bg-white shadow-xl border border-slate-100 rounded-lg z-50 w-40 overflow-hidden animate-in fade-in zoom-in-95">
                      <button onClick={handleDeleteAll} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14}/> Vaciar Bandeja</button>
                  </div>
              )}
          </div>
          <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input type="text" placeholder="Buscar..." className="w-full pl-9 p-2 bg-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
         {loading ? <Loader2 className="animate-spin mx-auto mt-10 text-slate-400"/> : (
             <>
                {pendingChats.length > 0 && <div className="animate-in slide-in-from-left"><h3 className="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-2"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div> Solicitudes Pendientes</h3>{pendingChats.map(c => renderChatRow(c, 'pending'))}</div>}
                {finishedChats.length > 0 && <div><div onClick={() => setShowHistory(!showHistory)} className="flex justify-between items-center cursor-pointer mb-2"><h3 className="text-xs font-bold text-slate-400 uppercase">Historial ({finishedChats.length})</h3>{showHistory ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}</div>{showHistory && <div className="animate-in fade-in space-y-2 pl-2 border-l-2 border-slate-100">{finishedChats.map(c => renderChatRow(c, 'finished'))}</div>}</div>}
                <div><h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Chats Activos</h3>{activeChats.length > 0 ? activeChats.map(c => renderChatRow(c, 'active')) : <p className="text-center text-xs text-slate-400 py-4 italic">No tienes chats activos.</p>}</div>
             </>
         )}
      </div>
    </div>
  );
};

// --- 13. CHAT SCREEN ---
const ChatScreen = ({ user, report, onClose, onShowAlert }) => {
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [status, setStatus] = useState(report?.status || 'open'); 
  const [showRateModal, setShowRateModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [otherUserData, setOtherUserData] = useState(null);
  const [loadingChat, setLoadingChat] = useState(true);
  
  // ESTADO CORREGIDO PARA EL MAPA
  const [showLocationModal, setShowLocationModal] = useState(false); 

  const chatId = report?.id; 
  if (!chatId || !user) return <div className="p-4 text-center">Error al cargar chat</div>;

  const isWorker = user.uid === report.workerId;
  const isPending = status === 'pending_approval';
  
  const otherId = isWorker ? report.uid : report.workerId; 
  const otherName = isWorker ? (report.userName || "Cliente") : (report.workerName || "Trabajador");

  // DEFINICIÓN SEGURA DE ESPECIALIDAD (PARA EVITAR CRASH)
  const otherSpecialty = otherUserData?.role === 'worker' ? otherUserData.specialty : (isWorker ? 'Cliente' : 'Trabajador');

  useEffect(() => {
    if (!otherId) { setLoadingChat(false); return; }
    
    const fetchOtherUser = async () => { 
        try {
            const docRef = doc(db, "users", otherId);
            const docSnap = await getDoc(docRef); 
            if(docSnap.exists()) setOtherUserData(docSnap.data()); 
        } catch (e) { console.error("Error fetching user in chat", e); }
    };
    fetchOtherUser();
    
    const qMsg = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp', 'asc'));
    const unsubMsg = onSnapshot(qMsg, (snap) => {
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingChat(false);
    });
    
    const unsubReport = onSnapshot(doc(db, "reports", chatId), (docSnap) => { 
        if(docSnap.exists()) { 
            const d = docSnap.data(); 
            setStatus(d.status); 
            if (d.status === 'completed') { 
                const hasRated = isWorker ? d.workerRating : d.userRating; 
                if (!hasRated) setShowRateModal(true); 
            } 
        } 
    });
    return () => { unsubMsg(); unsubReport(); }
  }, [chatId, isWorker, otherId]);

  const sendMessage = async () => { if (!msg.trim()) return;
  await addDoc(collection(db, `chats/${chatId}/messages`), { text: msg, uid: user.uid, userName: user.displayName, timestamp: serverTimestamp() }); setMsg(''); };
  
  const handleRequestFinish = async () => { await updateDoc(doc(db, 'reports', report.id), { status: 'finish_requested' });
  const roleText = isWorker ? "El trabajador" : "El usuario";
  await addDoc(collection(db, `chats/${chatId}/messages`), { text: `🛑 ${roleText} ha solicitado finalizar el trabajo. ¿Confirmas que está listo?`, type: 'finish_request', system: true, uid: user.uid, timestamp: serverTimestamp() }); };
  
  const handleConfirmFinish = async () => { await updateDoc(doc(db, 'reports', report.id), { status: 'completed', completedAt: serverTimestamp() });
  await addDoc(collection(db, `chats/${chatId}/messages`), { text: "🏁 Trabajo marcado como COMPLETADO.", system: true, timestamp: serverTimestamp() }); setShowRateModal(true); };
  
  const submitRating = async () => { const updateData = isWorker ?
  { workerRating: rating, workerReview: review } : { userRating: rating, userReview: review }; await updateDoc(doc(db, 'reports', report.id), updateData); setShowRateModal(false);
  onShowAlert("¡Gracias!", "Calificación enviada exitosamente."); onClose(); };
  
  const handleCancelJob = async () => { if(!cancelReason) return onShowAlert("Error", "Selecciona un motivo", 'error');
  await updateDoc(doc(db, 'reports', report.id), { status: 'cancelled', cancelReason, cancelledBy: user.uid });
  await addDoc(collection(db, `chats/${chatId}/messages`), { text: `⚠️ CANCELADO POR ${user.displayName}: ${cancelReason}`, system: true, timestamp: serverTimestamp() }); setShowCancel(false); onClose(); };
  
  const handleCall = () => { 
      if (otherUserData && otherUserData.showPhone === true && otherUserData.fullPhone) { 
          onShowAlert(`Contacto de ${otherName}`, `El número es: ${otherUserData.fullPhone}`);
      } else { 
          onShowAlert("Número Privado", "Este usuario ha decidido no compartir su número telefónico. Usa el chat para comunicarte."); 
      } 
  };

  const handleAcceptRequest = async () => { await updateDoc(doc(db, 'reports', report.id), { status: 'accepted' });
  await addDoc(collection(db, `chats/${chatId}/messages`), { text: `✅ Solicitud aceptada por ${user.displayName}.`, system: true, timestamp: serverTimestamp() }); };
  const handleDeclineRequest = async () => { await updateDoc(doc(db, 'reports', report.id), { status: 'cancelled', cancelReason: 'Solicitud rechazada' }); onClose(); };
  
  if (loadingChat && !messages.length) return <div className="h-full bg-white flex flex-col justify-center items-center"><Loader2 className="animate-spin text-blue-500"/><p className="text-xs text-slate-400 mt-2">Cargando chat...</p><button onClick={onClose} className="mt-4 text-xs font-bold text-blue-500">Cancelar</button></div>;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in slide-in-from-right" onClick={() => setIsMenuOpen(false)}>
      
      {/* MODAL MAPA USUARIO (Controlado por showLocationModal) */}
      {showLocationModal && otherUserData && (
          <UserLocationModal targetUser={otherUserData} onClose={() => setShowLocationModal(false)} />
      )}

      <div className="h-16 bg-slate-900 text-white flex items-center px-4 justify-between shadow-md z-10">
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700"><ArrowLeft size={20}/></button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowLocationModal(true)}>
                <Avatar userData={otherUserData} size="w-10 h-10"/>
                <div className="leading-tight">
                    <h3 className="font-bold text-sm">{otherName}</h3>
                    {/* AQUI SE MUESTRA LA PROFESIÓN */}
                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wide">
                        {otherSpecialty}
                    </p>
                </div>
            </div>
        </div>
        <div className="flex gap-2 relative">
            {status === 'accepted' && (<button onClick={handleRequestFinish} className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold border border-blue-400">Solicitar Fin</button>)}
            <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-2 hover:bg-slate-700 rounded-full"><MoreVertical size={20}/></button>
            {isMenuOpen && (
                <div className="absolute right-0 top-10 bg-white shadow-xl border border-slate-100 rounded-xl overflow-hidden w-40 z-50 text-slate-800 animate-in fade-in zoom-in-95">
                    <button onClick={() => setShowLocationModal(true)} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"><MapIcon size={14}/> Ver Ubicación</button>
                    <button onClick={handleCall} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-green-50 text-green-600 flex items-center gap-2 border-b border-slate-100"><Phone size={14}/> Ver Teléfono</button>
                    {!isPending && status !== 'completed' && status !== 'cancelled' && (
                        <button onClick={() => setShowCancel(true)} className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-red-50 text-red-600 flex items-center gap-2"><AlertCircle size={14}/> Cancelar Trabajo</button>
                    )}
                </div>
            )}
        </div>
      </div>

      {isPending && isWorker && (<div className="bg-white p-4 border-b border-slate-200 shadow-sm z-10"><p className="text-sm text-slate-600 mb-3 text-center">Solicitud de nuevo trabajo.</p><div className="flex gap-3"><button onClick={handleDeclineRequest} className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-sm">Rechazar</button><button onClick={handleAcceptRequest} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm">Aceptar</button></div></div>)}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">{messages.map(m => (<div key={m.id} className={`flex ${m.system ? 'justify-center' : (m.uid === user.uid ? 'justify-end' : 'justify-start')}`}>
      {m.type === 'finish_request' ? (
        status === 'completed' ? null : (
          m.uid === user.uid ? (
             <div className="bg-white p-3 rounded-xl shadow border border-slate-200 max-w-[85%] text-center"><p className="text-xs font-bold text-slate-500 italic">Has solicitado finalizar. Esperando confirmación...</p></div>
          ) : (
             <div className="bg-white p-4 rounded-xl shadow border-l-4 border-green-500 max-w-[85%]"><p className="text-sm font-bold text-slate-800 mb-2">{m.text}</p><button onClick={handleConfirmFinish} className="w-full bg-green-600 text-white py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-green-700">✅ Aceptar y Finalizar</button></div>
          )
        )
      ) : (<div className={`max-w-[80%] p-2 px-3 rounded-lg text-sm shadow-sm relative ${m.system ? 'bg-yellow-100 text-slate-600 font-bold border border-yellow-200 text-center text-xs py-1' : m.uid === user.uid ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>{m.text}<span className="text-[9px] text-slate-400 block text-right mt-1">{formatTimeAgo(m.timestamp)}</span></div>)}</div>))}</div>
      <div className="p-3 bg-white border-t flex gap-2"><input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Mensaje..." className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" onKeyDown={e => e.key === 'Enter' && sendMessage()}/><button onClick={sendMessage} className="bg-blue-600 text-white p-2 rounded-full shadow-sm"><Send size={20}/></button></div>
      {showRateModal && (<div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center"><h3 className="font-black text-xl text-slate-800 mb-2">¡Trabajo Finalizado!</h3><p className="text-sm text-slate-500 mb-6">Califica tu experiencia con <span className="font-bold">{otherName}</span></p><div className="flex justify-center gap-2 mb-6">{[1,2,3,4,5].map(star => (<Star key={star} size={36} className={`cursor-pointer transition-transform hover:scale-110 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} onClick={() => setRating(star)}/>))}</div><textarea className="w-full bg-slate-50 border rounded-xl p-3 text-sm mb-4 outline-none focus:ring-2 focus:ring-blue-500" placeholder={`Escribe un comentario sobre ${otherName}...`} rows="3" onChange={e => setReview(e.target.value)}></textarea><button onClick={submitRating} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-black">Enviar Calificación</button></div></div>)}
      {showCancel && (<div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in"><div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl"><h3 className="font-black text-lg text-slate-800 mb-4 text-center">Cancelar Trabajo</h3><p className="text-sm text-slate-500 mb-4">Motivo:</p><div className="space-y-2 mb-6">{CANCEL_REASONS.map(reason => (<label key={reason} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-slate-50 cursor-pointer"><input type="radio" name="cancel" className="accent-red-600 w-4 h-4" onChange={() => setCancelReason(reason)} /><span className="text-sm text-slate-700">{reason}</span></label>))}</div><div className="flex gap-3"><button onClick={() => setShowCancel(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100">Volver</button><button onClick={handleCancelJob} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700">Confirmar Cancelación</button></div></div></div>)}
    </div>
  );
};

// --- 13. USER DASHBOARD (BOTÓN CÁMARA AL CENTRO) ---
const UserDashboard = ({ user, userData, logout, onChangeLocation, toggleSidebar, activeTab, setActiveTab, onShowAlert, onShowConfirm }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [desc, setDesc] = useState('');
  const [showPickerInForm, setShowPickerInForm] = useState(false);
  const [reportLocation, setReportLocation] = useState(userData?.location?.address || '');
  const [reportCoords, setReportCoords] = useState(userData?.location?.coords);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [showWorkersList, setShowWorkersList] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [filterDist, setFilterDist] = useState(10);
  const [filterSpec, setFilterSpec] = useState('Todos');
  const [selectedReport, setSelectedReport] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  
  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
      const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.uid === user.uid);
      setReports(allReports);
      const accepted = allReports.filter(r => r.status === 'accepted');
      const newNotifs = accepted.map(r => ({title: "Solicitud Aceptada", body: `Tu solicitud de ${r.ai?.category || 'servicio'} ha sido aceptada.`, report: r}));
      setNotifications(newNotifs);
    });
  }, [user]);

  useEffect(() => {
    if (showWorkersList) {
      const q = query(collection(db, 'users'), where("role", "==", "worker")); 
      const unsubscribe = onSnapshot(q, (snap) => {
        const allWorkers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const nearby = [...allWorkers, ...MOCK_WORKERS].filter(w => {
          if (filterSpec !== 'Todos' && w.specialty !== filterSpec) return false;
          let dist = 10;
          if (w.location?.coords && userData?.location?.coords) {
            dist = getDistanceFromLatLonInKm(userData.location.coords.lat, userData.location.coords.lng, w.location.coords.lat, w.location.coords.lng);
          } else if (w.dist) { dist = w.dist; }
          w.currentDist = dist.toFixed(1);
          return dist <= filterDist;
        });
        const sortedWorkers = nearby.sort((a, b) => (b.isOnline === true) - (a.isOnline === true));
        const myActiveWorkers = reports.filter(r => r.status === 'pending_approval' || r.status === 
'accepted').map(r => r.workerId);
        const availableWorkers = sortedWorkers.filter(w => !myActiveWorkers.includes(w.id));
        setWorkers(availableWorkers);
      });
      return () => unsubscribe();
    }
  }, [showWorkersList, filterDist, filterSpec, userData, reports]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image(); img.src = ev.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImagePreview(canvas.toDataURL('image/jpeg', 0.6));
          canvas.toBlob((blob) => setImageFile(new File([blob], file.name, { type: "image/jpeg" })), 'image/jpeg', 0.6);
          setActiveTab('create'); setShowMenu(false);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!imageFile || !desc) return onShowAlert("Error", "Falta descripción o foto.", 'error');
    setLoading(true);
    try {
      const aiData = simulateAdvancedAI(desc);
      const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'reports'), {
        uid: user.uid, userName: user.displayName, description: desc, 
        locationString: reportLocation, locationCoords: reportCoords,
        thumbnail: downloadURL, status: 'open', timestamp: serverTimestamp(), ai: aiData
      });
      setImageFile(null); setImagePreview(null); setDesc(''); setActiveTab('feed'); onShowAlert("Éxito", "¡Pedido Enviado!");
    } catch(e) { onShowAlert("Error", e.message, 'error'); }
    setLoading(false);
  };

  const handleDirectHire = async (worker) => {
    onShowConfirm({
        title: "Confirmar Solicitud",
        message: `¿Deseas enviar una solicitud de contacto a ${worker.firstName}?`,
        onConfirm: async () => {
            const docRef = await addDoc(collection(db, 'reports'), {
               uid: user.uid, userName: user.displayName, description: "Solicitud de contacto directo",
               workerId: worker.id, workerName: `${worker.firstName} ${worker.lastName}`,
               status: 'pending_approval', timestamp: serverTimestamp(),
               ai: { category: 'Contacto Directo', urgency: 'Media' },
               thumbnail: null, 
               locationCoords: userData?.location?.coords || null, locationString: userData?.location?.address || "Ubicación cliente"
            });
            await addDoc(collection(db, `chats/${docRef.id}/messages`), { text: `Hola, me gustaría contratar tus servicios de ${worker.specialty}.`, uid: user.uid, userName: user.displayName, timestamp: serverTimestamp() });
            onShowAlert("Solicitud Enviada", "El trabajador ha sido notificado.");
            setActiveTab('chat');
        }
    });
  };

  const handleDeleteReport = async (reportId) => {
      onShowConfirm({
          title: "Eliminar Pedido",
          message: "¿Estás seguro de eliminar este pedido permanentemente?",
          onConfirm: async () => {
              try { await deleteDoc(doc(db, "reports", reportId)); setSelectedReport(null); onShowAlert("Eliminado", "El pedido ha sido eliminado."); } 
              catch (e) { onShowAlert("Error", "No se pudo eliminar.", 'error'); }
          }
      });
  };

  const handleHomeClick = () => { if (activeTab !== 'feed') { setActiveTab('feed'); setShowMenu(false); } else { setShowMenu(!showMenu); } };
  const handleNotificationClick = (report) => { setSelectedReport(report); if(report.status === 'accepted') setActiveTab('chat'); };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 flex flex-col items-center">
      <div className="w-full max-w-md bg-slate-50 min-h-screen relative flex flex-col shadow-2xl">
        {showPickerInForm && <LocationPickerAdvanced initialAddress={reportLocation} onClose={() => setShowPickerInForm(false)} onConfirm={(addr, coords) => { setReportLocation(addr); setReportCoords(coords); setShowPickerInForm(false); }} />}
        {selectedReport && <JobDetailModal job={selectedReport} onClose={() => setSelectedReport(null)} onDelete={handleDeleteReport} />}
        {activeTab === 'profile' && <MyProfileScreen user={user} userData={userData} onBack={handleHomeClick} />}
        {activeTab === 'help' && (
          <div className="fixed inset-0 bg-slate-50 z-[200] overflow-y-auto animate-in fade-in">
             <div className="h-16 bg-white px-4 flex items-center shadow-sm sticky top-0"><button onClick={handleHomeClick}><ArrowLeft size={24} className="text-slate-700"/></button><span className="ml-4 font-bold text-lg">Centro de Ayuda</span></div>
             <div className="p-4 space-y-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto"><HelpCircle size={32}/></div><h3 className="font-bold text-lg text-slate-800">Soporte Técnico</h3><p className="text-sm text-slate-600">¿Problemas con la app o un reporte?</p><div className="bg-slate-50 p-4 rounded-xl font-bold text-slate-700">soporte@infrasalud.demo</div></div></div>
          </div>
        )}

        <header className="h-16 px-4 bg-white sticky top-0 flex items-center justify-between border-b shadow-sm z-20">
          <div className="flex items-center gap-2"><button onClick={toggleSidebar}><Menu size={24} className="text-slate-700"/></button><div className="flex items-center gap-2 ml-2"><Avatar userData={userData} size="w-9 h-9"/><div onClick={onChangeLocation} className="cursor-pointer"><h1 className="font-bold text-slate-800 leading-tight text-sm">Hola, {user.displayName?.split(' ')[0]}</h1><p className="text-[10px] text-slate-400 flex items-center gap-1 truncate max-w-[150px]"><MapPin size={10}/> {userData?.location?.address || 'Ubicación'}</p></div></div></div>
          <div className="relative"><button className="text-slate-400 hover:text-blue-600" onClick={() => setShowNotifPanel(!showNotifPanel)}><Bell size={20}/>{notifications.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button><NotificationPanel notifications={notifications} setNotifications={setNotifications} isOpen={showNotifPanel} onClose={() => setShowNotifPanel(false)} onSelect={handleNotificationClick}/></div>
        </header>

        <main className="flex-1 pb-16 overflow-y-auto w-full relative">
          
          {activeTab === 'feed' && (
            <div className="p-4 relative min-h-full">
              
              {/* BOTÓN CÁMARA CENTRADO Y CON Z-INDEX ALTO */}
              <button onClick={() => setShowMenu(true)} className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-50 hover:scale-110 transition-transform active:scale-95"><Camera size={28}/></button>
              
              <div className="mb-4"><button onClick={() => setShowWorkersList(!showWorkersList)} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-transform"><Users size={18}/> {showWorkersList ? 'Ocultar' : 'Buscar Trabajadores'} {showWorkersList ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
                {showWorkersList && (
                  <div className="mt-3 bg-white border border-orange-100 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top-5"><div className="mb-4 space-y-3 pb-4 border-b border-slate-100"><div className="flex justify-between text-xs font-bold text-slate-500"><span>Distancia</span><span className="text-orange-600">{filterDist} KM</span></div><input type="range" min="1" max="50" value={filterDist} onChange={(e) => setFilterDist(e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"/><div className="relative"><Briefcase size={14} className="absolute left-3 top-3 text-slate-400"/><select className="w-full pl-9 p-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-600 outline-none" value={filterSpec} onChange={(e) => setFilterSpec(e.target.value)}><option value="Todos">Todas las especialidades</option>{HOSPITAL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="space-y-3 max-h-60 overflow-y-auto">{workers.length === 0 ? (<div className="text-center p-6 text-slate-500"><MapPin className="mx-auto mb-2 opacity-50" size={32}/><p className="font-bold">Ubicación sin trabajadores</p><p className="text-xs">Intenta ampliar el rango o cambiar ubicación.</p></div>) : (workers.map((w, idx) => (<div key={idx} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-orange-50 transition-colors"><Avatar userData={w} size="w-12 h-12"/><div className="flex-1"><div className="flex items-center gap-2"><h4 className="font-bold text-slate-800 text-sm">{w.firstName} {w.lastName}</h4>{w.isOnline ? <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span> : <span className="h-2 w-2 rounded-full bg-slate-300"></span>}</div><p className="text-xs text-slate-500 flex items-center gap-1">{w.specialty}</p></div><span className="text-xs font-bold text-green-600">{w.currentDist}km</span><div className="flex flex-col gap-1"><button onClick={() => { if(w.showPhone && w.fullPhone) onShowAlert("Contacto", w.fullPhone); else onShowAlert("Número Privado", "Este trabajador no comparte su número."); }} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"><Phone size={10}/> Número</button><button onClick={() => handleDirectHire(w)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"><CheckSquare size={10}/> Contratar</button></div></div>)))}</div></div>
                  )}
              </div>
              <h2 className="font-bold text-green-600 text-sm uppercase tracking-wide flex items-center gap-2 mb-3"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Problemas activos</h2>
              <div className="grid grid-cols-2 gap-3">{reports.filter(r => r.ai?.category !== 'Contacto Directo' && r.status !== 'completed' && r.status !== 'cancelled').length === 0 ? (<p className="col-span-2 text-center text-xs text-slate-400 py-6">No tienes problemas activos.</p>) : (reports.filter(r => r.ai?.category !== 'Contacto Directo' && r.status !== 'completed' && r.status !== 'cancelled').map(r => (<div key={r.id} onClick={() => setSelectedReport(r)} className={`bg-white p-3 rounded-2xl shadow-sm border-2 flex flex-col justify-between aspect-square relative overflow-hidden active:scale-95 transition-transform cursor-pointer ${r.status === 'accepted' ? 'border-green-100' : 'border-slate-100'}`}><div className="h-20 w-full rounded-lg overflow-hidden mb-2 bg-slate-100 relative"><img src={r.thumbnail} className="w-full h-full object-cover" /></div><div className={`absolute top-2 right-2 px-2 py-1 rounded-bl-xl text-[8px] font-bold uppercase text-white ${r.status === 'accepted' ? 'bg-green-500' : 'bg-blue-500'}`}>{r.status === 'accepted' ? 'Aceptado' : 'Abierto'}</div><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{r.ai?.category || 'General'}</div><h3 className="font-bold text-slate-800 text-xs leading-tight line-clamp-2 mb-1">{r.description}</h3></div><div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><MapPin size={8}/> {r.locationString ? r.locationString.split(',')[0] : 'Ubicación'}</span><button className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold">Ver</button></div></div>)))}</div>
            </div>
          )}
          {activeTab === 'chat' && <InboxScreen user={user} userData={userData} onShowAlert={onShowAlert} onShowConfirm={onShowConfirm}/>}
          {activeTab === 'history' && (
             <div className="space-y-4 animate-in fade-in p-4"><h2 className="font-bold text-slate-700 mb-2">Historial Completo</h2>{reports.length === 0 ? <p className="text-center text-xs text-slate-400">Sin historial.</p> : reports.filter(r => r.status === 'completed' || r.status === 'cancelled').map(r => (<div key={r.id} onClick={() => setSelectedReport(r)} className={`p-3 rounded-xl shadow-md border mb-3 flex gap-3 h-28 overflow-hidden cursor-pointer relative transition-transform hover:scale-[1.02] ${r.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200'}`}><div className="w-24 h-full rounded-lg bg-white overflow-hidden shadow-sm shrink-0 flex items-center justify-center"><img src={r.status === 'completed' ? IMG_STATUS_DONE : IMG_STATUS_CANCEL} className="w-12 h-12 drop-shadow-md" /></div><div className="flex-1 flex flex-col justify-center pl-2"><div className="flex items-center gap-2 mb-1"><span className={`text-xs font-black uppercase tracking-wider ${r.status === 'completed' ? 'text-green-700' : 'text-red-600'}`}>{r.status === 'completed' ? 'Completado' : 'Cancelado'}</span></div><h3 className="font-bold text-slate-800 text-sm line-clamp-1">{r.ai?.category || 'Pedido General'}</h3><p className="text-xs text-slate-600 italic line-clamp-2 mt-1">"{r.description}"</p><p className="text-[10px] text-slate-400 mt-auto text-right">{formatShortDate(r.timestamp)}</p></div></div>))}</div>
        )}
        
        {/* MODAL NUEVA SOLICITUD (CÁMARA) CON Z-INDEX MÁXIMO */}
        {showMenu && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 animate-in fade-in">
                <div className="bg-white w-full max-w-sm p-6 rounded-2xl text-center space-y-4 relative">
                    <button onClick={() => setShowMenu(false)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X size={20}/></button>
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-2"><Camera size={32}/></div>
                    <h3 className="text-xl font-black text-slate-800">Nueva Solicitud</h3>
                    <p className="text-sm text-slate-500">Toma una foto del problema para que la IA lo analice.</p>
                    <label className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition shadow-lg active:scale-95">
                        📸 Tomar Foto
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                    </label>
                </div>
            </div>
        )}
        
        {/* TAB CREAR (VISTA PREVIA FOTO) */}
        {activeTab === 'create' && <div className="p-4"><div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100"><h2 className="font-bold text-center mb-4 text-slate-700">Detalles del Problema</h2><div className="flex gap-3 h-32 mb-4"><div className="w-28 bg-slate-100 rounded-xl border-2 border-dashed flex items-center justify-center relative overflow-hidden">{imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" />}<label className="absolute inset-0 cursor-pointer"><input type="file" className="hidden" onChange={handleFile} /></label></div><textarea className="flex-1 border p-3 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Descripción..." onChange={e => setDesc(e.target.value)} value={desc}/></div><div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 flex items-center gap-2 cursor-pointer hover:bg-blue-100 transition" onClick={() => setShowPickerInForm(true)}><MapPin size={20} className="text-blue-600"/><div className="flex-1 overflow-hidden"><p className="text-[10px] text-blue-400 font-bold uppercase">Ubicación del problema</p><p className="text-xs font-bold text-blue-800 truncate">{reportLocation || "Toca para buscar en mapa"}</p></div><ChevronDown size={16} className="text-blue-400"/></div><button onClick={handleSend} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-md">{loading ? "Enviando..." : "Enviar Pedido"}</button></div></div>}

        </main>
        
        <div className="fixed bottom-0 w-full max-w-md bg-white border-t h-16 flex justify-around items-center z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]"><button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab==='history'?'text-orange-600':'text-slate-400'}`}><History size={24} /><span className="text-[10px] font-bold">Historial</span></button><button onClick={handleHomeClick} className={`flex flex-col items-center gap-1 ${activeTab==='feed'?'text-orange-600':'text-slate-400'}`}><Home size={24} /><span className="text-[10px] font-bold">Inicio</span></button><button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 ${activeTab==='chat'?'text-orange-600':'text-slate-400'}`}><MessageSquare size={24} /><span className="text-[10px] font-bold block">Chat</span></button></div>
      </div>
    </div>
  );
};

// --- 14. WORKER DASHBOARD ---
const WorkerDashboard = ({ user, userData, logout, onChangeLocation, toggleSidebar, activeTab, setActiveTab, onShowAlert, onShowConfirm }) => {
  const [jobs, setJobs] = useState([]);
  const [isOnline, setIsOnline] = useState(userData?.isOnline || false); 
  const [workRadius, setWorkRadius] = useState(10); 
  const [selectedJob, setSelectedJob] = useState(null);
  const [myCoords, setMyCoords] = useState(userData?.location?.coords || { lat: -33.4489, lng: -70.6693 });
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [reports, setReports] = useState([]);
  const [discardedIds, setDiscardedIds] = useState([]);

  useEffect(() => { if (userData) setIsOnline(userData.isOnline); }, [userData]);
  useEffect(() => { if(userData?.location?.coords) setMyCoords(userData.location.coords); }, [userData]);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
      const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.workerId === user.uid && (r.status === 'completed' || r.status === 'cancelled'));
      setReports(allReports);
    });
  }, [user]);

  const handleDiscard = (id) => setDiscardedIds(prev => [...prev, id]);
  const handleRestore = (id) => setDiscardedIds(prev => prev.filter(item => item !== id));

  useEffect(() => {
    if (!isOnline) { setJobs([]); return; }
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const nearbyJobs = allJobs.filter(job => {
        if (job.status === 'open') {
            const dist = getDistanceFromLatLonInKm(myCoords.lat, myCoords.lng, job.locationCoords?.lat, job.locationCoords?.lng);
            return dist <= workRadius;
        } else if (job.status === 'pending_approval' && job.workerId === user.uid) {
            return true;
        }
        return false;
      });
      const sortedJobs = nearbyJobs.sort((a, b) => {
        const priority = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
        return (priority[b.ai?.urgency] || 0) - (priority[a.ai?.urgency] || 0);
      });
      setJobs(sortedJobs);
      const myRequests = allJobs.filter(job => job.workerId === user.uid && job.status === 'pending_approval');
      const newNotifs = myRequests.map(req => ({title: "Nueva Solicitud", body: `${req.userName} te ha enviado una solicitud.`, report: req}));
      setNotifications(newNotifs);
    });
    return () => unsubscribe();
  }, [isOnline, workRadius, myCoords, user.uid]);

  const toggleOnlineStatus = async () => { const newState = !isOnline; setIsOnline(newState); await updateDoc(doc(db, 'users', user.uid), { isOnline: newState }); };
  const handleAcceptJob = async (job) => { await updateDoc(doc(db, 'reports', job.id), { status: 'accepted', workerId: user.uid, workerName: user.displayName });
  await addDoc(collection(db, `chats/${job.id}/messages`), { text: "¡He aceptado tu solicitud! Estoy disponible para ayudarte.", system: true, timestamp: serverTimestamp() }); setActiveTab('chat'); setSelectedJob(null); };
  const handleHomeClick = () => { setActiveTab('home'); };
  
  const handleNotificationClick = (report) => { 
      if(report.status === 'pending_approval' || report.status === 'open') setSelectedJob(report);
      else if(report.status === 'accepted') setActiveTab('chat');
  };

  const visibleJobs = jobs.filter(j => !discardedIds.includes(j.id));
  const pendingJobs = visibleJobs.filter(j => j.status === 'pending_approval');
  const openJobs = visibleJobs.filter(j => j.status === 'open');
  const discardedList = jobs.filter(j => discardedIds.includes(j.id));

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center"><div className="w-full max-w-md bg-slate-50 min-h-screen relative flex flex-col shadow-2xl">
      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} onDiscard={handleDiscard} onAccept={handleAcceptJob} />}
      {activeTab === 'profile' && <MyProfileScreen user={user} userData={userData} onBack={handleHomeClick} />}
      {activeTab === 'help' && (
          <div className="fixed inset-0 bg-slate-50 z-[200] overflow-y-auto animate-in fade-in">
             <div className="h-16 bg-white px-4 flex items-center shadow-sm sticky top-0"><button onClick={handleHomeClick}><ArrowLeft size={24} className="text-slate-700"/></button><span className="ml-4 font-bold text-lg">Centro de Ayuda</span></div>
             <div className="p-4 space-y-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4"><div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto"><HelpCircle size={32}/></div><h3 className="font-bold text-lg text-slate-800">Soporte Técnico</h3><p className="text-sm text-slate-600">¿Problemas con la app o un reporte?</p><div className="bg-slate-50 p-4 rounded-xl font-bold text-slate-700">soporte@infrasalud.demo</div></div></div>
          </div>
      )}

      <header className="h-16 px-4 bg-white sticky top-0 flex items-center justify-between border-b border-orange-100 shadow-sm z-30 w-full">
        <div className="flex items-center gap-3"><button onClick={toggleSidebar}><Menu size={24} className="text-slate-700"/></button><div className="flex items-center gap-2 ml-2"><Avatar userData={userData} size="w-9 h-9"/><div onClick={onChangeLocation} className="cursor-pointer"><h1 className="font-bold text-slate-800 leading-tight text-xs">Hola, {user.displayName?.split(' ')[0]}</h1><p className="text-[9px] font-bold text-orange-500 uppercase flex items-center gap-1 truncate max-w-[100px]"><MapPin size={8}/> {userData?.location?.address?.split(',')[0] || 'Definir Zona'}</p></div></div></div>
        <div className="flex items-center gap-2 relative">
          <div onClick={toggleOnlineStatus} className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer transition-all border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-slate-100 border-slate-200'}`}><div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div><span className={`text-[9px] font-bold uppercase ${isOnline ? 'text-green-700' : 'text-slate-500'}`}>{isOnline ? 'ON' : 'OFF'}</span></div>
          <button className="p-2 text-slate-400 hover:text-orange-500 relative" onClick={() => setShowNotifPanel(!showNotifPanel)}><Bell size={20}/>{notifications.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
          <NotificationPanel notifications={notifications} setNotifications={setNotifications} isOpen={showNotifPanel} onClose={() => setShowNotifPanel(false)} onSelect={handleNotificationClick} />
        </div>
      </header>

      <main className="flex-1 pb-16 overflow-y-auto w-full">
        {activeTab === 'home' && (!isOnline ? <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50"><Power size={64} className="text-slate-300 mb-4"/><h2 className="text-xl font-bold text-slate-400">Estás desconectado</h2><p className="text-sm text-slate-400">Activa el switch arriba.</p></div> : (activeTab === 'home' && <div className="p-4 space-y-4 animate-in fade-in">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="flex justify-between text-xs font-bold text-slate-500 mb-2"><span>Radio de trabajo</span><span className="text-orange-600">{workRadius} KM</span></div><input type="range" min="1" max="100" value={workRadius} onChange={(e) => setWorkRadius(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"/></div>
        {discardedList.length > 0 && (
            <div className="mb-4"><h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Trabajos Descartados</h3><div className="flex gap-2 overflow-x-auto pb-2">{discardedList.map(job => (<div key={job.id} className="min-w-[150px] bg-slate-100 p-2 rounded-xl border border-slate-200 opacity-70 hover:opacity-100 transition-opacity"><p className="text-[10px] font-bold truncate">{job.ai?.category}</p><p className="text-[9px] text-slate-500 truncate mb-2">{job.description}</p><button onClick={() => handleRestore(job.id)} className="w-full bg-white border border-slate-300 rounded-lg py-1 text-[9px] font-bold flex items-center justify-center gap-1"><RotateCcw size={8}/> Recuperar</button></div>))}</div></div>
        )}
        
        {/* SECCIÓN DE SOLICITUDES PENDIENTES RESTAURADA */}
        {pendingJobs.length > 0 && (
            <div className="mb-6 animate-in slide-in-from-left">
                <h2 className="font-bold text-orange-600 text-sm uppercase tracking-wide flex items-center gap-2 mb-2"><div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div> Solicitudes Pendientes</h2>
                <div className="space-y-2">
                    {pendingJobs.map(job => (
                        <div key={job.id} onClick={() => setSelectedJob(job)} className="bg-gradient-to-r from-orange-50 to-white p-3 rounded-xl border border-orange-200 shadow-sm cursor-pointer flex justify-between items-center">
                            <div><p className="font-bold text-sm text-slate-800">{job.userName} te busca</p><p className="text-xs text-orange-600 font-medium">Solicitud Directa</p></div>
                            <button className="bg-orange-500 text-white px-3 py-1 text-xs font-bold rounded-lg shadow-sm">Revisar</button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2"><Zap size={16} className="text-orange-500"/> Solicitudes ({openJobs.length})</h2>
        <div className="grid grid-cols-2 gap-3">{openJobs.map(job => { const dist = getDistanceFromLatLonInKm(myCoords.lat, myCoords.lng, job.locationCoords?.lat, job.locationCoords?.lng).toFixed(1);
return (<div key={job.id} className={`bg-white p-3 rounded-2xl shadow-sm border-2 flex flex-col justify-between aspect-square relative overflow-hidden active:scale-95 transition-transform cursor-pointer ${job.ai?.urgency === 'Alta' ? 'border-red-100' : 'border-slate-100'}`}><div className="h-20 w-full rounded-lg overflow-hidden mb-2 bg-slate-100 relative"><img src={job.thumbnail} className="w-full h-full object-cover" onError={(e) => e.target.src="https://via.placeholder.com/150"} /></div><div className={`absolute top-2 right-2 px-2 py-1 rounded-bl-xl text-[8px] font-bold uppercase text-white ${job.ai?.urgency === 'Alta' ? 'bg-red-500' : 'bg-green-500'}`}>{job.ai?.urgency}</div><div><div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{job.ai?.category || 'General'}</div><h3 className="font-bold text-slate-800 text-xs leading-tight line-clamp-2 mb-1">{job.description}</h3></div><div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center"><span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><MapPin size={8}/> {dist}km</span><button onClick={() => setSelectedJob(job)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold">Ver</button></div></div>);
})}</div>{openJobs.length === 0 && pendingJobs.length === 0 && discardedList.length === 0 && <div className="text-center py-10 opacity-60"><Loader2 className="w-8 h-8 mx-auto animate-spin text-orange-400 mb-2"/><p className="text-xs font-bold text-slate-400">Escaneando zona...</p></div>}</div>))}
        {activeTab === 'chat' && <InboxScreen user={user} userData={userData} onShowAlert={onShowAlert} onShowConfirm={onShowConfirm}/>}
        {activeTab === 'history' && (
             <div className="space-y-4 animate-in fade-in p-4"><h2 className="font-bold text-slate-700 mb-2">Historial Completo</h2>{reports.length === 0 ? <p className="text-center text-xs text-slate-400">Sin historial.</p> : reports.filter(r => r.status === 'completed' || r.status === 'cancelled').map(r => (<div key={r.id} onClick={() => setSelectedReport(r)} className={`p-3 rounded-xl shadow-md border mb-3 flex gap-3 h-28 overflow-hidden cursor-pointer relative transition-transform hover:scale-[1.02] ${r.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200' : 'bg-gradient-to-r from-red-50 to-red-100 border-red-200'}`}><div className="w-24 h-full rounded-lg bg-white overflow-hidden shadow-sm shrink-0 flex items-center justify-center"><img src={r.status === 'completed' ? IMG_STATUS_DONE : IMG_STATUS_CANCEL} className="w-12 h-12 drop-shadow-md" /></div><div className="flex-1 flex flex-col justify-center pl-2"><div className="flex items-center gap-2 mb-1"><span className={`text-xs font-black uppercase tracking-wider ${r.status === 'completed' ? 'text-green-700' : 'text-red-600'}`}>{r.status === 'completed' ? 'Completado' : 'Cancelado'}</span></div><h3 className="font-bold text-slate-800 text-sm line-clamp-1">{r.ai?.category || 'Pedido General'}</h3><p className="text-xs text-slate-600 italic line-clamp-2 mt-1">"{r.description}"</p><p className="text-[10px] text-slate-400 mt-auto text-right">{formatShortDate(r.timestamp)}</p></div></div>))}</div>
        )}
        </main>
 
        <div className="fixed bottom-0 w-full max-w-md bg-white border-t h-16 flex justify-around items-center z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]"><button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab==='history'?'text-orange-600':'text-slate-400'}`}><History size={24} /><span className="text-[10px] font-bold">Historial</span></button><button onClick={handleHomeClick} className={`flex flex-col items-center gap-1 ${activeTab==='home'?'text-orange-600':'text-slate-400'}`}><Home size={24} /><span className="text-[10px] font-bold">Inicio</span></button><button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 ${activeTab==='chat'?'text-orange-600':'text-slate-400'}`}><MessageSquare size={24} /><span className="text-[10px] font-bold block">Chat</span></button></div>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  
  // ESTADOS GLOBALES PARA MODALES
  const [alertInfo, setAlertInfo] = useState({ show: false, title: '', message: '', type: 'info' });
  const [confirmInfo, setConfirmInfo] = useState({ show: false, title: '', message: '', onConfirm: null });

  useEffect(() => { document.title = "InfraSalud"; }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const unsub = onSnapshot(doc(db, "users", u.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setUser(u);
            if (!data.location) setShowLocationModal(true);
            setLoading(false);
          }
        });
        return () => unsub();
      } else { setUser(null); setUserData(null); setLoading(false); }
    });
  }, []);
  
  const handleUpdateLocation = async (address, coords) => {
    if (!user) return;
    const locationData = { address, coords };
    await updateDoc(doc(db, "users", user.uid), { location: locationData });
    setShowLocationModal(false);
  };
  const logout = () => { setSidebarOpen(false); signOut(auth); };

  if (loading) return <div className="h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;
  if (!user) return <LoginScreen />;

  if (showLocationModal) return <LocationPickerAdvanced onConfirm={handleUpdateLocation} initialAddress="" onClose={() => setShowLocationModal(false)} />;
  
  // Funciones para disparar modales
  const showAlert = (title, message, type = 'info') => setAlertInfo({ show: true, title, message, type });
  const showConfirm = ({ title, message, onConfirm }) => setConfirmInfo({ show: true, title, message, onConfirm });

  const dashboardProps = {
    user, userData, logout, 
    onChangeLocation: () => setShowLocationModal(true),
    toggleSidebar: () => setSidebarOpen(true),
    activeTab, setActiveTab,
    onShowAlert: showAlert, onShowConfirm: showConfirm
  };
  return (
    <>
      <CustomAlertModal isOpen={alertInfo.show} title={alertInfo.title} message={alertInfo.message} type={alertInfo.type} onClose={() => setAlertInfo({ ...alertInfo, show: false })} />
      <CustomConfirmModal isOpen={confirmInfo.show} title={confirmInfo.title} message={confirmInfo.message} onCancel={() => setConfirmInfo({ ...confirmInfo, show: false })} onConfirm={() => { if(confirmInfo.onConfirm) confirmInfo.onConfirm(); setConfirmInfo({ ...confirmInfo, show: false }); }} />
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} userData={userData} logout={logout} onNavigate={(tab) => setActiveTab(tab)} />
      {userData?.role === 'worker' ? <WorkerDashboard {...dashboardProps} /> : <UserDashboard {...dashboardProps} />}
    </>
  );
}

export default App;