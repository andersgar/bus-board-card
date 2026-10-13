// UI strings. Pick with `language:` in the card config; otherwise the Home
// Assistant user language is used, falling back to English.
export const STR = {
  en: {
    title: "Departures",
    leave_in: (n) => `leave in ${n} min`,
    leave_now: "leave now",
    run: "run!",
    too_late: "too late",
    gone: "gone",
    cancelled: "cancelled",
    now: "now",
    in_min: (n) => `in ${n} min`,
    min: (n) => `${n} min`,
    walk: (n) => `walk ${n} min`,
    next_leave_in: (n) => `next: leave in ${n} min`,
    next_leave_now: "next: leave now",
    no_departures: "No departures for the selected routes",
    no_data: (e) => `No data from ${e}`,
    loading: "Loading departures…",
    error: (m) => `Could not load departures: ${m}`,
    offline: "offline",
  },
  nb: {
    title: "Avganger",
    leave_in: (n) => `gå ut om ${n} min`,
    leave_now: "gå ut nå",
    run: "løp!",
    too_late: "for sent",
    gone: "gått",
    cancelled: "innstilt",
    now: "nå",
    in_min: (n) => `om ${n} min`,
    min: (n) => `${n} min`,
    walk: (n) => `gå ${n} min`,
    next_leave_in: (n) => `neste: gå ut om ${n} min`,
    next_leave_now: "neste: gå ut nå",
    no_departures: "Ingen avganger i rutene som vises",
    no_data: (e) => `Ingen data fra ${e}`,
    loading: "Henter avganger…",
    error: (m) => `Kunne ikke hente avganger: ${m}`,
    offline: "frakoblet",
  },
  sv: {
    title: "Avgångar",
    leave_in: (n) => `gå om ${n} min`,
    leave_now: "gå nu",
    run: "spring!",
    too_late: "för sent",
    gone: "avgått",
    cancelled: "inställd",
    now: "nu",
    in_min: (n) => `om ${n} min`,
    min: (n) => `${n} min`,
    walk: (n) => `gå ${n} min`,
    next_leave_in: (n) => `nästa: gå om ${n} min`,
    next_leave_now: "nästa: gå nu",
    no_departures: "Inga avgångar för de valda linjerna",
    no_data: (e) => `Inga data från ${e}`,
    loading: "Hämtar avgångar…",
    error: (m) => `Kunde inte hämta avgångar: ${m}`,
    offline: "frånkopplad",
  },
  de: {
    title: "Abfahrten",
    leave_in: (n) => `in ${n} min losgehen`,
    leave_now: "jetzt losgehen",
    run: "lauf!",
    too_late: "zu spät",
    gone: "weg",
    cancelled: "fällt aus",
    now: "jetzt",
    in_min: (n) => `in ${n} min`,
    min: (n) => `${n} min`,
    walk: (n) => `${n} min Fußweg`,
    next_leave_in: (n) => `nächste: in ${n} min losgehen`,
    next_leave_now: "nächste: jetzt losgehen",
    no_departures: "Keine Abfahrten für die gewählten Linien",
    no_data: (e) => `Keine Daten von ${e}`,
    loading: "Abfahrten werden geladen…",
    error: (m) => `Abfahrten konnten nicht geladen werden: ${m}`,
    offline: "offline",
  },
};
STR.no = STR.nb;
STR.nn = STR.nb;

export function pickLanguage(configLang, hass) {
  const cands = [configLang, hass && hass.locale && hass.locale.language, hass && hass.language, typeof navigator !== "undefined" ? navigator.language : null];
  for (const c of cands) {
    if (!c) continue;
    const l = String(c).toLowerCase();
    if (STR[l]) return STR[l];
    const short = l.split(/[-_]/)[0];
    if (STR[short]) return STR[short];
  }
  return STR.en;
}
