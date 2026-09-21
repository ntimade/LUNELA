import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db as firestore } from '../config/firebase';
import { DEFAULT_CONTENT } from '../screens/education/defaultContent';

// ─── Contenu éducatif géré par l'administrateur (Firestore) ──────────────────
// Même schéma que useQuizQuestions / useContraceptives : on seed le contenu
// par défaut au premier lancement, puis l'admin ajoute/modifie/supprime via
// EducationManagerScreen. Chaque article stocke targetProfile ('girl'|'boy'|
// 'both') et category pour être filtré côté écran de consultation.
export const useEducationContent = () => {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const colRef = collection(firestore, 'educational_content');

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(colRef);
      if (snap.empty) {
        await seedInitialData();
      } else {
        setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      setArticles(DEFAULT_CONTENT);
    } finally {
      setLoading(false);
    }
  };

  const seedInitialData = async () => {
    const flat = DEFAULT_CONTENT.map(({ id: _discard, ...a }) => a);
    try {
      const refs = await Promise.all(flat.map(a => addDoc(colRef, a)));
      setArticles(refs.map((r, i) => ({ id: r.id, ...flat[i] })));
    } catch (e) {
      setArticles(DEFAULT_CONTENT);
    }
  };

  useEffect(() => { load(); }, []);

  const addArticle = async (article) => {
    const ref = await addDoc(colRef, article);
    setArticles(prev => [...prev, { id: ref.id, ...article }]);
  };

  const updateArticle = async (id, updates) => {
    await updateDoc(doc(firestore, 'educational_content', id), updates);
    setArticles(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteArticle = async (id) => {
    await deleteDoc(doc(firestore, 'educational_content', id));
    setArticles(prev => prev.filter(a => a.id !== id));
  };

  return { articles, loading, addArticle, updateArticle, deleteArticle, reload: load };
};
