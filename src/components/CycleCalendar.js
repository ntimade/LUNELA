import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Clé de date au format YYYY-MM-DD en heure LOCALE (pas toISOString(), qui
// convertit en UTC et peut faire basculer la date d'un jour dans les fuseaux
// horaires en avance sur UTC — ex: minuit local le 21 juillet devient 20
// juillet en UTC).
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcule les jours colorés d'un cycle donné.
 * @param {object} cycle  { startDate: 'YYYY-MM-DD', periodLength, cycleLength }
 * @param {number} avgPeriod  durée moyenne des règles
 * @param {number} avgCycle   durée moyenne du cycle
 */
function buildDayMap(cycles, avgPeriod = 5, avgCycle = 28) {
  const map = {};
  const withDates = cycles.filter((c) => c.startDate);
  if (!withDates.length) return map;

  // Du plus ancien au plus récent, pour connaître l'écart réel jusqu'au cycle
  // suivant réellement enregistré : sans ça, chaque cycle projette une fenêtre
  // de `avgCycle` jours pleine, qui peut chevaucher les règles réelles du
  // cycle suivant dès que l'écart réel est plus court que la moyenne (cycles
  // irréguliers, très fréquents en pratique).
  const sorted = [...withDates].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  sorted.forEach((cycle, idx) => {
    // 'T00:00:00' force un parsing en heure LOCALE — un 'YYYY-MM-DD' seul
    // est interprété comme minuit UTC par la spec JS, ce qui décale le jour
    // affiché dans les fuseaux horaires en avance sur UTC.
    const start  = new Date(cycle.startDate + 'T00:00:00');
    const period = cycle.periodLength || avgPeriod;
    const nominalLength = cycle.cycleLength || avgCycle;
    const ovulDay    = Math.round(nominalLength - 14);
    const fertileStart = ovulDay - 5;
    const fertileEnd   = ovulDay + 1;

    // Le dernier cycle (le plus récent) n'a pas de "suivant" réel : il projette
    // sa durée nominale complète (fenêtre fertile / ovulation à venir). Pour
    // tous les autres, on tronque au jour où le cycle suivant a réellement
    // commencé, pour ne jamais chevaucher ses propres règles.
    const next = sorted[idx + 1];
    let length = nominalLength;
    if (next) {
      const nextStart = new Date(next.startDate + 'T00:00:00');
      const gap = Math.round((nextStart - start) / (1000 * 60 * 60 * 24));
      if (gap > 0) length = Math.min(length, gap);
    }

    for (let i = 0; i < length; i++) {
      const d   = addDays(start, i);
      const key = toKey(d);
      if (i < period) {
        map[key] = 'period';
      } else if (i === ovulDay) {
        map[key] = 'ovulation';
      } else if (i >= fertileStart && i <= fertileEnd) {
        map[key] = map[key] === 'period' ? 'period' : 'fertile';
      } else if (!map[key]) {
        map[key] = 'normal';
      }
    }
  });

  return map;
}

// Prédit le prochain cycle
function buildPrediction(cycles, avgPeriod, avgCycle) {
  if (!cycles.length) return {};
  const sorted = [...cycles].sort((a, b) => a.startDate > b.startDate ? -1 : 1);
  const last   = sorted[0];
  if (!last.startDate) return {};

  const nextStart = addDays(new Date(last.startDate + 'T00:00:00'), avgCycle);
  const fakeCycle = { startDate: toKey(nextStart), periodLength: avgPeriod, cycleLength: avgCycle };
  return buildDayMap([fakeCycle], avgPeriod, avgCycle);
}

function buildDayColors(colors, role, semantic) {
  return {
    period:    { bg: role.girl, text: '#fff', label: 'Règles' },
    fertile:   { bg: '#FDE68A', text: '#92400E', label: 'Fertile' },
    ovulation: { bg: semantic.success, text: '#fff', label: 'Ovulation' },
    predicted: { bg: role.girl + '44', text: role.girl, label: 'Prévu' },
    normal:    { bg: 'transparent', text: colors.text, label: '' },
  };
}

export default function CycleCalendar({ cycles = [], onDayPress, settings }) {
  const { colors, role, semantic, radius, spacing } = useTheme();
  const styles = makeStyles(colors, radius, spacing);
  const DAY_COLORS = useMemo(() => buildDayColors(colors, role, semantic), [colors, role, semantic]);

  const today = new Date();

  const [viewDate, setViewDate] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1));

  // Les cycles enregistrés ne stockent pas leur propre durée : on se base sur les
  // réglages réels de l'utilisatrice (mêmes valeurs que les indicateurs affichés
  // sous le calendrier), avec un repli sur les valeurs par défaut si absents.
  const avgCycle  = settings?.cycleLength  ?? 28;
  const avgPeriod = settings?.periodLength ?? 5;

  const dayMap = useMemo(() => buildDayMap(cycles, avgPeriod, avgCycle), [cycles, avgPeriod, avgCycle]);

  const prediction = useMemo(() => {
    const pred = buildPrediction(cycles, avgPeriod, avgCycle);
    const result = {};
    Object.keys(pred).forEach(k => {
      if (!dayMap[k] || dayMap[k] === 'normal') result[k] = 'predicted';
    });
    return result;
  }, [cycles, dayMap, avgPeriod, avgCycle]);

  const merged = useMemo(() => ({ ...prediction, ...dayMap }), [dayMap, prediction]);

  // Construire les jours du mois affiché
  const days = useMemo(() => {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);

    // Décalage : lundi = 0
    let offset = first.getDay() - 1;
    if (offset < 0) offset = 6;

    const result = [];
    for (let i = 0; i < offset; i++) result.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      result.push(new Date(year, month, d));
    }
    return result;
  }, [viewDate]);

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const todayKey = toKey(today);

  return (
    <View style={styles.container}>
      {/* ── En-tête navigation ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {MONTHS_FR[viewDate.getMonth()]} {viewDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Jours de la semaine ── */}
      <View style={styles.weekRow}>
        {DAYS_FR.map((d, i) => (
          <Text key={i} style={styles.weekDay}>{d}</Text>
        ))}
      </View>

      {/* ── Grille ── */}
      <View style={styles.grid}>
        {days.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;
          const key    = toKey(date);
          const type   = merged[key] || 'normal';
          const dayColor = DAY_COLORS[type] || DAY_COLORS.normal;
          const isToday = key === todayKey;

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.cell,
                { backgroundColor: dayColor.bg },
                isToday && styles.todayCell,
              ]}
              onPress={() => onDayPress && onDayPress({ date, type })}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.dayText,
                { color: dayColor.text },
                isToday && styles.todayText,
              ]}>
                {date.getDate()}
              </Text>
              {type === 'ovulation' && (
                <View style={styles.ovulDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Légende ── */}
      <View style={styles.legend}>
        {[
          { type: 'period',    label: 'Règles' },
          { type: 'fertile',   label: 'Fertile' },
          { type: 'ovulation', label: 'Ovulation' },
          { type: 'predicted', label: 'Prévu' },
        ].map(({ type, label }) => (
          <View key={type} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DAY_COLORS[type].bg.replace('44', '') }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors, radius, spacing) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  navArrow:   { fontSize: 22, color: colors.primary, fontWeight: '700', lineHeight: 26 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: colors.text },

  // Semaine
  weekRow:  { flexDirection: 'row', marginBottom: 6 },
  weekDay:  { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textSecondary, paddingVertical: 4 },

  // Grille
  grid:     { flexDirection: 'row', flexWrap: 'wrap' },
  cell:     {
    width:  `${100/7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    padding: 2,
  },
  dayText:   { fontSize: 13, fontWeight: '600', color: colors.text },
  todayCell: { borderWidth: 2, borderColor: colors.primary },
  todayText: { fontWeight: '900' },
  ovulDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', marginTop: 1 },

  // Légende
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, marginTop: spacing.md + 2, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
});
