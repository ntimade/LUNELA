import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const INITIAL_DATA = [
  // Contraceptifs hormonaux
  { category: 'Hormonaux', emoji: '💊', name: 'Pilule contraceptive', efficacy: '99%', duration: 'Quotidien', color: '#EC4899', description: 'Comprimé hormonal à prendre chaque jour. Régule le cycle et prévient la grossesse.', pros: ['Très efficace', 'Régule le cycle', 'Réduit les douleurs'], cons: ['À prendre tous les jours', 'Effets secondaires possibles', 'Sur ordonnance'], order: 1 },
  { category: 'Hormonaux', emoji: '💉', name: 'Implant contraceptif', efficacy: '99.9%', duration: '3 ans', color: '#8B5CF6', description: 'Petit bâtonnet inséré sous la peau du bras. Libère des hormones en continu.', pros: ['Très longue durée', 'Aucun oubli possible', 'Réversible'], cons: ['Insertion médicale', 'Irrégularités du cycle', 'Coût initial'], order: 2 },
  { category: 'Hormonaux', emoji: '🩹', name: 'Patch contraceptif', efficacy: '99%', duration: 'Hebdomadaire', color: '#F59E0B', description: 'Timbre collé sur la peau, changé chaque semaine pendant 3 semaines.', pros: ['Une fois par semaine', 'Facile à utiliser', 'Efficace'], cons: ['Visible sur la peau', 'Peut se décoller', 'Sur ordonnance'], order: 3 },
  // Dispositifs
  { category: 'Dispositifs', emoji: '🔵', name: 'DIU hormonal (Stérilet)', efficacy: '99.9%', duration: '5 ans', color: '#3B82F6', description: 'Petit dispositif en T inséré dans l\'utérus par un médecin.', pros: ['5 ans de protection', 'Très efficace', 'Sans oubli'], cons: ['Pose par médecin', 'Crampes possibles', 'Coût initial élevé'], order: 4 },
  { category: 'Dispositifs', emoji: '🟢', name: 'DIU au cuivre (Stérilet)', efficacy: '99.9%', duration: '10 ans', color: '#10B981', description: 'Dispositif en cuivre sans hormones. Utilisable aussi comme contraception d\'urgence.', pros: ['Sans hormones', '10 ans de protection', 'Contraception urgence'], cons: ['Règles plus abondantes', 'Pose médicale', 'Crampes possibles'], order: 5 },
  // Barrière
  { category: 'Barrière', emoji: '🛡️', name: 'Préservatif féminin', efficacy: '95%', duration: 'Usage unique', color: '#06B6D4', description: 'Gaine en polyuréthane insérée dans le vagin. Protège aussi contre les IST.', pros: ['Protège des IST', 'Sans hormones', 'En vente libre'], cons: ['Usage unique', 'Placement technique', 'Moins spontané'], order: 6 },
  // Urgence
  { category: 'Urgence', emoji: '⚡', name: 'Pilule du lendemain', efficacy: '95%', duration: '72h max', color: '#EF4444', description: 'Contraception d\'urgence à prendre dans les 72h après un rapport non protégé.', pros: ['Sans ordonnance', 'Efficace si prise tôt', 'Accessible en pharmacie'], cons: ['Pas en contraception régulière', 'Effets secondaires', 'Coûteuse'], order: 7 },
  // Naturels
  { category: 'Naturels', emoji: '📅', name: 'Méthode du calendrier', efficacy: '76-88%', duration: 'Permanent', color: '#84CC16', description: 'Suivi du cycle pour identifier les jours fertiles et éviter les rapports à risque.', pros: ['Sans hormones', 'Gratuit', 'Connaissance du corps'], cons: ['Moins fiable', 'Nécessite cycle régulier', 'Aucune protection IST'], order: 8 },
  // Protection hygiénique
  { category: 'Protection', emoji: '🩸', name: 'Serviette hygiénique', efficacy: '-', duration: 'Usage unique', color: '#F472B6', description: 'Protection externe absorbante portée dans le sous-vêtement pendant les règles.', pros: ['Facile à utiliser', 'Disponible partout', 'Sans insertion'], cons: ['Usage unique', 'Déchet plastique', 'Peut bouger'], order: 9 },
  { category: 'Protection', emoji: '🔴', name: 'Tampon', efficacy: '-', duration: 'Usage unique', color: '#FB7185', description: 'Protection interne en coton ou rayonne insérée dans le vagin pendant les règles.', pros: ['Discret', 'Permet la natation', 'Confortable'], cons: ['Risque choc toxique', 'Changement régulier', 'Usage unique'], order: 10 },
  { category: 'Protection', emoji: '🫙', name: 'Coupe menstruelle', efficacy: '-', duration: '5-10 ans', color: '#A78BFA', description: 'Coupe en silicone réutilisable insérée dans le vagin pour collecter le flux menstruel.', pros: ['Réutilisable', 'Économique', 'Écologique'], cons: ['Apprentissage nécessaire', 'Nettoyage requis', 'Coût initial'], order: 11 },
  { category: 'Protection', emoji: '🩲', name: 'Culotte menstruelle', efficacy: '-', duration: 'Réutilisable', color: '#F97316', description: 'Sous-vêtement absorbant lavable conçu pour les règles.', pros: ['Confortable', 'Écologique', 'Réutilisable'], cons: ['Coût initial élevé', 'Temps de séchage', 'Capacité limitée'], order: 12 },
  { category: 'Protection', emoji: '🟡', name: 'Protège-slip', efficacy: '-', duration: 'Usage unique', color: '#FBBF24', description: 'Fine protection quotidienne pour les pertes légères ou en fin de règles.', pros: ['Ultra-fin', 'Discret', 'Pour pertes légères'], cons: ['Faible capacité', 'Usage unique', 'Irritations possibles'], order: 13 },
];

export const useContraceptives = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const colRef = collection(db, 'contraceptives');

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(colRef, orderBy('order')));
      if (snap.empty) {
        // Premier lancement : on seed les données initiales
        await seedInitialData();
      } else {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      // Firestore inaccessible : données initiales locales
      setItems(INITIAL_DATA.map((d, i) => ({ id: String(i), ...d })));
    } finally {
      setLoading(false);
    }
  };

  const seedInitialData = async () => {
    try {
      const promises = INITIAL_DATA.map(item => addDoc(colRef, item));
      const refs = await Promise.all(promises);
      setItems(refs.map((r, i) => ({ id: r.id, ...INITIAL_DATA[i] })));
    } catch (e) {
      setItems(INITIAL_DATA.map((d, i) => ({ id: String(i), ...d })));
    }
  };

  useEffect(() => { load(); }, []);

  const addItem = async (item) => {
    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order || 0)) + 1 : 1;
    const newItem = { ...item, order: maxOrder };
    const ref = await addDoc(colRef, newItem);
    setItems(prev => [...prev, { id: ref.id, ...newItem }]);
  };

  const updateItem = async (id, updates) => {
    await updateDoc(doc(db, 'contraceptives', id), updates);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, 'contraceptives', id));
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const categories = ['Tous', ...Array.from(new Set(items.map(i => i.category)))];

  return { items, loading, addItem, updateItem, deleteItem, categories, reload: load };
};
