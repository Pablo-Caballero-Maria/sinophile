/** Achievements (logros): pure predicates over progress (+ the session just finished). */
import { VOCAB_IDS } from "../data/vocab.ts";
import { correctBySkill, isLearned, streakInfo, totalXp, type Progress } from "./model.ts";

export interface SessionContext {
  mode: string;
  total: number;
  mistakes: number;
  finishedAt: Date;
  examGrade?: number;
  infiniteScore?: number;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  check: (p: Progress, s?: SessionContext) => boolean;
}

const learnedCount = (p: Progress) => [...VOCAB_IDS].filter((id) => isLearned(p, id)).length;
const sessions = (p: Progress) => Object.values(p.days).reduce((n, d) => n + d.sessions, 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-session", icon: "始", title: "Primer paso", description: "Completa tu primera sesión.", check: (p) => sessions(p) >= 1 },
  { id: "streak-3", icon: "🔥", title: "En racha", description: "Practica 3 días seguidos.", check: (p) => streakInfo(p).best >= 3 },
  { id: "streak-7", icon: "🔥", title: "Una semana", description: "Racha de 7 días.", check: (p) => streakInfo(p).best >= 7 },
  { id: "streak-30", icon: "🐉", title: "Constancia de dragón", description: "Racha de 30 días.", check: (p) => streakInfo(p).best >= 30 },
  { id: "xp-500", icon: "⭐", title: "500 XP", description: "Consigue 500 puntos de experiencia.", check: (p) => totalXp(p) >= 500 },
  { id: "xp-5000", icon: "🌟", title: "5000 XP", description: "Consigue 5000 puntos de experiencia.", check: (p) => totalXp(p) >= 5000 },
  { id: "words-10", icon: "十", title: "Diez palabras", description: "Aprende 10 palabras.", check: (p) => learnedCount(p) >= 10 },
  { id: "words-50", icon: "五十", title: "Cincuenta palabras", description: "Aprende 50 palabras.", check: (p) => learnedCount(p) >= 50 },
  { id: "words-100", icon: "百", title: "Cien palabras", description: "Aprende 100 palabras.", check: (p) => learnedCount(p) >= 100 },
  {
    id: "perfect",
    icon: "💎",
    title: "Impecable",
    description: "Termina una sesión de 8+ ejercicios sin fallos.",
    check: (_, s) => !!s && s.mode !== "examen" && s.total >= 8 && s.mistakes === 0,
  },
  { id: "combo-20", icon: "⚡", title: "Imparable", description: "Encadena 20 aciertos seguidos.", check: (p) => p.records.combo >= 20 },
  { id: "infinite-25", icon: "∞", title: "Maratón", description: "Llega a 25 aciertos en el modo infinito.", check: (p) => p.records.infinite >= 25 },
  { id: "infinite-100", icon: "♾️", title: "Sin fin", description: "Llega a 100 aciertos en el modo infinito.", check: (p) => p.records.infinite >= 100 },
  { id: "exam-pass", icon: "📜", title: "Aprobado", description: "Aprueba un examen (nota ≥ 5).", check: (p) => p.exams.some((e) => e.grade >= 5) },
  {
    id: "exam-honors",
    icon: "🎓",
    title: "Matrícula de honor",
    description: "Saca un 10 en un examen de 20+ preguntas.",
    check: (p) => p.exams.some((e) => e.grade >= 10 && e.total >= 20),
  },
  { id: "writer-25", icon: "✍️", title: "Calígrafo", description: "Escribe bien 25 palabras.", check: (p) => correctBySkill(p).writing >= 25 },
  { id: "writer-200", icon: "🖌️", title: "Maestro del pincel", description: "Escribe bien 200 palabras.", check: (p) => correctBySkill(p).writing >= 200 },
  { id: "speaker-20", icon: "🗣️", title: "Buena pronunciación", description: "Pronuncia bien 20 veces.", check: (p) => correctBySkill(p).speaking >= 20 },
  { id: "early-bird", icon: "🌅", title: "Madrugador", description: "Termina una sesión antes de las 8:00.", check: (_, s) => !!s && s.finishedAt.getHours() < 8 },
  { id: "night-owl", icon: "🦉", title: "Búho nocturno", description: "Termina una sesión después de las 23:00.", check: (_, s) => !!s && s.finishedAt.getHours() >= 23 },
];

/** Achievements newly satisfied (not yet in progress.achievements). */
export function newlyUnlocked(p: Progress, s?: SessionContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.check(p, s));
}
