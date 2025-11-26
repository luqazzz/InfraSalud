import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Camera, Send, Loader2 } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyC_zVJFg1IDP4r1zdZmp_dHYxni_tQ4Srw",
  authDomain: "nuevaapp-df1cd.firebaseapp.com",
  projectId: "nuevaapp-df1cd",
  storageBucket: "nuevaapp-df1cd.firebasestorage.app",
  messagingSenderId: "29397583366",
  appId: "1:29397583366:web:ba81a48ad4270889806587"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [image, setImage] = useState(null);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const handleSend = async () => {
    if (!image || !desc) return;
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, description: desc })
      });

      const aiData = await res.json();

      await addDoc(collection(db, 'reports'), {
        uid: user.uid,
        description: desc,
        thumbnail: image,
        ai: aiData,
        timestamp: serverTimestamp()
      });

      setImage(null);
      setDesc('');
    } catch (e) {
      alert("Error llamando al backend.");
      console.error(e);
    }

    setLoading(false);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result);
    if (file) reader.readAsDataURL(file);
  };

  if (!user) return <div className="p-10 text-white bg-slate-900 h-screen">Cargando usuario...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center mb-6">📢 Reporte Ciudadano</h1>

        <div className="bg-slate-800 p-4 rounded-xl space-y-4 border border-slate-700">
          <label className="block w-full h-32 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700">
            {image ? <img src={image} className="h-full object-contain" /> :
              <div className="text-center text-slate-400"><Camera className="mx-auto mb-2" />Subir Foto</div>}
            <input type="file" className="hidden" onChange={handleFile} accept="image/*" />
          </label>

          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="¿Qué está pasando?"
            className="w-full bg-slate-900 p-3 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500"
          />

          <button
            onClick={handleSend}
            disabled={loading || !image || !desc}
            className="w-full bg-indigo-600 py-3 rounded-lg font-bold flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            {loading ? 'Analizando...' : 'Enviar Reporte'}
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Reportes Recientes</h2>
          {reports.map(r => (
            <div key={r.id} className="bg-slate-800 p-3 rounded-xl flex gap-3 border border-slate-700">
              <img src={r.thumbnail} className="w-20 h-20 rounded-lg object-cover bg-black" />
              <div>
                <div className="flex gap-2 mb-1">
                  <span className="bg-indigo-900 text-indigo-200 text-xs px-2 py-0.5 rounded font-bold">{r.ai?.problem_type || '...'}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-bold bg-slate-700 text-white">{r.ai?.urgency}</span>
                </div>
                <p className="text-sm text-slate-300">{r.description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
