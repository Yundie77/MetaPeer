import humanizeDuration from 'humanize-duration';

/**
 * Configurado en español corto para tiempos relativos.
 */
const relativeHumanizer = humanizeDuration.humanizer({
  language: 'es_short',
  fallbacks: ['es', 'en'],
  largest: 1,
  round: true,
  spacer: '',
  delimiter: ' ',
  units: ['y', 'mo', 'w', 'd', 'h', 'm', 's'],
  languages: {
    es_short: {
      y: () => 'a',
      mo: () => 'mes',
      w: () => 'sem',
      d: () => 'd',
      h: () => 'h',
      m: () => 'min',
      s: () => 's',
      ms: () => 'ms'
    }
  }
});

/**
 * Devuelve un alias breve a partir del nombre completo (ej: "juan p.").
 */
export function buildAlias(fullName) {
  const fallback = 'revisor';
  if (fullName === null || fullName === undefined) return fallback;
  const clean = String(fullName).trim();
  if (!clean) return fallback;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const first = parts[0].toLowerCase();
  if (parts.length === 1) return first;
  const initial = parts[1] ? `${parts[1].charAt(0).toLowerCase()}.` : '';
  return initial ? `${first} ${initial}` : first;
}

/**
 * Formatea una fecha a texto relativo y absoluto (tooltips) en español.
 */
export function formatRelativeTime(dateValue) {
  if (!dateValue) {
    return { relativeText: '', absoluteText: '' };
  }
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return { relativeText: '', absoluteText: '' };
  }
  const diff = Date.now() - parsed.getTime();
  const direction = diff >= 0 ? 'hace' : 'en';
  const diffMs = Math.abs(diff);
  const safeDiff = diffMs < 1000 ? 1000 : diffMs;
  const relative = relativeHumanizer(safeDiff);
  if (!relative) {
    return { relativeText: '', absoluteText: '' };
  }
  const absoluteText = parsed.toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid'
  });
  return {
    relativeText: `${direction} ${relative}`,
    absoluteText
  };
}
