/* Local game saves are untrusted input, never authorization. */
(() => {
  'use strict';
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const number = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : fallback;
  const numbers = (value, defaults) => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, number(record(value) ? value[key] : undefined, fallback)]));
  const text = value => typeof value === 'string' ? value.slice(0, 200) : '';
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
  function validate(key, value) {
    const v = record(value) ? value : {};
    switch (key) {
      case 'ka_state': return {
        ...numbers(v, { xp: 0, coins: 0, level: 1, plays: 0, streak: 0 }),
        lastDaily: date(v.lastDaily), lastVisit: date(v.lastVisit),
        achievements: Array.isArray(v.achievements) ? v.achievements.filter(x => typeof x === 'string' && /^[a-z0-9_]{1,80}$/.test(x)).slice(0, 200) : []
      };
      case 'dc_stats': return {
        total: number(v.total), wins: numbers(v.wins, { A: 0, B: 0, C: 0, X: 0 }),
        history: Array.isArray(v.history) ? v.history.filter(record).slice(-50).map(h => ({ a: text(h.a), b: text(h.b), c: text(h.c), result: text(h.result), time: number(h.time) })) : []
      };
      case 'greed_dice_state': return { stack: number(v.stack, 100000), debt: number(v.debt), stats: numbers(v.stats, { rounds: 0, wins: 0, streak: 0, startingStack: 100000 }) };
      case 'the_button_state': return numbers(v, { clicks: 0, lifetimeClicks: 0, quantumCores: 0, glitchesCaught: 0, maxCombo: 1 });
      case 'oracle_stats': return numbers(v, { queries: 0, delusions: 0 });
      default: return value;
    }
  }
  const saveKeys = new Set(['ka_state', 'dc_stats', 'greed_dice_state', 'the_button_state', 'oracle_stats']);
  window.GameStorage = Object.freeze({
    getItem(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null || !saveKeys.has(key)) return raw;
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = {}; }
        return JSON.stringify(validate(key, parsed));
      } catch { return saveKeys.has(key) ? JSON.stringify(validate(key, {})) : null; }
    },
    setItem(key, value) {
      try {
        const safe = saveKeys.has(key) ? JSON.stringify(validate(key, JSON.parse(value))) : String(value);
        localStorage.setItem(key, safe);
      } catch { /* Private browsing or full storage must not stop a game. */ }
    }
  });
})();
