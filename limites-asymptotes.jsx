import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Sparkles, LineChart, Layers, Sigma, SlidersHorizontal, Target,
  CheckCircle2, XCircle, Lock, Sun, Moon, Shuffle, Eye, EyeOff, Download,
  Trash2, RotateCcw, Menu, X, ChevronRight, Printer, HelpCircle,
  GraduationCap, Projector, ArrowRight
} from "lucide-react";

/* =========================================================================
   OUTILS MATHÉMATIQUES
   ========================================================================= */

const clean = (n) => (Object.is(n, -0) ? 0 : n);
const round2 = (n) => clean(Math.round(n * 100) / 100);
const fmtNum = (n) => String(round2(n));

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randNonZero(min, max) { let v = 0; while (v === 0) v = randInt(min, max); return v; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let uidCounter = 0;
const nid = () => `q${uidCounter++}_${Math.random().toString(36).slice(2, 7)}`;

function linStr(a, b) {
  const terms = [];
  if (a !== 0) {
    const mag = Math.abs(a) === 1 ? "" : fmtNum(Math.abs(a));
    terms.push(`${a < 0 ? "−" : ""}${mag}x`);
  }
  if (b !== 0 || terms.length === 0) {
    const sign = terms.length ? (b < 0 ? " − " : " + ") : (b < 0 ? "−" : "");
    terms.push(`${sign}${fmtNum(Math.abs(b))}`);
  }
  return terms.join("");
}

function quadStr(a, b, c) {
  const terms = [];
  if (a !== 0) {
    const mag = Math.abs(a) === 1 ? "" : fmtNum(Math.abs(a));
    terms.push(`${a < 0 ? "−" : ""}${mag}x²`);
  }
  if (b !== 0) {
    const sign = terms.length ? (b < 0 ? " − " : " + ") : (b < 0 ? "−" : "");
    const mag = Math.abs(b) === 1 ? "x" : `${fmtNum(Math.abs(b))}x`;
    terms.push(`${sign}${mag}`);
  }
  if (c !== 0 || terms.length === 0) {
    const sign = terms.length ? (c < 0 ? " − " : " + ") : (c < 0 ? "−" : "");
    terms.push(`${sign}${fmtNum(Math.abs(c))}`);
  }
  return terms.join("");
}

function ratStr(a, b, c, d) { return `(${linStr(a, b)}) / (${linStr(c, d)})`; }

// Calcul exact (sans arrondi intermédiaire) des asymptotes d'une fonction
// rationnelle linéaire/linéaire f(x) = (ax+b)/(cx+d), avec c ≠ 0.
function computeRationalLinear(a, b, c, d) {
  const degenerate = a * d - b * c === 0; // fraction simplifiable : pas d'asymptote verticale (trou)
  const x0 = -d / c;
  const y0 = a / c;
  return { degenerate, x0, y0 };
}

// Comportement au voisinage de l'asymptote verticale, déterminé par
// évaluation numérique directe (robuste, sans risque d'erreur de signe).
function verticalBehavior(a, b, c, d, x0) {
  const eps = 1e-4;
  const fLeft = (a * (x0 - eps) + b) / (c * (x0 - eps) + d);
  const fRight = (a * (x0 + eps) + b) / (c * (x0 + eps) + d);
  return { left: fLeft > 0 ? "+∞" : "−∞", right: fRight > 0 ? "+∞" : "−∞" };
}

function buildOptions(correctLabelOrObj, distractors) {
  // Filtre toute réponse en double (même texte affiché) pour ne jamais
  // présenter deux fois la même solution parmi les choix.
  const keyOf = (d) => (typeof d === "string" ? d : JSON.stringify(d));
  const seen = new Set([keyOf(correctLabelOrObj)]);
  const uniqueDistractors = [];
  for (const d of distractors) {
    const key = keyOf(d);
    if (!seen.has(key)) { seen.add(key); uniqueDistractors.push(d); }
  }
  const list = shuffle([
    { data: correctLabelOrObj, correct: true },
    ...uniqueDistractors.map((d) => ({ data: d, correct: false })),
  ]);
  const options = list.map((o) => {
    const base = { id: "o" + nid() };
    if (typeof o.data === "string") base.label = o.data;
    else base.graph = o.data;
    return base;
  });
  const correctId = options[list.findIndex((o) => o.correct)].id;
  return { options, correctId };
}

function normAnswer(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s/g, "").replace(",", ";").replace(/−/g, "-");
}

/* =========================================================================
   GRAPHIQUE SVG — FONCTION RATIONNELLE AVEC ASYMPTOTES
   ========================================================================= */

function niceStep(range, targetCount) {
  const rough = Math.max(range / targetCount, 1e-6);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

function RationalGraph({ a, b, c, d, width = 420, height = 300, dark = false, small = false, showLabels = true }) {
  const sys = computeRationalLinear(a, b, c, d);
  const { x0, y0, degenerate } = sys;

  const xMin = x0 - 6, xMax = x0 + 6;
  const yMin = y0 - 8, yMax = y0 + 8;

  const margin = small ? 22 : 38;
  const plotW = width - margin * 2;
  const plotH = height - margin * 2;
  const px = (x) => margin + ((x - xMin) / (xMax - xMin)) * plotW;
  const py = (y) => margin + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
  const clampY = (y) => Math.max(Math.min(y, yMax + 20), yMin - 20);
  const f = (x) => (a * x + b) / (c * x + d);

  const xStep = niceStep(xMax - xMin, small ? 6 : 10);
  const yStep = niceStep(yMax - yMin, small ? 5 : 8);
  const gridColor = dark ? "#22304f" : "#E3E9F5";
  const axisColor = dark ? "#8C9BC0" : "#1B2A4A";
  const curveColor = dark ? "#7FB2FF" : "#3E6FD9";
  const asympColor = "#C46A1B";
  const textColor = dark ? "#B7C3DE" : "#3A4664";

  const xTicks = [];
  for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax; v += xStep) xTicks.push(round2(Math.abs(v) < 1e-9 ? 0 : v));
  const yTicks = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) yTicks.push(round2(Math.abs(v) < 1e-9 ? 0 : v));

  const clipId = "clip" + Math.round(Math.random() * 1e8);

  let leftPath = "", rightPath = "";
  if (!degenerate) {
    const N = 100;
    const gap = 0.02 * (xMax - xMin);
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((x0 - gap - xMin) * i) / N;
      const y = clampY(f(x));
      leftPath += (i === 0 ? "M" : "L") + px(x).toFixed(1) + " " + py(y).toFixed(1) + " ";
    }
    for (let i = 0; i <= N; i++) {
      const x = x0 + gap + ((xMax - (x0 + gap)) * i) / N;
      const y = clampY(f(x));
      rightPath += (i === 0 ? "M" : "L") + px(x).toFixed(1) + " " + py(y).toFixed(1) + " ";
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, display: "block" }} role="img" aria-label="Graphique d'une fonction rationnelle avec ses asymptotes">
      <defs><clipPath id={clipId}><rect x={margin} y={margin} width={plotW} height={plotH} /></clipPath></defs>
      {xTicks.map((v, i) => (<line key={"gx" + i} x1={px(v)} x2={px(v)} y1={margin} y2={margin + plotH} stroke={gridColor} strokeWidth={1} />))}
      {yTicks.map((v, i) => (<line key={"gy" + i} x1={margin} x2={margin + plotW} y1={py(v)} y2={py(v)} stroke={gridColor} strokeWidth={1} />))}
      {yMin <= 0 && yMax >= 0 && (<line x1={margin} x2={margin + plotW} y1={py(0)} y2={py(0)} stroke={axisColor} strokeWidth={1.5} />)}
      {xMin <= 0 && xMax >= 0 && (<line x1={px(0)} x2={px(0)} y1={margin} y2={margin + plotH} stroke={axisColor} strokeWidth={1.5} />)}
      {!small && xTicks.filter((v) => v !== 0).map((v, i) => (<text key={"xl" + i} x={px(v)} y={(yMin <= 0 && yMax >= 0 ? py(0) : margin + plotH) + 14} fontSize="10" textAnchor="middle" fill={textColor}>{fmtNum(v)}</text>))}
      {!small && yTicks.filter((v) => v !== 0).map((v, i) => (<text key={"yl" + i} x={(xMin <= 0 && xMax >= 0 ? px(0) : margin) - 6} y={py(v) + 3} fontSize="10" textAnchor="end" fill={textColor}>{fmtNum(v)}</text>))}
      {!degenerate && (<line x1={px(x0)} x2={px(x0)} y1={margin} y2={margin + plotH} stroke={asympColor} strokeDasharray="4 3" strokeWidth={1.3} />)}
      <line x1={margin} x2={margin + plotW} y1={py(y0)} y2={py(y0)} stroke={asympColor} strokeDasharray="4 3" strokeWidth={1.3} />
      {!degenerate ? (
        <g clipPath={`url(#${clipId})`}>
          <path d={leftPath} fill="none" stroke={curveColor} strokeWidth={small ? 2 : 2.5} />
          <path d={rightPath} fill="none" stroke={curveColor} strokeWidth={small ? 2 : 2.5} />
        </g>
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <line x1={margin} x2={margin + plotW} y1={py(y0)} y2={py(y0)} stroke={curveColor} strokeWidth={small ? 2 : 2.5} />
          <circle cx={px(x0)} cy={py(y0)} r={4} fill={dark ? "#101B33" : "white"} stroke={curveColor} strokeWidth={2} />
        </g>
      )}
      {showLabels && !small && !degenerate && (
        <text x={Math.min(px(x0) + 6, width - 60)} y={margin + 12} fontSize="10" fill={asympColor} fontWeight="600">x = {fmtNum(x0)}</text>
      )}
      {showLabels && !small && (
        <text x={margin + 4} y={py(y0) - 6} fontSize="10" fill={asympColor} fontWeight="600">y = {fmtNum(y0)}</text>
      )}
    </svg>
  );
}

/* =========================================================================
   BANQUE D'EXERCICES GÉNÉRÉS (Quiz, fiche imprimable, mode professeur)
   ========================================================================= */

function genLimitePoint() {
  const x0 = randInt(-4, 4);
  const A = randInt(-3, 3), B = randInt(-5, 5), C = randInt(-5, 5);
  const value = A * x0 * x0 + B * x0 + C;
  const correct = `${fmtNum(value)}`;
  const distractors = [`${fmtNum(value + 2)}`, `${fmtNum(value - 3)}`, `${fmtNum(-value)}`];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Limite (substitution)",
    prompt: `Calcule : lim(x→${fmtNum(x0)}) [ ${quadStr(A, B, C)} ]`,
    options, correctId,
    explanation: `Cette fonction est un polynôme, donc continue partout : on calcule la limite par simple substitution. On remplace x par ${fmtNum(x0)} : ${quadStr(A, B, C)} = ${fmtNum(value)}.`,
  };
}

function genFormeIndeterminee() {
  const r = randInt(-4, 4);
  let s;
  do { s = randInt(-4, 4); } while (s === r);
  const bcoef = -(r + s), c = r * s;
  const correct = `${fmtNum(r - s)}`;
  const distractors = [`${fmtNum(s - r)}`, `${fmtNum(r + s)}`, `0`];
  const { options, correctId } = buildOptions(correct, distractors);
  const denom = r < 0 ? `x + ${fmtNum(-r)}` : `x − ${fmtNum(r)}`;
  return {
    id: nid(), category: "Forme indéterminée",
    prompt: `Calcule : lim(x→${fmtNum(r)}) [ (${quadStr(1, bcoef, c)}) / (${denom}) ]`,
    options, correctId,
    explanation: `En substituant x = ${fmtNum(r)}, on obtient 0/0 (forme indéterminée). On factorise le numérateur : ${quadStr(1, bcoef, c)} = (x − ${fmtNum(r)})(x − ${fmtNum(s)}). Après simplification par (x − ${fmtNum(r)}), il reste (x − ${fmtNum(s)}), dont la limite en ${fmtNum(r)} vaut ${fmtNum(r - s)}.`,
  };
}

function genLimiteInfini() {
  const A = randNonZero(-5, 5), B = randNonZero(1, 5);
  const bx = randInt(-6, 6), cx = randInt(-6, 6);
  const dx = randInt(-6, 6), ex = randInt(-6, 6);
  const correct = fmtNum(A / B);
  const distractors = [fmtNum(-A / B), fmtNum(B / A), "0"];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Limite à l'infini",
    prompt: `Calcule : lim(x→+∞) [ (${quadStr(A, bx, cx)}) / (${quadStr(B, dx, ex)}) ]`,
    options, correctId,
    explanation: `On divise numérateur et dénominateur par x² (la plus haute puissance) : tous les termes en 1/x et 1/x² tendent vers 0. Il reste le rapport des coefficients dominants : ${fmtNum(A)} / ${fmtNum(B)} = ${correct}.`,
  };
}

function genAsymptoteVerticale() {
  const x0 = randInt(-5, 5);
  const y0 = randInt(-4, 4);
  const c = 1, a = y0, d = -x0;
  let b;
  do { b = randInt(-6, 6); } while (a * d - b * c === 0);
  const correct = `x = ${fmtNum(x0)}`;
  const distractors = [`x = ${fmtNum(-x0)}`, `y = ${fmtNum(x0)}`, `x = ${fmtNum(x0 + 2)}`];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Asymptote verticale",
    prompt: `Quelle est l'équation de l'asymptote verticale de f(x) = ${ratStr(a, b, c, d)} ?`,
    graph: { a, b, c, d }, options, correctId,
    explanation: `L'asymptote verticale se trouve là où le dénominateur s'annule (et pas le numérateur) : ${linStr(c, d)} = 0  →  x = ${fmtNum(x0)}.`,
  };
}

function genAsymptoteHorizontale() {
  const x0 = randInt(-5, 5);
  const y0 = randInt(-4, 4);
  const c = 1, a = y0, d = -x0;
  let b;
  do { b = randInt(-6, 6); } while (a * d - b * c === 0);
  const correct = `y = ${fmtNum(y0)}`;
  const distractors = [`y = ${fmtNum(-y0)}`, `x = ${fmtNum(y0)}`, `y = ${fmtNum(y0 + 3)}`];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Asymptote horizontale",
    prompt: `Quelle est l'équation de l'asymptote horizontale de f(x) = ${ratStr(a, b, c, d)} ?`,
    graph: { a, b, c, d }, options, correctId,
    explanation: `Le numérateur et le dénominateur ont le même degré (1) : la limite en ±∞ est le rapport des coefficients de x, soit ${fmtNum(a)} / ${fmtNum(c)} = ${fmtNum(y0)}.`,
  };
}

function genLecture() {
  const x0 = randInt(-4, 4);
  const y0 = randInt(-3, 3);
  const c = 1, a = y0, d = -x0;
  let b;
  do { b = randInt(-5, 5); } while (a * d - b * c === 0);
  const correct = `x = ${fmtNum(x0)} et y = ${fmtNum(y0)}`;
  const distractors = [`x = ${fmtNum(y0)} et y = ${fmtNum(x0)}`, `x = ${fmtNum(-x0)} et y = ${fmtNum(y0)}`, `x = ${fmtNum(x0)} et y = ${fmtNum(-y0)}`];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Lecture graphique",
    prompt: `Observe le graphique. Quelles sont les équations des deux asymptotes ?`,
    graph: { a, b, c, d }, options, correctId,
    explanation: `L'asymptote verticale (en pointillés) est la droite que la courbe ne touche jamais horizontalement : x = ${fmtNum(x0)}. L'asymptote horizontale est la valeur vers laquelle la courbe se stabilise loin de l'origine : y = ${fmtNum(y0)}.`,
  };
}

function genInterpretation() {
  const K1 = randInt(100, 900);
  const K2 = randNonZero(2, 20);
  const correct = `${fmtNum(K2)} €`;
  const distractors = [`${fmtNum(K1)} €`, `${fmtNum(K1 + K2)} €`, `0 €`];
  const { options, correctId } = buildOptions(correct, distractors);
  return {
    id: nid(), category: "Interprétation concrète",
    prompt: `Le coût moyen de production de x objets est C(x) = (${K1} + ${K2}x) / x, en euros. Que devient ce coût moyen quand la production x devient très grande ?`,
    options, correctId,
    explanation: `On divise chaque terme par x : C(x) = ${K1}/x + ${K2}. Quand x → +∞, ${K1}/x → 0, donc C(x) → ${K2}. L'asymptote horizontale y = ${K2} représente le coût auquel le coût moyen se rapproche, sans jamais l'atteindre.`,
  };
}

const GENERATORS = [genLimitePoint, genFormeIndeterminee, genLimiteInfini, genAsymptoteVerticale, genAsymptoteHorizontale, genLecture, genInterpretation];

function buildQuiz(n = 15) {
  const qs = [];
  for (let i = 0; i < n; i++) qs.push(GENERATORS[i % GENERATORS.length]());
  return shuffle(qs);
}

/* =========================================================================
   PETITS COMPOSANTS D'INTERFACE RÉUTILISABLES
   ========================================================================= */

function Btn({ children, onClick, variant = "primary", className = "", ...rest }) {
  const base = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
  const styles = { primary: "text-white shadow-sm hover:opacity-90", secondary: "border hover:bg-black/5", ghost: "hover:bg-black/5" };
  const style = variant === "primary" ? { backgroundColor: "#1B2A4A" } : undefined;
  return (
    <button onClick={onClick} className={`${base} ${styles[variant] || styles.primary} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}

function Card({ theme, title, children, className = "", icon: Icon }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border ${theme.border} ${theme.surface} ${className}`}>
      {title && (
        <h3 className="font-serif text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
          {Icon && <Icon size={18} className="shrink-0" style={{ color: "#3E6FD9" }} />}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function MathLine({ children, size = "text-lg" }) { return <p className={`font-serif italic ${size}`}>{children}</p>; }

function SliderRow({ label, value, min, max, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-serif italic text-base">{label}</span>
        <span className="font-semibold tabular-nums">{fmtNum(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#3E6FD9]" aria-label={`Curseur pour la valeur de ${label}`} />
    </div>
  );
}

function ProgressGauge({ value, theme }) {
  return (
    <div className={`h-2 rounded-full overflow-hidden ${theme.surfaceAlt}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: "#F2A24C" }} />
    </div>
  );
}

/* =========================================================================
   ACCUEIL
   ========================================================================= */

function HomePage({ theme, dark, onStart, progress }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-sm font-medium tracking-wide" style={{ color: "#3E6FD9" }}>5e secondaire · limites et asymptotes</p>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold mt-2 leading-tight">Limites et asymptotes</h1>
          <p className="text-lg mt-3" style={{ color: dark ? "#B7C3DE" : "#3A4664" }}>
            Calculer des limites et déterminer les asymptotes, algébriquement et graphiquement
          </p>
          <p className={`mt-4 text-sm leading-relaxed ${theme.muted}`}>
            Tu vas apprendre à calculer une limite par substitution, lever une forme indéterminée, calculer une limite à l'infini,
            et déterminer les équations des asymptotes verticales, horizontales et obliques d'une fonction.
          </p>
          <Btn onClick={onStart} className="mt-6" variant="primary">Commencer l'activité <ArrowRight size={16} /></Btn>
        </div>
        <div className={`rounded-2xl p-4 border ${theme.border} ${theme.surface}`}>
          <RationalGraph a={1} b={1} c={1} d={-2} dark={dark} width={360} height={280} />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Ta progression</p>
          <p className="text-sm tabular-nums">{Math.round(progress)}%</p>
        </div>
        <ProgressGauge value={progress} theme={theme} />
      </div>

      <Card theme={theme} title="À la fin, je serai capable de…" className="mt-8">
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            "calculer une limite par substitution directe,",
            "lever une forme indéterminée 0/0 par factorisation,",
            "calculer une limite à l'infini d'une fonction rationnelle,",
            "identifier et calculer une asymptote verticale,",
            "identifier et calculer une asymptote horizontale ou oblique,",
            "interpréter une asymptote dans un contexte concret.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#1F7A3D" }} /><span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* =========================================================================
   MODULE 1 — EXPLORER UNE FONCTION RATIONNELLE
   ========================================================================= */

const CHALLENGES_M1 = [
  { text: "Crée une fonction dont l'asymptote verticale est x = 3.", check: (s) => !s.degenerate && Math.abs(s.x0 - 3) < 0.01 },
  { text: "Crée une fonction dont l'asymptote horizontale est y = 2.", check: (s) => Math.abs(s.y0 - 2) < 0.01 },
  { text: "Crée une fonction dont l'asymptote horizontale est négative.", check: (s) => s.y0 < 0 },
  { text: "Crée une fonction dont l'asymptote verticale est à l'abscisse négative.", check: (s) => !s.degenerate && s.x0 < 0 },
];

function Module1({ dark, theme, onProgress }) {
  const [a, setA] = useState(1), [b, setB] = useState(1), [c, setC] = useState(1), [d, setD] = useState(-2);
  const [challenge, setChallenge] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [solved, setSolved] = useState(new Set());

  const sys = computeRationalLinear(a, b, c, d);
  const vb = !sys.degenerate ? verticalBehavior(a, b, c, d, sys.x0) : null;

  useEffect(() => { onProgress && onProgress(Math.min(100, solved.size * 25)); }, [solved]);

  const newChallenge = () => { setChallenge(randInt(0, CHALLENGES_M1.length - 1)); setFeedback(null); };
  const verify = () => {
    if (challenge === null) return;
    const ok = CHALLENGES_M1[challenge].check(sys);
    setFeedback(ok);
    if (ok) setSolved((s) => new Set(s).add(challenge));
  };
  const reset = () => { setA(1); setB(1); setC(1); setD(-2); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className={`rounded-2xl p-4 sm:p-5 border ${theme.border} ${theme.surface}`}>
        <RationalGraph a={a} b={b} c={c} d={d} dark={dark} width={460} height={340} />
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <SliderRow label="a" value={a} min={-6} max={6} onChange={setA} />
          <SliderRow label="b" value={b} min={-8} max={8} onChange={setB} />
          <SliderRow label="c" value={c} min={-6} max={6} onChange={(v) => setC(v === 0 ? (c < 0 ? -1 : 1) : v)} />
          <SliderRow label="d" value={d} min={-8} max={8} onChange={setD} />
        </div>
        <div className="flex gap-3 mt-5 flex-wrap">
          <Btn variant="secondary" onClick={reset} className={theme.border}><RotateCcw size={15} /> Réinitialiser</Btn>
          <Btn onClick={newChallenge}><Sparkles size={15} /> Nouveau défi</Btn>
        </div>
        {challenge !== null && (
          <div className="rounded-xl p-4 mt-4 border-l-4" style={{ borderColor: "#C46A1B", background: dark ? "#2A2210" : "#FFF6EA" }}>
            <p className="font-medium text-sm">{CHALLENGES_M1[challenge].text}</p>
            <Btn onClick={verify} className="mt-3">Vérifier mon défi</Btn>
            {feedback === true && <p className="mt-2 font-medium text-sm" style={{ color: "#1F7A3D" }}>Bravo, défi réussi !</p>}
            {feedback === false && <p className="mt-2 text-sm" style={{ color: "#AA0000" }}>Essaie encore : observe où se trouve l'asymptote verticale et à quelle hauteur se stabilise la courbe.</p>}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card theme={theme} title="Expression">
          <MathLine>f(x) = {ratStr(a, b, c, d)}</MathLine>
        </Card>
        <Card theme={theme} title="Domaine de définition">
          <p className="text-sm">{sys.degenerate ? "ℝ (la fraction se simplifie, il reste un point à exclure)" : `ℝ \\ {${fmtNum(sys.x0)}}`}</p>
        </Card>
        {sys.degenerate ? (
          <Card theme={theme} title="Point particulier">
            <p className="text-sm">Ici, le numérateur et le dénominateur sont proportionnels : la fraction se simplifie en une constante, avec un trou en x = {fmtNum(sys.x0)}. Il n'y a pas d'asymptote verticale.</p>
          </Card>
        ) : (
          <Card theme={theme} title="Asymptote verticale">
            <p className="text-sm font-medium">x = {fmtNum(sys.x0)}</p>
            <p className="text-sm mt-1">lim(x→{fmtNum(sys.x0)}⁻) f(x) = {vb.left}</p>
            <p className="text-sm">lim(x→{fmtNum(sys.x0)}⁺) f(x) = {vb.right}</p>
          </Card>
        )}
        <Card theme={theme} title="Asymptote horizontale">
          <p className="text-sm font-medium">y = {fmtNum(sys.y0)}</p>
          <p className="text-sm mt-1">lim(x→−∞) f(x) = {fmtNum(sys.y0)}  et  lim(x→+∞) f(x) = {fmtNum(sys.y0)}</p>
        </Card>
      </div>
    </div>
  );
}

/* =========================================================================
   MODULE 2 — LIRE UN GRAPHIQUE
   ========================================================================= */

function makeSeed() {
  const x0 = randInt(-4, 4);
  const y0 = randInt(-3, 3);
  const c = 1, a = y0, d = -x0;
  let b;
  do { b = randInt(-5, 5); } while (a * d - b * c === 0);
  return { a, b, c, d, x0, y0 };
}

function Module2({ dark, theme, onProgress }) {
  const [seed, setSeed] = useState(makeSeed);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showCorrection, setShowCorrection] = useState(false);
  const [hints, setHints] = useState({});
  const vb = verticalBehavior(seed.a, seed.b, seed.c, seed.d, seed.x0);

  const questions = [
    { id: "va", label: "Équation de l'asymptote verticale", correct: `x=${fmtNum(seed.x0)}`, hint: "C'est la droite verticale que la courbe ne touche jamais, là où le dénominateur s'annule.", norm: normAnswer },
    { id: "ha", label: "Équation de l'asymptote horizontale", correct: `y=${fmtNum(seed.y0)}`, hint: "C'est la valeur vers laquelle la courbe se stabilise loin de l'origine.", norm: normAnswer },
    { id: "lg", label: "lim(x→−∞) f(x)", correct: `${fmtNum(seed.y0)}`, hint: "Regarde la branche de gauche : vers quelle hauteur se dirige-t-elle ?", norm: normAnswer },
    { id: "ld", label: "lim(x→+∞) f(x)", correct: `${fmtNum(seed.y0)}`, hint: "Regarde la branche de droite.", norm: normAnswer },
    { id: "dom", label: "Domaine de définition (ex : R\\{2})", correct: `r\\{${fmtNum(seed.x0)}}`, hint: "Il faut exclure la valeur où le dénominateur s'annule.", norm: (s) => normAnswer(s).replace(/ℝ/g, "r") },
  ];

  const check = () => {
    setChecked(true);
    setAttempts((a) => a + 1);
    const allOk = questions.every((qq) => qq.norm(answers[qq.id] || "") === qq.norm(qq.correct));
    if (allOk) onProgress && onProgress(100);
  };

  const newGraph = () => { setSeed(makeSeed()); setAnswers({}); setChecked(false); setAttempts(0); setShowCorrection(false); setHints({}); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className={`rounded-2xl p-4 sm:p-5 border ${theme.border} ${theme.surface}`}>
        <RationalGraph a={seed.a} b={seed.b} c={seed.c} d={seed.d} dark={dark} width={460} height={340} />
        <Btn variant="secondary" onClick={newGraph} className={`mt-3 ${theme.border}`}><Shuffle size={15} /> Nouveau graphique</Btn>
      </div>
      <div className="space-y-3">
        {questions.map((qq) => {
          const ok = checked && qq.norm(answers[qq.id] || "") === qq.norm(qq.correct);
          const bad = checked && !ok;
          return (
            <div key={qq.id} className={`rounded-xl p-3 border ${theme.border} ${theme.surface}`}>
              <label className="text-sm font-medium block mb-1.5" htmlFor={qq.id}>{qq.label}</label>
              <div className="flex gap-2 items-center">
                <input id={qq.id} aria-label={qq.label} value={answers[qq.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [qq.id]: e.target.value }))}
                  className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm bg-transparent ${theme.border}`} />
                <button aria-label={`Indice pour : ${qq.label}`} onClick={() => setHints((h) => ({ ...h, [qq.id]: true }))} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: "#C46A1B" }}>
                  <HelpCircle size={17} />
                </button>
                {ok && <CheckCircle2 size={18} style={{ color: "#1F7A3D" }} />}
                {bad && <XCircle size={18} style={{ color: "#AA0000" }} />}
              </div>
              {hints[qq.id] && <p className="text-xs mt-1.5" style={{ color: "#C46A1B" }}>{qq.hint}</p>}
              {showCorrection && <p className="text-xs mt-1.5 font-medium">Réponse attendue : {qq.correct}</p>}
            </div>
          );
        })}
        <div className="flex gap-3 flex-wrap pt-1">
          <Btn onClick={check}>Vérifier</Btn>
          <Btn variant="secondary" className={theme.border} onClick={() => setShowCorrection((s) => !s)}>{showCorrection ? "Masquer la correction" : "Voir la correction"}</Btn>
        </div>
        {attempts >= 2 && !showCorrection && <p className={`text-xs ${theme.muted}`}>Après deux essais, tu peux consulter la correction détaillée.</p>}
      </div>
    </div>
  );
}

/* =========================================================================
   MODULE 3 — CALCULER UNE LIMITE
   ========================================================================= */

const LIM_NIVEAU1 = [
  { expr: "lim(x→2) [ x² + 3x − 1 ]", steps: ["La fonction est un polynôme, donc continue : on substitue directement.", "2² + 3(2) − 1 = 4 + 6 − 1"], sol: "= 9" },
  { expr: "lim(x→−1) [ 2x² − x + 5 ]", steps: ["On substitue x = −1.", "2(−1)² − (−1) + 5 = 2 + 1 + 5"], sol: "= 8" },
  { expr: "lim(x→3) [ (2x+1) / (x+2) ]", steps: ["Le dénominateur ne s'annule pas en x = 3 : on substitue.", "(2(3)+1) / (3+2) = 7/5"], sol: "= 1.4" },
];
const LIM_NIVEAU3 = [
  { expr: "lim(x→+∞) [ (3x² + x) / (x² − 5) ]", steps: ["On divise chaque terme par x², la plus haute puissance.", "= (3 + 1/x) / (1 − 5/x²)", "Quand x→+∞, 1/x→0 et 5/x²→0."], sol: "= 3" },
  { expr: "lim(x→−∞) [ (5x + 2) / (2x − 1) ]", steps: ["On divise chaque terme par x.", "= (5 + 2/x) / (2 − 1/x)", "Quand x→−∞, 2/x→0 et 1/x→0."], sol: "= 2.5" },
];

function LimitCard({ item, theme }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const ok = checked && normAnswer(answer) === normAnswer(item.sol);
  return (
    <div className={`rounded-xl p-4 border ${theme.border} ${theme.surface}`}>
      <MathLine size="text-base">{item.expr}</MathLine>
      <div className="flex gap-2 items-center mt-3">
        <input aria-label={`Résultat de ${item.expr}`} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ex : = 9"
          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-sm bg-transparent ${theme.border}`} />
        <Btn variant="secondary" className={theme.border} onClick={() => setChecked(true)}>Vérifier</Btn>
        {ok && <CheckCircle2 size={18} style={{ color: "#1F7A3D" }} />}
        {checked && !ok && <XCircle size={18} style={{ color: "#AA0000" }} />}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="text-sm mt-2 underline decoration-dotted" style={{ color: "#3E6FD9" }}>{open ? "Masquer les étapes" : "Voir les étapes de résolution"}</button>
      {open && (
        <ol className="mt-2 space-y-1 text-sm list-decimal list-inside">
          {item.steps.map((s, i) => (<li key={i} className="font-serif italic">{s}</li>))}
          <li className="font-semibold not-italic font-sans">{item.sol}</li>
        </ol>
      )}
    </div>
  );
}

function Module3({ theme, onProgress }) {
  const [tab, setTab] = useState(1);
  useEffect(() => { onProgress && onProgress(tab === 1 ? 50 : 100); }, [tab]);
  return (
    <div className="space-y-6">
      <Card theme={theme} title="Rappel">
        <p className="text-sm">Pour calculer une limite : si la fonction est définie (et continue) au point visé, on substitue directement. Pour une limite à l'infini d'une fonction rationnelle, on divise chaque terme par la plus haute puissance de x présente.</p>
      </Card>
      <div className="flex gap-2 flex-wrap">
        {[1, 2].map((n) => (
          <button key={n} onClick={() => setTab(n)} className="px-4 py-1.5 rounded-full text-sm font-medium border"
            style={{ background: tab === n ? "#1B2A4A" : "transparent", color: tab === n ? "white" : undefined }}>
            {n === 1 ? "Substitution directe" : "Limites à l'infini"}
          </button>
        ))}
      </div>
      {tab === 1 && <div className="space-y-3">{LIM_NIVEAU1.map((it, i) => (<LimitCard key={i} item={it} theme={theme} />))}</div>}
      {tab === 2 && <div className="space-y-3">{LIM_NIVEAU3.map((it, i) => (<LimitCard key={i} item={it} theme={theme} />))}</div>}
    </div>
  );
}

/* =========================================================================
   MODULE 4 — FORMES INDÉTERMINÉES
   ========================================================================= */

const FI_ITEMS = [
  { expr: "lim(x→3) [ (x² − 9) / (x − 3) ]", steps: ["En substituant x = 3, on obtient 0/0 : forme indéterminée.", "On factorise : x² − 9 = (x − 3)(x + 3).", "Après simplification par (x − 3), il reste (x + 3)."], sol: "= 6" },
  { expr: "lim(x→1) [ (x² − 1) / (x² − 3x + 2) ]", steps: ["En x = 1, on obtient 0/0.", "x² − 1 = (x − 1)(x + 1) et x² − 3x + 2 = (x − 1)(x − 2).", "Après simplification, il reste (x + 1) / (x − 2)."], sol: "= -2" },
  { expr: "lim(x→−2) [ (x² + 5x + 6) / (x + 2) ]", steps: ["En x = −2, on obtient 0/0.", "x² + 5x + 6 = (x + 2)(x + 3).", "Après simplification, il reste (x + 3)."], sol: "= 1" },
];

function Module4({ theme, onProgress }) {
  useEffect(() => { onProgress && onProgress(50); }, []);
  return (
    <div className="space-y-4">
      <Card theme={theme} title="La méthode">
        <p className="text-sm">Quand la substitution directe donne 0/0, il faut factoriser le numérateur (et parfois le dénominateur), simplifier par le facteur commun, puis recalculer la limite avec l'expression simplifiée.</p>
      </Card>
      {FI_ITEMS.map((it, i) => (<LimitCard key={i} item={it} theme={theme} />))}
    </div>
  );
}

/* =========================================================================
   MODULE 5 — LES ASYMPTOTES
   ========================================================================= */

function Module5({ dark, theme, onProgress }) {
  useEffect(() => { onProgress && onProgress(50); }, []);
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Card theme={theme} title="Asymptote verticale">
          <p className={`text-sm ${theme.muted}`}>Elle apparaît là où le dénominateur s'annule sans que le numérateur ne s'annule aussi. On résout dénominateur = 0.</p>
        </Card>
        <Card theme={theme} title="Asymptote horizontale">
          <p className={`text-sm ${theme.muted}`}>Elle apparaît quand le numérateur et le dénominateur ont le même degré : la limite en ±∞ est le rapport des coefficients dominants.</p>
        </Card>
        <Card theme={theme} title="Asymptote oblique">
          <p className={`text-sm ${theme.muted}`}>Elle apparaît quand le degré du numérateur dépasse d'exactement 1 celui du dénominateur. On effectue la division polynomiale.</p>
        </Card>
      </div>
      <Card theme={theme} title="Exemple d'asymptote oblique">
        <MathLine size="text-base">f(x) = (x² + 2x − 1) / (x − 1)</MathLine>
        <p className="text-sm mt-2">On effectue la division polynomiale : x² + 2x − 1 = (x − 1)(x + 3) + 2.</p>
        <p className="text-sm mt-1">Donc f(x) = (x + 3) + 2/(x − 1). Quand x → ±∞, le terme 2/(x−1) tend vers 0.</p>
        <p className="text-sm mt-1 font-medium">L'asymptote oblique est la droite y = x + 3.</p>
      </Card>
      <Card theme={theme} title="Exemple d'asymptote oblique — à toi de vérifier">
        <MathLine size="text-base">g(x) = (2x² − 3x + 4) / (x − 2)</MathLine>
        <p className="text-sm mt-2">Division polynomiale : 2x² − 3x + 4 = (x − 2)(2x + 1) + 6.</p>
        <p className="text-sm mt-1">Donc g(x) = (2x + 1) + 6/(x − 2).</p>
        <p className="text-sm mt-1 font-medium">L'asymptote oblique est la droite y = 2x + 1.</p>
      </Card>
    </div>
  );
}

/* =========================================================================
   MODULE 6 — INTERPRÉTATION CONCRÈTE
   ========================================================================= */

function Module6({ theme, onProgress }) {
  const steps = [
    { q: "Identifie le degré du numérateur et du dénominateur de C(x) = (500 + 3x) / x.", a: "Numérateur : degré 1 (en x). Dénominateur : degré 1." },
    { q: "Comme les degrés sont égaux, quelle est la méthode pour trouver l'asymptote horizontale ?", a: "On prend le rapport des coefficients de x : 3 / 1." },
    { q: "Calcule l'équation de l'asymptote horizontale.", a: "y = 3" },
    { q: "Interprète ce résultat dans le contexte du problème.", a: "Quand on produit un très grand nombre d'objets, le coût moyen par objet se rapproche de 3 €, sans jamais descendre en dessous." },
    { q: "Rédige une phrase-réponse complète.", a: "Le coût moyen de production tend vers 3 € par objet lorsque la production devient très importante." },
  ];
  const [idx, setIdx] = useState(0);
  const [showAns, setShowAns] = useState(false);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => { onProgress && onProgress(Math.round(((idx + (done ? 1 : 0)) / steps.length) * 100)); }, [idx, done]);

  const next = () => { if (idx < steps.length - 1) { setIdx(idx + 1); setShowAns(false); setInput(""); } else setDone(true); };
  const restart = () => { setIdx(0); setShowAns(false); setInput(""); setDone(false); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card theme={theme} title="Problème concret">
        <p className="text-sm leading-relaxed">
          Une entreprise fabrique des objets. Le coût total de production de x objets est de (500 + 3x) euros
          (500 € de frais fixes, plus 3 € par objet). Le coût moyen par objet est C(x) = (500 + 3x) / x.
          Que devient ce coût moyen lorsque la production augmente fortement ?
        </p>
      </Card>
      <Card theme={theme} title={`Étape ${Math.min(idx + 1, steps.length)} / ${steps.length}`}>
        {!done ? (
          <div>
            <p className="text-sm font-medium">{steps[idx].q}</p>
            <input aria-label={steps[idx].q} value={input} onChange={(e) => setInput(e.target.value)}
              className={`w-full mt-3 rounded-lg border px-2.5 py-1.5 text-sm bg-transparent ${theme.border}`} placeholder="Ta réponse…" />
            <div className="flex gap-2 mt-3 flex-wrap">
              <Btn onClick={() => setShowAns((s) => !s)} variant="secondary" className={theme.border}>{showAns ? "Masquer" : "Voir la réponse attendue"}</Btn>
              <Btn onClick={next}>Étape suivante <ChevronRight size={15} /></Btn>
            </div>
            {showAns && <p className="text-sm mt-3 font-serif italic" style={{ color: "#1F7A3D" }}>{steps[idx].a}</p>}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">Récapitulatif :</p>
            <ol className="text-sm space-y-1 list-decimal list-inside">{steps.map((s, i) => (<li key={i}><span className="font-serif italic">{s.a}</span></li>))}</ol>
            <p className="mt-3 text-sm rounded-lg p-3" style={{ background: "rgba(31,122,61,0.12)", color: "#1F7A3D" }}>Une asymptote horizontale représente souvent une limite physique ou économique que le phénomène approche sans jamais l'atteindre.</p>
            <Btn variant="secondary" className={`mt-3 ${theme.border}`} onClick={restart}><RotateCcw size={15} /> Recommencer</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================================
   MODULE 7 — QUIZ FINAL
   ========================================================================= */

function Module7({ dark, theme, onFinish }) {
  const [quiz, setQuiz] = useState(() => buildQuiz(15));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongCategories, setWrongCategories] = useState({});
  const [finished, setFinished] = useState(false);

  const current = quiz[idx];

  const choose = (optId) => {
    if (answered) return;
    setSelected(optId);
    setAnswered(true);
    if (optId === current.correctId) setScore((s) => s + 1);
    else setWrongCategories((w) => ({ ...w, [current.category]: (w[current.category] || 0) + 1 }));
  };

  const next = () => { if (idx < quiz.length - 1) { setIdx(idx + 1); setSelected(null); setAnswered(false); } else finish(); };

  const finish = async () => {
    setFinished(true);
    const scaled = Math.round((score / quiz.length) * 20);
    try {
      await window.storage.set(`quizResult:${Date.now()}`, JSON.stringify({ date: new Date().toISOString(), score: scaled, correct: score, total: quiz.length, wrongCategories }));
    } catch (e) {}
    onFinish && onFinish(scaled);
  };

  const restart = () => { setQuiz(buildQuiz(15)); setIdx(0); setSelected(null); setAnswered(false); setScore(0); setWrongCategories({}); setFinished(false); };

  if (finished) {
    const scaled = Math.round((score / quiz.length) * 20);
    let msg;
    if (scaled >= 18) msg = "Excellent : tu maîtrises très bien les limites et les asymptotes.";
    else if (scaled >= 14) msg = "Très bon travail : quelques entraînements ciblés te permettront de consolider tes acquis.";
    else if (scaled >= 10) msg = "Les bases sont présentes, mais il est utile de revoir les formes indéterminées et les asymptotes.";
    else msg = "Reprends les modules progressivement, en commençant par « Explorer une fonction » et « Calculer une limite ».";
    return (
      <Card theme={theme} title="Résultat du quiz">
        <p className="text-4xl font-serif font-semibold">{scaled} / 20</p>
        <p className="text-sm mt-2">{score} bonnes réponses sur {quiz.length}.</p>
        <p className="text-sm mt-3">{msg}</p>
        <Btn className="mt-4" onClick={restart}><RotateCcw size={15} /> Refaire le quiz</Btn>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm ${theme.muted}`}>Question {idx + 1} / {quiz.length}</p>
        <p className={`text-xs px-2 py-1 rounded-full ${theme.surfaceAlt}`}>{current.category}</p>
      </div>
      <ProgressGauge value={((idx + 1) / quiz.length) * 100} theme={theme} />
      <Card theme={theme} className="mt-4">
        <p className="font-medium">{current.prompt}</p>
        {current.graph && (<div className="mt-3"><RationalGraph {...current.graph} dark={dark} showLabels={false} width={340} height={240} /></div>)}
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {current.options.map((opt) => {
            const isCorrect = opt.id === current.correctId;
            const isSelected = opt.id === selected;
            let border = dark ? "#334" : "#dde";
            let bg = "transparent";
            if (answered && isCorrect) { border = "#1F7A3D"; bg = "rgba(31,122,61,0.12)"; }
            else if (answered && isSelected && !isCorrect) { border = "#AA0000"; bg = "rgba(170,0,0,0.12)"; }
            else if (isSelected) { border = "#3E6FD9"; bg = "rgba(62,111,217,0.12)"; }
            return (
              <button key={opt.id} onClick={() => choose(opt.id)} disabled={answered}
                className="rounded-lg border p-2 text-sm text-left flex flex-col items-start gap-1" style={{ borderColor: border, background: bg }}>
                <span className="font-serif italic">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className="mt-4 text-sm rounded-lg p-3" style={{ background: theme.surfaceAlt }}>
            <p className="font-medium mb-1">{selected === current.correctId ? "Bonne réponse !" : "Pas tout à fait."}</p>
            <p>{current.explanation}</p>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Btn onClick={answered ? next : undefined} className={!answered ? "opacity-40 pointer-events-none" : ""}>
            {idx === quiz.length - 1 ? "Voir mon résultat" : "Question suivante"} <ChevronRight size={15} />
          </Btn>
        </div>
      </Card>
    </div>
  );
}

/* =========================================================================
   MODE PROFESSEUR — PROJECTION EN CLASSE
   ========================================================================= */

function ProjectionOverlay({ onClose, dark }) {
  const [current, setCurrent] = useState(() => GENERATORS[randInt(0, GENERATORS.length - 1)]());
  const [showAnswer, setShowAnswer] = useState(false);
  const draw = () => { setCurrent(GENERATORS[randInt(0, GENERATORS.length - 1)]()); setShowAnswer(false); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: dark ? "#0B1220" : "#101B33" }}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-white/80 text-sm"><Projector size={18} /> Mode professeur · projection en classe</div>
        <button onClick={onClose} aria-label="Fermer le mode professeur" className="text-white/80 hover:text-white rounded-full p-2 hover:bg-white/10"><X size={22} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="max-w-3xl w-full text-center">
          <p className="text-xs uppercase tracking-wide text-white/50 mb-3">{current.category}</p>
          <p className="text-white text-2xl sm:text-3xl font-serif leading-snug">{current.prompt}</p>
          {current.graph && (<div className="flex justify-center mt-6 bg-white/5 rounded-2xl p-4"><RationalGraph {...current.graph} dark width={420} height={300} /></div>)}
          {showAnswer && (
            <div className="mt-8 rounded-2xl p-5 text-left" style={{ background: "rgba(242,162,76,0.15)" }}>
              <p className="text-[#F2A24C] font-medium mb-1">Réponse</p>
              <p className="text-white/90 text-sm">{current.options.find((o) => o.id === current.correctId)?.label}</p>
              <p className="text-white/70 text-sm mt-2">{current.explanation}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 py-6 flex-wrap px-6">
        <Btn onClick={draw} variant="primary" style={{ backgroundColor: "#3E6FD9" }}><Shuffle size={16} /> Tirer un exercice au hasard</Btn>
        <Btn onClick={() => setShowAnswer((s) => !s)} variant="secondary" className="!text-white !border-white/30">
          {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />} {showAnswer ? "Masquer la réponse" : "Afficher la réponse"}
        </Btn>
      </div>
    </div>
  );
}

/* =========================================================================
   ESPACE ENSEIGNANT
   ========================================================================= */

const TEACHER_PASSWORD = "prof2026";

function EspaceEnseignant({ theme, stats }) {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printable, setPrintable] = useState(null);
  const [showCorr, setShowCorr] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.storage.list("quizResult:");
      const items = [];
      if (list && list.keys) {
        for (const k of list.keys) { try { const r = await window.storage.get(k, false); if (r) items.push(JSON.parse(r.value)); } catch (e) {} }
      }
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      setResults(items);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  const submit = () => { if (pwd === TEACHER_PASSWORD) { setAuthed(true); setError(false); } else setError(true); };

  const avg = results.length ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10 : null;
  const errorTally = {};
  results.forEach((r) => { Object.entries(r.wrongCategories || {}).forEach(([cat, n]) => { errorTally[cat] = (errorTally[cat] || 0) + n; }); });
  const sortedErrors = Object.entries(errorTally).sort((a, b) => b[1] - a[1]);

  const resetDemo = async () => {
    try { const list = await window.storage.list("quizResult:"); if (list && list.keys) for (const k of list.keys) await window.storage.delete(k, false); } catch (e) {}
    setResults([]);
  };

  const exportCSV = () => {
    const header = "date,score_sur_20,bonnes_reponses,total\n";
    const rows = results.map((r) => `${r.date},${r.score},${r.correct},${r.total}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "resultats_limites.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const generateExercises = () => {
    const ex = [];
    for (let i = 0; i < 10; i++) ex.push(GENERATORS[i % GENERATORS.length]());
    setPrintable(shuffle(ex));
    setShowCorr(false);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto text-center">
        <Lock size={28} className="mx-auto mb-3" style={{ color: "#1B2A4A" }} />
        <h2 className="font-serif text-xl font-semibold">Espace enseignant</h2>
        <p className={`text-sm mt-1 ${theme.muted}`}>Cette section est protégée.</p>
        <div className="mt-4 flex gap-2">
          <input type="password" aria-label="Mot de passe enseignant" value={pwd} onChange={(e) => setPwd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm bg-transparent ${theme.border}`} placeholder="Mot de passe" />
          <Btn onClick={submit}>Entrer</Btn>
        </div>
        {error && <p className="text-sm mt-2" style={{ color: "#AA0000" }}>Mot de passe incorrect.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-serif text-2xl font-semibold">Tableau de bord enseignant</h2>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" className={theme.border} onClick={exportCSV}><Download size={15} /> Exporter en CSV</Btn>
          <Btn variant="secondary" className={theme.border} onClick={resetDemo}><Trash2 size={15} /> Réinitialiser les données</Btn>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card theme={theme} title="Quiz complétés"><p className="text-3xl font-serif font-semibold">{results.length}</p></Card>
        <Card theme={theme} title="Score moyen"><p className="text-3xl font-serif font-semibold">{avg !== null ? `${avg} / 20` : "—"}</p></Card>
        <Card theme={theme} title="Modules explorés"><p className="text-3xl font-serif font-semibold">{Object.keys(stats || {}).length} / 6</p></Card>
      </div>
      <Card theme={theme} title="Résultats anonymisés des élèves (session locale)">
        {loading ? <p className="text-sm">Chargement…</p> : results.length === 0 ? (
          <p className={`text-sm ${theme.muted}`}>Aucun résultat enregistré pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b border-current/10"><th className="py-1.5 pr-4">Élève</th><th className="py-1.5 pr-4">Date</th><th className="py-1.5 pr-4">Score</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-current/5">
                    <td className="py-1.5 pr-4">Élève #{results.length - i}</td>
                    <td className="py-1.5 pr-4">{new Date(r.date).toLocaleDateString("fr-BE")}</td>
                    <td className="py-1.5 pr-4 font-medium">{r.score} / 20</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card theme={theme} title="Erreurs les plus fréquentes">
        {sortedErrors.length === 0 ? <p className={`text-sm ${theme.muted}`}>Pas encore assez de données.</p> : (
          <ul className="text-sm space-y-1">{sortedErrors.map(([cat, n]) => (<li key={cat} className="flex justify-between"><span>{cat}</span><span className="font-medium">{n}</span></li>))}</ul>
        )}
      </Card>
      <Card theme={theme} title="Générer une série d'exercices imprimables">
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={generateExercises}>Générer 10 exercices</Btn>
          {printable && (<>
            <Btn variant="secondary" className={theme.border} onClick={() => setShowCorr((s) => !s)}>{showCorr ? "Masquer le corrigé" : "Afficher le corrigé"}</Btn>
            <Btn variant="secondary" className={theme.border} onClick={() => window.print()}><Printer size={15} /> Imprimer</Btn>
          </>)}
        </div>
        {printable && (
          <ol className="mt-4 space-y-4 list-decimal list-inside text-sm">
            {printable.map((ex, i) => (
              <li key={i}>
                <span>{ex.prompt}</span>
                {showCorr && (<div className="mt-1 ml-5 text-xs" style={{ color: "#1F7A3D" }}>Réponse : {ex.options.find((o) => o.id === ex.correctId)?.label} — {ex.explanation}</div>)}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* =========================================================================
   APPLICATION PRINCIPALE
   ========================================================================= */

const TABS = [
  { id: "accueil", label: "Accueil", icon: Home },
  { id: "m1", label: "Explorer une fonction", icon: Sparkles },
  { id: "m2", label: "Lire un graphique", icon: LineChart },
  { id: "m3", label: "Calculer une limite", icon: Sigma },
  { id: "m4", label: "Formes indéterminées", icon: Layers },
  { id: "m5", label: "Les asymptotes", icon: SlidersHorizontal },
  { id: "m6", label: "Interprétation concrète", icon: Target },
  { id: "quiz", label: "Quiz final", icon: CheckCircle2 },
  { id: "prof", label: "Espace enseignant", icon: Lock },
];

export default function App() {
  const [tab, setTab] = useState("accueil");
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teacherView, setTeacherView] = useState(false);
  const [visited, setVisited] = useState(new Set(["accueil"]));
  const [stats, setStats] = useState({});

  useEffect(() => {
    (async () => {
      try { const v = await window.storage.get("visited-lim"); if (v) setVisited(new Set(JSON.parse(v.value))); } catch (e) {}
      try { const s = await window.storage.get("stats-lim"); if (s) setStats(JSON.parse(s.value)); } catch (e) {}
    })();
  }, []);

  const goTo = (id) => {
    setTab(id); setMenuOpen(false);
    setVisited((prev) => {
      const next = new Set(prev); next.add(id);
      window.storage.set("visited-lim", JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const setModuleProgress = (id) => (value) => {
    setStats((prev) => {
      const next = { ...prev, [id]: value };
      window.storage.set("stats-lim", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const theme = dark
    ? { bg: "bg-[#0B1220]", text: "text-slate-100", surface: "bg-[#101B33]", surfaceAlt: "bg-[#16264A]", border: "border-slate-700/70", muted: "text-slate-400", headerBg: "bg-[#0B1220]/90" }
    : { bg: "bg-[#F6F8FC]", text: "text-slate-900", surface: "bg-white", surfaceAlt: "bg-[#EEF2FB]", border: "border-slate-200", muted: "text-slate-500", headerBg: "bg-white/90" };

  const moduleTabs = TABS.filter((t) => t.id !== "accueil" && t.id !== "prof");
  const overallProgress = (moduleTabs.filter((t) => visited.has(t.id)).length / moduleTabs.length) * 100;

  return (
    <div className={`min-h-screen w-full ${theme.bg} ${theme.text} font-sans`}>
      <header className={`sticky top-0 z-40 backdrop-blur border-b ${theme.border} ${theme.headerBg}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => goTo("accueil")} className="flex items-center gap-2 font-serif font-semibold text-lg">
              <GraduationCap size={22} style={{ color: "#3E6FD9" }} /> Limites et asymptotes
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setTeacherView(true)} aria-label="Activer le mode professeur"
                className={`hidden sm:flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border ${theme.border} hover:bg-black/5`}>
                <Projector size={16} /> Mode professeur
              </button>
              <button onClick={() => setDark((d) => !d)} aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} className={`p-2 rounded-full border ${theme.border} hover:bg-black/5`}>
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button onClick={() => setMenuOpen((m) => !m)} aria-label="Ouvrir le menu" className={`sm:hidden p-2 rounded-full border ${theme.border}`}>
                {menuOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
            </div>
          </div>
          <nav className="hidden sm:flex gap-1 overflow-x-auto pb-2 -mx-1 px-1" aria-label="Navigation principale">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => goTo(t.id)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full whitespace-nowrap shrink-0 transition"
                  style={{ background: active ? "#1B2A4A" : "transparent", color: active ? "white" : undefined }} aria-current={active ? "page" : undefined}>
                  <Icon size={15} /> {t.label}
                  {visited.has(t.id) && t.id !== "accueil" && !active && <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: "#1F7A3D" }} />}
                </button>
              );
            })}
          </nav>
        </div>
        {menuOpen && (
          <div className={`sm:hidden border-t ${theme.border} px-4 py-2 space-y-1`}>
            {TABS.map((t) => { const Icon = t.icon; return (<button key={t.id} onClick={() => goTo(t.id)} className="w-full flex items-center gap-2 text-sm px-2 py-2 rounded-lg hover:bg-black/5"><Icon size={16} /> {t.label}</button>); })}
            <button onClick={() => { setTeacherView(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 text-sm px-2 py-2 rounded-lg hover:bg-black/5"><Projector size={16} /> Mode professeur</button>
          </div>
        )}
        <div className="h-1 w-full bg-transparent"><div className="h-1 transition-all" style={{ width: `${overallProgress}%`, backgroundColor: "#F2A24C" }} /></div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {tab === "accueil" && <HomePage theme={theme} dark={dark} onStart={() => goTo("m1")} progress={overallProgress} />}
        {tab === "m1" && <Module1 theme={theme} dark={dark} onProgress={setModuleProgress("m1")} />}
        {tab === "m2" && <Module2 theme={theme} dark={dark} onProgress={setModuleProgress("m2")} />}
        {tab === "m3" && <Module3 theme={theme} onProgress={setModuleProgress("m3")} />}
        {tab === "m4" && <Module4 theme={theme} onProgress={setModuleProgress("m4")} />}
        {tab === "m5" && <Module5 theme={theme} dark={dark} onProgress={setModuleProgress("m5")} />}
        {tab === "m6" && <Module6 theme={theme} onProgress={setModuleProgress("m6")} />}
        {tab === "quiz" && <Module7 theme={theme} dark={dark} onFinish={setModuleProgress("quiz")} />}
        {tab === "prof" && <EspaceEnseignant theme={theme} stats={stats} />}
      </main>

      <footer className={`text-center text-xs py-8 ${theme.muted}`}>Limites et asymptotes interactif — 5e secondaire</footer>
      {teacherView && <ProjectionOverlay dark={dark} onClose={() => setTeacherView(false)} />}
    </div>
  );
}
