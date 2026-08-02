import CHAR_DATA from "../data/characters.json";

export const CATEGORIES = Object.keys(CHAR_DATA);
export const VOTE_SECONDS = 30;
export const GUESS_SECONDS = 120;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function keyFor(entry) {
  return entry.s + "::" + entry.n;
}

export function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ");
}

export function matchesGuess(guessText, entry) {
  const g = normalize(guessText);
  if (!g) return false;
  if (normalize(entry.n) === g) return true;
  return (entry.a || []).some((alt) => normalize(alt) === g);
}

export function getSeriesByCategory() {
  const result = {};
  CATEGORIES.forEach((cat) => {
    const seen = new Set();
    const list = [];
    CHAR_DATA[cat].forEach((e) => {
      if (!seen.has(e.s)) { seen.add(e.s); list.push(e.s); }
    });
    result[cat] = list.sort((a, b) => a.localeCompare(b));
  });
  return result;
}

export function getAvailableCategories(usedKeys, disabledSeries) {
  const usedSet = new Set(usedKeys || []);
  const disabledSet = new Set(disabledSeries || []);
  return CATEGORIES.filter((cat) => {
    const unused = CHAR_DATA[cat].filter((e) => !usedSet.has(keyFor(e)) && !disabledSet.has(e.s));
    return unused.length >= 2;
  });
}

export function pickPair(category, usedKeys, disabledSeries) {
  const usedSet = new Set(usedKeys || []);
  const disabledSet = new Set(disabledSeries || []);
  const pool = CHAR_DATA[category].filter((e) => !usedSet.has(keyFor(e)) && !disabledSet.has(e.s));
  if (pool.length < 2) return null;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const [a, b] = shuffled;
  return {
    charA: { key: keyFor(a), n: a.n, s: a.s, a: a.a || [], i: a.i || "" },
    charB: { key: keyFor(b), n: b.n, s: b.s, a: b.a || [], i: b.i || "" },
  };
}

export function tallyVotes(voteDocs) {
  let a = 0, b = 0;
  voteDocs.forEach((v) => {
    if (v.side === "a") a++;
    else if (v.side === "b") b++;
  });
  return { a, b };
}
