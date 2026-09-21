/**
 * Charts.js — Composants graphiques partagés LUNELA
 * Utilise react-native-svg (bundlé avec Expo).
 * Si manquant : npx expo install react-native-svg
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, {
  Path, Circle, Defs,
  LinearGradient as SvgGrad,
  Stop, G, Line,
  Text as SvgText,
} from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;

// ══════════════════════════════════════════════════════════════════════════════
// ── SmoothLineChart  — courbe de Bézier avec zone dégradée
// data = [{ value: number, label: string }]  ou  [number, ...]
// ══════════════════════════════════════════════════════════════════════════════
export function SmoothLineChart({
  data = [],
  color = '#FF6B35',
  height = 130,
  label,
  containerWidth,
}) {
  const W   = (containerWidth ?? SCREEN_W) - 48;
  const PAD = { top: 16, bottom: 28, left: 28, right: 12 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = height - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={ls.empty}>Pas assez de données</Text>
      </View>
    );
  }

  const values = data.map(d => (typeof d === 'object' ? d.value : d));
  const labels = data.map(d => (typeof d === 'object' ? d.label : ''));
  const max    = Math.max(...values);
  const min    = Math.min(...values);
  const range  = max - min || 1;

  const pts = values.map((v, i) => ({
    x: PAD.left + (i / (values.length - 1)) * cW,
    y: PAD.top  + cH - ((v - min) / range) * cH,
    v,
  }));

  // Courbes de Bézier cubiques
  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpX  = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C${cpX},${prev.y.toFixed(1)} ${cpX},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');

  const last     = pts[pts.length - 1];
  const bottom   = PAD.top + cH;
  const fillPath = `${linePath} L${last.x.toFixed(1)},${bottom} L${PAD.left},${bottom} Z`;
  const gradId   = `lg_${color.replace('#', '')}`;

  const gridLines = [0.25, 0.5, 0.75, 1].map(pct => ({
    y: PAD.top + cH * (1 - pct),
    v: Math.round(min + pct * range),
  }));

  return (
    <View>
      {label && <Text style={ls.title}>{label}</Text>}
      <Svg height={height} width={W}>
        <Defs>
          <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={color} stopOpacity="0.28" />
            <Stop offset="0.7" stopColor={color} stopOpacity="0.05" />
            <Stop offset="1"   stopColor={color} stopOpacity="0"    />
          </SvgGrad>
        </Defs>

        {/* Grille */}
        {gridLines.map((g, i) => (
          <G key={i}>
            <Line
              x1={PAD.left} y1={g.y}
              x2={PAD.left + cW} y2={g.y}
              stroke="#F3F4F6" strokeWidth="1"
            />
            <SvgText
              x={PAD.left - 4} y={g.y + 4}
              fontSize="8" fill="#9CA3AF" textAnchor="end"
            >
              {String(g.v)}
            </SvgText>
          </G>
        ))}

        {/* Zone dégradée */}
        <Path d={fillPath} fill={`url(#${gradId})`} />

        {/* Courbe */}
        <Path
          d={linePath}
          stroke={color}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {pts.map((p, i) => (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r="5"   fill={color} opacity="0.2" />
            <Circle cx={p.x} cy={p.y} r="3.5" fill={color} />
            <Circle cx={p.x} cy={p.y} r="2"   fill="#fff"  />
          </G>
        ))}
      </Svg>

      {/* Labels axe X */}
      {labels.some(l => l) && (
        <View style={[ls.xAxis, { width: W, paddingLeft: PAD.left, paddingRight: PAD.right }]}>
          {labels.map((l, i) => (
            <Text key={i} style={ls.xLabel}>{l}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  title:  { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  empty:  { color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' },
  xAxis:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  xLabel: { fontSize: 9, color: '#9CA3AF', flex: 1, textAlign: 'center' },
});

// ══════════════════════════════════════════════════════════════════════════════
// ── DonutRing  — anneau SVG multi-segments
// segments = [{ value, color, label }]
// ══════════════════════════════════════════════════════════════════════════════
export function DonutRing({
  segments  = [],
  size      = 110,
  thickness = 18,
  centerTitle,
  centerSub,
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r     = size / 2 - thickness / 2;
  const cx    = size / 2;
  const cy    = size / 2;
  const circ  = 2 * Math.PI * r;

  let cumulative = 0;
  const arcs = segments.map(seg => {
    const pct  = seg.value / total;
    const dash = pct * circ;
    const rot  = -90 + (cumulative / total) * 360;
    cumulative += seg.value;
    return { ...seg, dash, gap: circ - dash, rot };
  });

  return (
    <View style={ds.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Piste de fond */}
          <Circle cx={cx} cy={cy} r={r} stroke="#F3F4F6" strokeWidth={thickness} fill="none" />
          {/* Segments */}
          {arcs.map((arc, i) => (
            <Circle
              key={i}
              cx={cx} cy={cy} r={r}
              stroke={arc.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${arc.dash.toFixed(2)} ${arc.gap.toFixed(2)}`}
              strokeLinecap="butt"
              transform={`rotate(${arc.rot.toFixed(1)} ${cx} ${cy})`}
            />
          ))}
        </Svg>
        {(centerTitle != null || centerSub) && (
          <View style={[ds.center, { width: size, height: size }]}>
            {centerTitle != null && <Text style={ds.cTitle}>{centerTitle}</Text>}
            {centerSub   && <Text style={ds.cSub}>{centerSub}</Text>}
          </View>
        )}
      </View>

      {/* Légende */}
      <View style={ds.legend}>
        {segments.map((s, i) => (
          <View key={i} style={ds.row}>
            <View style={[ds.dot, { backgroundColor: s.color }]} />
            <View>
              <Text style={ds.lLabel}>{s.label}</Text>
              <Text style={[ds.lValue, { color: s.color }]}>
                {s.value}
                <Text style={ds.lPct}> ({Math.round((s.value / total) * 100)}%)</Text>
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const ds = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 20 },
  center: { position: 'absolute', top: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  cTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  cSub:   { fontSize: 10, color: '#6B7280', marginTop: 1 },
  legend: { flex: 1, gap: 10 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:    { width: 10, height: 10, borderRadius: 5 },
  lLabel: { fontSize: 12, color: '#6B7280' },
  lValue: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  lPct:   { fontSize: 11, fontWeight: '400', color: '#9CA3AF' },
});

// ══════════════════════════════════════════════════════════════════════════════
// ── AnimatedBarChart  — barres verticales animées en cascade
// data = [{ label, value, color }]
// ══════════════════════════════════════════════════════════════════════════════
function Bar({ value, max, color, label, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(anim, {
        toValue: max > 0 ? value / max : 0,
        tension: 55, friction: 8, useNativeDriver: false,
      }),
    ]).start();
  }, [value, max]);

  return (
    <View style={bs.col}>
      <Text style={bs.val}>{value}</Text>
      <View style={bs.track}>
        <Animated.View style={[
          bs.fill,
          {
            backgroundColor: color,
            height: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]} />
      </View>
      <Text style={bs.label} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function AnimatedBarChart({ data = [], height = 130 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={[bs.container, { height }]}>
      {data.map((item, i) => (
        <Bar
          key={`${item.label}_${i}`}
          value={item.value}
          max={max}
          color={item.color}
          label={item.label}
          delay={i * 80}
        />
      ))}
    </View>
  );
}

const bs = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col:       { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  val:       { fontSize: 11, fontWeight: '800', color: '#374151', marginBottom: 4 },
  track:     { width: '100%', flex: 1, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'flex-end', overflow: 'hidden' },
  fill:      { width: '100%', borderRadius: 8, minHeight: 4 },
  label:     { fontSize: 9, color: '#6B7280', marginTop: 5, textAlign: 'center', lineHeight: 12 },
});

// ══════════════════════════════════════════════════════════════════════════════
// ── HorizontalProgress  — barre de progression animée avec label
// ══════════════════════════════════════════════════════════════════════════════
export function HorizontalProgress({ label, value, total, color, icon }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct  = total > 0 ? value / total : 0;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: pct, tension: 40, friction: 8, useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={hp.wrap}>
      <View style={hp.labelRow}>
        <Text style={hp.label}>{icon ? `${icon}  ` : ''}{label}</Text>
        <Text style={[hp.count, { color }]}>
          {value}<Text style={hp.pct}>  ({Math.round(pct * 100)}%)</Text>
        </Text>
      </View>
      <View style={hp.track}>
        <Animated.View style={[
          hp.fill,
          { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]} />
      </View>
    </View>
  );
}

const hp = StyleSheet.create({
  wrap:     { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  label:    { fontSize: 13, color: '#374151', fontWeight: '600' },
  count:    { fontSize: 14, fontWeight: '800' },
  pct:      { fontSize: 11, fontWeight: '400', color: '#9CA3AF' },
  track:    { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 5 },
});

// ══════════════════════════════════════════════════════════════════════════════
// ── Sparkline  — mini courbe compacte (pour les cartes stat)
// ══════════════════════════════════════════════════════════════════════════════
export function Sparkline({ data = [], color = '#FF6B35', width = 80, height = 32 }) {
  if (data.length < 2) return <View style={{ width, height }} />;

  const max   = Math.max(...data);
  const min   = Math.min(...data);
  const range = max - min || 1;
  const pad   = 3;
  const cW    = width - pad * 2;
  const cH    = height - pad * 2;

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * cW,
    y: pad + cH - ((v - min) / range) * cH,
  }));

  const path = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpX  = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C${cpX},${prev.y.toFixed(1)} ${cpX},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }, '');

  const last     = pts[pts.length - 1];
  const fillPath = `${path} L${last.x},${pad + cH} L${pad},${pad + cH} Z`;
  const gradId   = `sp_${color.replace('#', '')}_${Math.floor(width)}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0"   />
        </SvgGrad>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={path} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </Svg>
  );
}
