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

// Labels for the visual editor (falls back to English).
export const EDITOR = {
  en: {
    section_data: "Data", section_display: "Appearance", section_advanced: "Advanced", section_stops: "Stops",
    mode_entity: "Home Assistant entity", mode_source: "Fetch from provider",
    advanced_help: "Colours and labels are maps of line number or quay id to value; edit them as YAML here.",
    stops_help: "Stop ids: Entur NSR:StopPlace:… (all platforms) or NSR:Quay:… (one platform); Transitous ids from its geocoder. Lists are comma separated.",
    stop: "Stop", remove: "Remove", add_stop: "Add stop", auto: "Automatic", yes: "Yes", no: "No",
    label_bar: "Text inside the bar", label_inline: "Icons next to the time",
    labels: {
      entity: "Sensor with a `list` attribute", provider: "Provider", refresh: "Refresh interval", door_buffer_min: "Door buffer (min, or input_number entity)",
      watch_entity: "Entity holding line@quay tokens", watch: "Only these line@quay tokens", url: "API URL (empty = default)",
      id: "Stop id", name: "Label", walk_min: "Walk (min, or input_number entity)", lines: "Only lines", quays: "Only quays", exclude_lines: "Hide lines",
      title: "Title", language: "Language", max_rows: "Rows", scale_min: "Bar scale", compact: "Compact", label: "Layout",
      show_header: "Show header", show_stop: "Show stop and walk time", short_dest: "Shorten destination", animations: "Animations",
      tap_action: "Tap action", drop_after: "Keep 'too late' rows for", bar_height: "Bar height (inline layout)",
      line_colors: "Line colours", stop_labels: "Quay labels",
    },
    helpers: {
      watch: "Comma separated, e.g. 1@103009, 22@103009. Empty = everything at the stops.",
      watch_entity: "Lets automations choose the routes, e.g. input_text.bus_watch.",
      door_buffer_min: "Minutes between 'leave now' and being out of the door.",
    },
  },
  nb: {
    section_data: "Data", section_display: "Utseende", section_advanced: "Avansert", section_stops: "Holdeplasser",
    mode_entity: "Home Assistant-entitet", mode_source: "Hent fra leverandør",
    advanced_help: "Farger og etiketter er oppslag fra linjenummer eller plattform-id til verdi; rediger dem som YAML her.",
    stops_help: "Holdeplass-id: Entur NSR:StopPlace:… (alle plattformer) eller NSR:Quay:… (én plattform); Transitous-id fra geokoderen deres. Lister skilles med komma.",
    stop: "Holdeplass", remove: "Fjern", add_stop: "Legg til holdeplass", auto: "Automatisk", yes: "Ja", no: "Nei",
    label_bar: "Tekst inni linjen", label_inline: "Ikoner ved klokkeslettet",
    labels: {
      entity: "Sensor med `list`-attributt", provider: "Leverandør", refresh: "Oppdateringsintervall", door_buffer_min: "Margin ut døra (min, eller input_number)",
      watch_entity: "Entitet med linje@plattform-tokens", watch: "Bare disse linje@plattform-tokens", url: "API-URL (tom = standard)",
      id: "Holdeplass-id", name: "Etikett", walk_min: "Gange (min, eller input_number)", lines: "Bare linjer", quays: "Bare plattformer", exclude_lines: "Skjul linjer",
      title: "Tittel", language: "Språk", max_rows: "Rader", scale_min: "Skala på linjen", compact: "Kompakt", label: "Oppsett",
      show_header: "Vis overskrift", show_stop: "Vis holdeplass og gangtid", short_dest: "Forkort destinasjon", animations: "Animasjoner",
      tap_action: "Trykkhandling", drop_after: "Behold «for sent»-rader i", bar_height: "Linjehøyde (ikon-oppsett)",
      line_colors: "Linjefarger", stop_labels: "Plattform-etiketter",
    },
    helpers: {
      watch: "Kommaseparert, f.eks. 1@103009, 22@103009. Tom = alt på holdeplassene.",
      watch_entity: "Lar automasjoner velge rutene, f.eks. input_text.bus_watch.",
      door_buffer_min: "Minutter fra «gå ut nå» til du er ute av døra.",
    },
  },
};
EDITOR.no = EDITOR.nb;
EDITOR.nn = EDITOR.nb;

export function pickEditorLanguage(hass) {
  const l = String((hass && hass.locale && hass.locale.language) || (hass && hass.language) || "en").toLowerCase();
  return EDITOR[l] || EDITOR[l.split(/[-_]/)[0]] || EDITOR.en;
}
