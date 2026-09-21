// Contenu éducatif embarqué — utilisé si Firestore est vide
// targetProfile : 'girl' | 'boy' | 'both'

export const DEFAULT_CONTENT = [
  // ─── CYCLE ────────────────────────────────────────────────────────────────
  {
    id: 'girl_cycle_01',
    targetProfile: 'girl',
    category: 'cycle',
    title: 'Les 4 phases du cycle menstruel',
    order: 1,
    body: `Le cycle menstruel est divisé en 4 phases principales :\n\n**1. La menstruation (jours 1 à 5)**\nL'utérus se débarrasse de sa muqueuse. C'est le début officiel du cycle. Des crampes légères à modérées sont normales.\n\n**2. La phase folliculaire (jours 1 à 13)**\nLes follicules ovariens se développent sous l'effet des hormones. L'énergie remonte progressivement, l'humeur s'améliore.\n\n**3. L'ovulation (jour 14 environ)**\nUn ovule est libéré. C'est la période de fertilité maximale. Certaines femmes ressentent une légère douleur côté pelvien.\n\n**4. La phase lutéale (jours 15 à 28)**\nLe corps se prépare à une éventuelle grossesse. Si l'ovule n'est pas fécondé, les hormones chutent et les règles arrivent.\n\nChaque cycle est unique. Une durée entre 21 et 35 jours est considérée normale.`,
  },
  {
    id: 'girl_cycle_02',
    targetProfile: 'girl',
    category: 'cycle',
    title: 'Comprendre ses douleurs menstruelles',
    order: 2,
    body: `Les douleurs menstruelles (dysménorrhée) sont très courantes. Voici ce qu'il faut savoir :\n\n**Douleurs primaires**\nCausées par les contractions de l'utérus pour expulser la muqueuse. Elles surviennent avant ou pendant les règles et durent 1 à 3 jours.\n\n**Douleurs secondaires**\nPeuvent indiquer une endométriose, des fibromes ou une autre condition médicale. Si les douleurs sont très intenses ou s'aggravent avec le temps, consulte un médecin.\n\n**Comment soulager :**\n• Chaleur sur le bas-ventre (bouillotte)\n• Activité physique légère\n• Ibuprofène (anti-inflammatoire)\n• Hydratation suffisante\n• Éviter le café et l'alcool\n\nN'accepte pas des douleurs invalidantes comme "normales". Tu peux en parler à un professionnel de santé.`,
  },
  {
    id: 'girl_cycle_03',
    targetProfile: 'girl',
    category: 'cycle',
    title: 'Le Syndrome Prémenstruel (SPM)',
    order: 3,
    body: `Le SPM regroupe les symptômes physiques et émotionnels qui surviennent dans les jours précédant les règles.\n\n**Symptômes fréquents :**\n• Sautes d'humeur, irritabilité\n• Gonflement et sensibilité des seins\n• Fatigue et troubles du sommeil\n• Ballonnements\n• Maux de tête\n• Envies alimentaires (sucre, sel)\n\n**Pourquoi ça arrive ?**\nLes fluctuations des œstrogènes et de la progestérone affectent la sérotonine, l'hormone du bien-être.\n\n**Ce qui aide :**\n• Exercice régulier (libère des endorphines)\n• Alimentation équilibrée (moins de sel, de sucre)\n• Sommeil suffisant\n• Gestion du stress (méditation, respiration)\n• Calcium et magnésium\n\nTenir un journal de symptômes aide à anticiper et mieux gérer le SPM.`,
  },

  // ─── FERTILITÉ ────────────────────────────────────────────────────────────
  {
    id: 'girl_fert_01',
    targetProfile: 'girl',
    category: 'fertilite',
    title: 'La fenêtre de fertilité expliquée',
    order: 1,
    body: `La fertilité ne dure pas tout le cycle. Comprendre sa fenêtre fertile est important que tu cherches à concevoir ou à éviter une grossesse.\n\n**Quand es-tu fertile ?**\nL'ovule ne survit que 12 à 24 heures après l'ovulation. Mais les spermatozoïdes peuvent vivre jusqu'à 5 jours dans l'organisme.\n\nLa fenêtre fertile dure donc environ **6 jours** : les 5 jours avant l'ovulation + le jour de l'ovulation.\n\n**Comment détecter l'ovulation :**\n• Variation de la température basale (légère hausse)\n• Modifications de la glaire cervicale (devient transparente et filante)\n• Légère douleur pelvienne (mittelschmerz)\n• Applications de suivi de cycle\n• Tests d'ovulation en pharmacie\n\n**Important :** Le cycle peut varier d'un mois à l'autre. Ces méthodes ne remplacent pas une contraception fiable si tu ne souhaites pas de grossesse.`,
  },
  {
    id: 'girl_fert_02',
    targetProfile: 'girl',
    category: 'fertilite',
    title: 'Les méthodes de contraception',
    order: 2,
    body: `Il existe de nombreuses méthodes contraceptives. Aucune n'est parfaite pour tout le monde.\n\n**Méthodes hormonales**\n• Pilule contraceptive (à prendre quotidiennement)\n• Patch (changé toutes les semaines)\n• Implant sous-cutané (efficace 3 ans)\n• Injection hormonale (toutes les 3 mois)\n• Stérilet hormonal (3 à 5 ans)\n\n**Méthodes non-hormonales**\n• Préservatif masculin (seul à protéger des IST)\n• Préservatif féminin\n• Stérilet en cuivre (jusqu'à 10 ans)\n• Diaphragme\n\n**Méthodes naturelles (moins fiables)**\n• Méthode du calendrier\n• Température basale\n• Symptothermie\n\n**Contraception d'urgence**\n• Pilule du lendemain (dans les 72h)\n• Stérilet en cuivre (dans les 5 jours)\n\nParle à un médecin ou à un professionnel de santé pour trouver la méthode adaptée à ta situation.`,
  },

  // ─── HYGIÈNE ──────────────────────────────────────────────────────────────
  {
    id: 'girl_hyg_01',
    targetProfile: 'girl',
    category: 'hygiene',
    title: 'Hygiène menstruelle : les essentiels',
    order: 1,
    body: `Une bonne hygiène pendant les règles prévient les infections et assure ton confort.\n\n**Les protections hygiéniques**\n• **Serviettes** : pratiques, sans insertion. À changer toutes les 3-4h.\n• **Tampons** : à changer toutes les 4-8h maximum (risque de choc toxique si trop longtemps).\n• **Coupe menstruelle** : réutilisable, économique, jusqu'à 12h. Nécessite un apprentissage.\n• **Culotte menstruelle** : lavable, confortable pour les nuits.\n• **Disque menstruel** : similaire à la coupe, différente forme.\n\n**Règles d'or :**\n• Se laver les mains avant et après manipulation\n• Changer régulièrement la protection\n• Ne jamais laisser un tampon plus de 8h\n• Nettoyer la vulve à l'eau tiède (pas de savon parfumé à l'intérieur)\n• Changer de sous-vêtements quotidiennement\n\n**À éviter :**\n• Douches vaginales (perturbent la flore)\n• Savons parfumés ou déodorants intimes\n• Porter les mêmes vêtements trop longtemps`,
  },
  {
    id: 'girl_hyg_02',
    targetProfile: 'girl',
    category: 'hygiene',
    title: 'Comprendre les pertes vaginales',
    order: 2,
    body: `Les pertes vaginales sont normales et font partie du fonctionnement naturel du vagin.\n\n**Pertes normales**\n• Transparentes à blanches\n• Pas ou peu d'odeur\n• Texture variable selon la phase du cycle (liquide avant l'ovulation, épaisse après)\n• Peuvent laisser une trace jaunâtre sur les sous-vêtements (oxydation normale)\n\n**Pertes qui nécessitent une consultation :**\n• Couleur verte, grise ou jaune intense\n• Odeur forte ou inhabituelle (poisson)\n• Texture fromagée (peut indiquer une candidose)\n• Accompagnées de démangeaisons, brûlures ou douleurs\n\n**Le rôle du vagin**\nLe vagin est auto-nettoyant grâce à son pH acide et à sa flore bactérienne (Lactobacilles). C'est pour cette raison qu'il ne faut jamais faire de douches internes.\n\nSi tu observes des changements inhabituels, n'hésite pas à consulter un professionnel de santé.`,
  },

  // ─── ÉMOTIONS ─────────────────────────────────────────────────────────────
  {
    id: 'girl_emo_01',
    targetProfile: 'girl',
    category: 'emotions',
    title: 'Hormones et émotions : le lien',
    order: 1,
    body: `Tes émotions sont directement influencées par tes hormones tout au long du cycle.\n\n**Semaine 1 (règles)**\nLa chute des hormones peut provoquer fatigue et mélancolie. C'est un moment pour se reposer et se chouchouter.\n\n**Semaine 2 (phase folliculaire)**\nL'œstrogène monte → énergie, optimisme, sociabilité. Idéal pour les projets, les rencontres, l'exercice.\n\n**Semaine 3 (ovulation)**\nPic d'œstrogènes et de testostérone → confiance en soi maximale, créativité. Profites-en !\n\n**Semaine 4 (phase lutéale)**\nLa progestérone monte puis chute → irritabilité, anxiété, sensibilité émotionnelle. Normal !\n\n**Ce qui aide à équilibrer :**\n• Bouger régulièrement (sport libère des endorphines)\n• Bien dormir\n• Limiter le sucre et la caféine\n• Parler de ce que tu ressens\n• Tenir un journal d'émotions\n\nConnaître ces cycles te permet de te préparer et d'être plus indulgente envers toi-même.`,
  },
  {
    id: 'girl_emo_02',
    targetProfile: 'girl',
    category: 'emotions',
    title: 'Image corporelle et confiance en soi',
    order: 2,
    body: `La relation avec son corps est un enjeu majeur à l'adolescence. Voici quelques repères.\n\n**Les changements à la puberté**\nPoitrine, hanches, pilosité, acné, changements de poids — tout cela est normal et fait partie du développement naturel du corps féminin.\n\n**L'influence des réseaux sociaux**\nLes images retouchées et filtrées créent des standards irréalistes. 90% des corps montrés sur les réseaux ne correspondent pas à la réalité.\n\n**Construire une image positive :**\n• Ce que ton corps FAIT (marche, danse, rit, respire) vaut plus que ce qu'il a l'air\n• Entoure-toi de personnes qui te valorisent\n• Parle de tes doutes à quelqu'un de confiance\n• Évite de te comparer\n\n**Si tu souffres vraiment de ton image corporelle**, parles-en à un adulte de confiance ou à un professionnel de santé. Les troubles alimentaires et la dysmorphophobie sont des problèmes sérieux qui se traitent.\n\nTon corps mérite respect et bienveillance — à commencer par toi-même.`,
  },
];

// Catégories avec métadonnées d'affichage
export const GIRL_CATEGORIES = [
  {
    key:         'cycle',
    label:       'Le Cycle',
    icon:        'moon',
    color:       '#EC4899',
    gradient:    ['#FDF2F8', '#FCE7F3'],
    description: 'Comprendre les phases, les douleurs et le SPM',
  },
  {
    key:         'fertilite',
    label:       'Fertilité',
    icon:        'leaf',
    color:       '#10B981',
    gradient:    ['#F0FDF4', '#DCFCE7'],
    description: 'Fenêtre fertile, ovulation, contraception',
  },
  {
    key:         'hygiene',
    label:       'Hygiène',
    icon:        'water',
    color:       '#3B82F6',
    gradient:    ['#EFF6FF', '#DBEAFE'],
    description: 'Protections, pertes vaginales, soins',
  },
  {
    key:         'emotions',
    label:       'Émotions',
    icon:        'heart',
    color:       '#8B5CF6',
    gradient:    ['#F5F3FF', '#EDE9FE'],
    description: 'Hormones, bien-être, image corporelle',
  },
];
