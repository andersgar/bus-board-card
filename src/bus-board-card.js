/*
 * bus-board-card — Home Assistant custom card: upcoming public transport
 * departures, one row per departure, each with a "when do I have to leave
 * the house" countdown bar.
 *
 * Data comes from one of two places:
 *   entity: sensor.bus_departures   a Home Assistant entity whose `list`
 *                                   attribute holds departures
 *                                   (see docs/home-assistant-sensors.md)
 *   source: { provider: entur, stops: [...] }
 *                                   the card fetches departures itself
 *                                   (see docs/providers.md)
 *
 * List entry shape (both modes):
 *   {line, dest, stop, quay, aimed, expected, expected_ts, delay_min, realtime,
 *    cancelled, sj, walk_min, leave_at, leave_ts, color?, text_color?}
 */
import { pickLanguage } from "./i18n.js";
import { getProvider } from "./providers/index.js";
import { subscribe } from "./poller.js";
import { BusBoardCardEditor } from "./editor.js";

// eslint-disable-next-line no-undef
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";

const ICON_BUS = "M18,11H6V6H18M16.5,17A1.5,1.5 0 0,1 15,15.5A1.5,1.5 0 0,1 16.5,14A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 16.5,17M7.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,14A1.5,1.5 0 0,1 9,15.5A1.5,1.5 0 0,1 7.5,17M4,16C4,16.88 4.39,17.67 5,18.22V20A1,1 0 0,0 6,21H7A1,1 0 0,0 8,20V19H16V20A1,1 0 0,0 17,21H18A1,1 0 0,0 19,20V18.22C19.61,17.67 20,16.88 20,16V6C20,2.5 16.42,2 12,2C7.58,2 4,2.5 4,6V16Z";
const ICON_WALK = "M13.5,5.5C14.6,5.5 15.5,4.6 15.5,3.5S14.6,1.5 13.5,1.5S11.5,2.4 11.5,3.5S12.4,5.5 13.5,5.5M9.8,8.9L7,23H9.1L10.9,15L13,17V23H15V15.5L12.9,13.5L13.5,10.5C14.8,12 16.8,13 19,13V11C17.1,11 15.5,10 14.7,8.6L13.7,7C13.3,6.4 12.7,6 12,6C11.7,6 11.5,6.1 11.2,6.1L6,8.3V13H8V9.6L9.8,8.9Z";
const ICON_RUN = ICON_WALK;
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

// Fallback badge colours: a stable colour per line number when neither the
// provider nor `line_colors` gives one.
const PALETTE = ["#3fa34d", "#2b7fd1", "#e0342b", "#f2a900", "#8e44ad", "#00a3a3", "#e67e22", "#1abc9c", "#c0392b", "#7b8794"];
const hashColor = (s) => {
  let h = 7;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
const textOn = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#0b0d10";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0b0d10" : "#ffffff";
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

const STYLE = `
  :host { display: block; height: 100%; }
  ha-card {
    display: flex; flex-direction: column; height: 100%;
    border-radius: var(--ha-card-border-radius, 12px);
    padding: 12px 14px 10px;
    box-sizing: border-box;
  }
  ha-card.compact { padding: 12px 12px 10px 10px; }
  ha-card.tappable { cursor: pointer; }
  .head { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
  .head svg { width: 18px; height: 18px; fill: var(--secondary-text-color, #9ca3af); }
  .head .t { font-size: 15px; font-weight: 600; letter-spacing: .01em; }
  .head .sub { margin-left: auto; font-size: 12px; color: var(--secondary-text-color, #9ca3af); white-space: nowrap; }
  .head .sub.warn { color: #fbbf24; }
  .rows { display: flex; flex-direction: column; gap: 8px; flex: 1 1 auto; min-height: 0; overflow: hidden; }
  .row { display: grid; grid-template-columns: 44px 1fr auto; grid-template-rows: auto auto; column-gap: 10px; row-gap: 3px; align-items: center; }
  .row.gone { opacity: .45; }
  .badge {
    grid-row: 1 / 3; width: 44px; height: 44px; border-radius: 12px;
    display: grid; place-items: center; font-weight: 800; font-size: 17px; color: var(--tc, #0b0d10);
    background: var(--lc, #7b8794); box-shadow: inset 0 -2px 0 rgba(0,0,0,.18);
    overflow: hidden; white-space: nowrap;
  }
  .badge.long { font-size: 13px; }
  .compact .row { grid-template-columns: 36px 1fr auto; column-gap: 8px; }
  .compact .badge { width: 36px; height: 38px; font-size: 15px; border-radius: 10px; }
  .compact .badge.long { font-size: 11px; }
  .dest { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .dest small { font-weight: 400; color: var(--secondary-text-color, #9ca3af); font-size: 12px; margin-left: 6px; }
  .time { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; line-height: 1.2; }
  .time .clock { font-size: 14px; font-weight: 700; }
  .time .clock.sched { opacity: .75; font-weight: 500; }
  .time .clock.cancel { text-decoration: line-through; color: #f87171; }
  .time .delay { font-size: 11px; font-weight: 700; color: #fbbf24; margin-left: 4px; }
  .time .delay.early { color: #60a5fa; }
  .time .in { font-size: 12px; color: var(--secondary-text-color, #9ca3af); }
  .rt { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; margin-right: 4px; vertical-align: 2px; animation: blink 2s infinite; }
  @keyframes blink { 50% { opacity: .35; } }

  .bar { grid-column: 2 / 4; position: relative; height: 22px; border-radius: 7px; background: rgba(127,127,127,.18); overflow: visible; }
  .compact .bar { height: 18px; }
  .inline .row { grid-template-rows: auto auto auto; row-gap: 2px; }
  .inline .badge { grid-row: 1 / 4; }
  .inline .dest { grid-column: 2; grid-row: 1; }
  .inline .time { grid-column: 3; grid-row: 1; }
  .inline .stop { grid-column: 2; grid-row: 2; font-size: 12px; color: var(--secondary-text-color, #9ca3af); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .inline .in { grid-column: 3; grid-row: 2; text-align: right; white-space: nowrap; font-size: 12px; color: var(--secondary-text-color, #9ca3af); font-variant-numeric: tabular-nums; }
  .inline .bar { grid-column: 2 / 4; grid-row: 3; height: var(--bar-h, 10px); border-radius: 5px; margin-top: 2px; }
  .inline .fill { border-radius: 5px; }
  .inline .lbl { display: none; }
  .inline .tick { width: 14px; height: 14px; }
  .inline .tick svg { width: 10px; height: 10px; }
  .inline .tick .tl { display: none; }
  .in b { color: var(--primary-text-color, #e5e7eb); font-weight: 700; white-space: nowrap; }
  .in b.now { color: #f87171; }
  .in b.soon { color: #fbbf24; }
  .in b svg, .in .bus svg { width: 12px; height: 12px; fill: currentColor; vertical-align: -2px; margin-right: 2px; }
  .in .bus { white-space: nowrap; }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; background: var(--fc, #43a047); transition: width .6s ease, background-color .6s ease; min-width: 0; }
  .lbl { position: absolute; left: 8px; top: 0; bottom: 0; display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #0b0d10; white-space: nowrap; }
  .lbl.out { color: var(--primary-text-color, #e5e7eb); }
  .lbl svg { width: 13px; height: 13px; fill: currentColor; }
  .compact .lbl { font-size: 11px; }
  .tick {
    position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%;
    transform: translate(-50%, -50%); background: #fff; display: grid; place-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,.5); transition: left .6s ease;
  }
  .tick svg { width: 13px; height: 13px; fill: #0b0d10; }
  .compact .tick { width: 16px; height: 16px; }
  .compact .tick svg { width: 11px; height: 11px; }
  .tick .tl { position: absolute; left: 100%; margin-left: 5px; top: 0; bottom: 0; display: flex; align-items: center; font-size: 11px; color: var(--secondary-text-color, #9ca3af); white-space: nowrap; }
  .tick.edge .tl { display: none; }
  .empty { color: var(--secondary-text-color, #9ca3af); font-size: 13px; padding: 6px 0; }
  .empty.err { color: #f87171; }
  .row.fresh .fill, .row.fresh .tick { transition: none; }
  .static .fill, .static .tick { transition: none; }
  .static .rt { animation: none; }
`;

const pad = (n) => String(n).padStart(2, "0");
const clock = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const shortId = (id) => String(id == null ? "" : id).split(":").pop();
const isEntityId = (v) => typeof v === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(v);

class BusBoardCard extends HTMLElement {
  static getStubConfig() {
    return {
      source: { provider: "entur", stops: [{ id: "NSR:StopPlace:58366", walk_min: 5 }] },
      title: "Jernbanetorget",
      max_rows: 5,
    };
  }

  static getConfigElement() {
    return document.createElement("bus-board-card-editor");
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.source)) throw new Error("bus-board-card: 'entity' or 'source' is required");
    if (config.source && !(config.source.stops || []).length) throw new Error("bus-board-card: source.stops must list at least one stop");
    this._config = {
      title: null,        // defaults to the localized "Departures"
      max_rows: 6,
      compact: false,
      scale_min: 20,
      show_stop: true,
      show_header: true,
      label: null,        // "bar" (text inside the bar) | "inline" (icons + minutes in the time column); compact defaults to inline
      bar_height: null,   // px, inline mode
      drop_after: 20,     // seconds a "too late" row stays before it is removed
      animations: true,   // false = no bar transitions and no blinking real-time dot (info screens)
      line_colors: {},    // line number -> badge colour (overrides provider colours)
      stop_labels: {},    // quay id -> label under the destination
      short_dest: null,   // true = "Kattem" instead of "Kattem via sentrum-Tiller" (inline default)
      language: null,     // en | nb | sv | de (default: Home Assistant user language)
      tap_action: null,
      ...config,
    };
    if (!this._config.label) this._config.label = this._config.compact ? "inline" : "bar";
    if (this._config.short_dest == null) this._config.short_dest = this._config.label === "inline";
    this._t = pickLanguage(this._config.language, this._hass);
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
    this._render();
    this._lastKey = null;
    this._rowEls = new Map();
    this._rowData = [];
    if (this.isConnected) this._startSource();
    this._draw();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._t = pickLanguage(this._config && this._config.language, hass);
      if (this._els && this._els.title && this._config && !this._config.title) this._els.title.textContent = this._t.title;
    }
    if (this._config && this._config.source) this._rebuildFromRaw();
    this._draw();
  }

  getCardSize() { return 1 + Math.min((this._config && this._config.max_rows) || 6, 6); }
  getGridOptions() { return { columns: 12, rows: Number(this._config && this._config.rows) || "auto", min_columns: 6 }; }

  connectedCallback() {
    if (!this._timer) this._timer = setInterval(() => this._tick(), 5000);
    if (!this._ro && this._els && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => { this._tick(); this._clip(); });
      this._ro.observe(this._els.rows);
    }
    this._startSource();
  }

  disconnectedCallback() {
    clearInterval(this._timer); this._timer = null;
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    this._stopSource();
  }

  /* ---------------- data: source mode ---------------- */

  _startSource() {
    const src = this._config && this._config.source;
    if (!src) return;
    const key = JSON.stringify({ p: src.provider || "entur", u: src.url, c: src.client_name, s: src.stops.map((s) => s.id), n: src.departures_per_stop, t: src.time_range });
    if (this._unsub && this._srcKey === key) return;
    this._stopSource();
    const provider = getProvider(src.provider || "entur");
    if (!provider) {
      this._error = new Error(`unknown provider "${src.provider}"`);
      this._draw();
      return;
    }
    this._srcKey = key;
    this._unsub = subscribe(key, () => provider.fetch(src), src.refresh, (raw, err, at) => {
      this._error = err || null;
      if (raw) { this._raw = raw; this._rawAt = at; }
      this._rebuildFromRaw(true);
      this._draw();
    });
  }

  _stopSource() {
    if (this._unsub) { this._unsub(); this._unsub = null; this._srcKey = null; }
  }

  // Resolve a number that may also be given as an entity id (input_number.*, sensor.*).
  _num(v, dflt) {
    if (v == null || v === "") return dflt;
    if (isEntityId(v)) {
      const st = this._hass && this._hass.states[v];
      const n = st ? Number(st.state) : NaN;
      return Number.isFinite(n) ? n : dflt;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
  }

  _watchTokens(src) {
    const toks = new Set();
    const add = (v) => {
      const arr = Array.isArray(v) ? v : String(v || "").split(",");
      for (const t of arr) { const s = String(t).replace(/\s+/g, "").toLowerCase(); if (s) toks.add(s); }
    };
    if (src.watch) add(src.watch);
    if (src.watch_entity) {
      const st = this._hass && this._hass.states[src.watch_entity];
      if (st && st.state && !["unknown", "unavailable"].includes(st.state)) add(st.state);
    }
    return toks;
  }

  // raw calls -> list entries; also re-run when watch tokens / walk minutes change.
  _rebuildFromRaw(force) {
    const src = this._config && this._config.source;
    if (!src || !this._raw) return;
    const buf = this._num(src.door_buffer_min, 0);
    const watch = this._watchTokens(src);
    const stops = src.stops.map((s) => ({
      ...s,
      walk: this._num(s.walk_min, 3),
      qwalk: Object.fromEntries(Object.entries(s.quay_walk_min || {}).map(([q, v]) => [shortId(q), this._num(v, null)])),
    }));
    const paramKey = JSON.stringify({ buf, w: [...watch].sort(), s: stops.map((s) => [s.walk, s.qwalk]) });
    if (!force && paramKey === this._paramKey) return;
    this._paramKey = paramKey;
    const byId = new Map(stops.map((s) => [String(s.id), s]));
    const list = [];
    for (const c of this._raw) {
      const s = byId.get(c.stop_id) || stops[0];
      const q = shortId(c.quay_id);
      const line = String(c.line);
      if (Array.isArray(s.quays) && s.quays.length && !s.quays.map(shortId).includes(q)) continue;
      if (Array.isArray(s.lines) && s.lines.length && !s.lines.map(String).includes(line)) continue;
      if ((s.exclude_lines || []).map(String).includes(line)) continue;
      if (watch.size && !watch.has(`${line.toLowerCase()}@${q}`)) continue;
      const exp = Date.parse(c.expected) / 1000;
      const aim = Date.parse(c.aimed || c.expected) / 1000;
      if (!Number.isFinite(exp)) continue;
      const walk = s.qwalk[q] != null ? s.qwalk[q] : s.walk;
      const leave = exp - (walk + buf) * 60;
      list.push({
        line, dest: c.dest || "", quay: q, stop: this._quayLabel(s, c, q),
        aimed: c.aimed, expected: c.expected, expected_ts: Math.round(exp),
        delay_min: Math.round((exp - aim) / 60), realtime: !!c.realtime, cancelled: !!c.cancelled,
        sj: c.sj, walk_min: walk, leave_at: new Date(leave * 1000).toISOString(), leave_ts: Math.round(leave),
        color: c.line_color || null, text_color: c.line_text_color || null,
      });
    }
    list.sort((a, b) => a.expected_ts - b.expected_ts);
    this._list = list;
    this._listStamp = `${this._rawAt}:${paramKey}`;
  }

  _quayLabel(s, c, q) {
    if (s.quay_labels && s.quay_labels[q] != null) return s.quay_labels[q];
    if (s.name) return s.name + (c.quay_code ? ` ${c.quay_code}` : "");
    const name = c.stop_name || "";
    if (c.quay_code) return `${name} ${c.quay_code}`.trim();
    const d = String(c.quay_desc || "").trim();
    return d ? `${name} · ${d}` : name;
  }

  /* ---------------- data: both modes ---------------- */

  _getList() {
    if (this._config.source) return this._list || [];
    const st = this._hass && this._hass.states[this._config.entity];
    return st && Array.isArray(st.attributes.list) ? st.attributes.list : [];
  }

  _dataKey() {
    if (this._config.source) return `${this._listStamp || "none"}:${(this._list || []).length}:${this._error ? "e" : ""}`;
    const st = this._hass && this._hass.states[this._config.entity];
    return st ? st.last_updated + ":" + (st.attributes.list || []).length : "none";
  }

  _rows() {
    const now = Date.now() / 1000;
    const dropAfter = Number(this._config.drop_after) || 0;
    // a row is "too late" once depIn < 60 % of the walk time; keep it drop_after seconds, then remove it
    const alive = (d) => (d.expected_ts - now) > (Number(d.walk_min) || 0) * 0.6 * 60 - dropAfter;
    return this._getList().filter(alive).sort((a, b) => a.expected_ts - b.expected_ts).slice(0, this._config.max_rows);
  }

  /* ---------------- rendering ---------------- */

  _render() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STYLE}</style>
      <ha-card class="${c.compact ? "compact" : ""}${c.label === "inline" ? " inline" : ""}${c.tap_action ? " tappable" : ""}${c.animations === false ? " static" : ""}" style="${c.bar_height ? `--bar-h:${parseInt(c.bar_height, 10)}px` : ""}">
        ${c.show_header ? `<div class="head">${svg(ICON_BUS)}<span class="t" id="title">${esc(c.title != null ? c.title : this._t.title)}</span><span class="sub" id="sub"></span></div>` : ""}
        <div class="rows" id="rows"></div>
      </ha-card>`;
    this._els = { rows: root.getElementById("rows"), sub: root.getElementById("sub"), title: root.getElementById("title"), card: root.querySelector("ha-card") };
    if (c.tap_action && c.tap_action.action && c.tap_action.action !== "none") {
      this._els.card.addEventListener("click", () => this._handleTap(c.tap_action));
    }
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this.isConnected && window.ResizeObserver) {
      this._ro = new ResizeObserver(() => { this._tick(); this._clip(); });
      this._ro.observe(this._els.rows);
    }
  }

  _handleTap(a) {
    if (a.action === "navigate") {
      history.pushState(null, "", a.navigation_path || "");
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    } else if (a.action === "url") {
      if (a.url_path) window.open(a.url_path, "_blank", "noopener");
    } else if (a.action === "more-info") {
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: a.entity || this._config.entity } }));
    } else {
      this.dispatchEvent(new CustomEvent("hass-action", { bubbles: true, composed: true, detail: { config: { tap_action: a, entity: this._config.entity }, action: "tap" } }));
    }
  }

  _colors(d) {
    const bg = (this._config.line_colors || {})[String(d.line)] || d.color || hashColor(d.line);
    const tc = (this._config.line_colors || {})[String(d.line)] ? textOn(bg) : d.text_color || textOn(bg);
    return { bg, tc };
  }

  // Full rebuild when the data changes; _tick only updates times/bars.
  _draw() {
    if (!this._els || (!this._hass && !this._config.source)) return;
    const key = this._dataKey();
    if (key === this._lastKey) { this._tick(); return; }
    this._lastKey = key;
    const rows = this._rows();
    if (!rows.length) {
      let msg, cls = "empty";
      if (this._config.source) {
        if (this._error && !this._raw) { msg = this._t.error(this._error.message || String(this._error)); cls += " err"; }
        else if (!this._raw) msg = this._t.loading;
        else msg = this._t.no_departures;
      } else {
        const st = this._hass && this._hass.states[this._config.entity];
        msg = st ? this._t.no_departures : this._t.no_data(this._config.entity);
      }
      this._els.rows.innerHTML = `<div class="${cls}">${esc(msg)}</div>`;
      this._rowEls = new Map(); this._rowData = [];
      if (this._els.sub) this._els.sub.textContent = "";
      return;
    }
    // Reconcile instead of rebuilding: rows are keyed by journey, reused and only
    // patched. Rebuilding made every bar restart its width animation from zero on
    // each refresh, which reads as flicker on a big screen.
    const cont = this._els.rows;
    if (cont.firstElementChild && cont.firstElementChild.classList.contains("empty")) cont.innerHTML = "";
    const old = this._rowEls || new Map();
    const next = new Map();
    rows.forEach((d, i) => {
      const k = `${d.sj || ""}|${d.quay}|${d.line}|${d.aimed}`;
      let el = old.get(k);
      if (!el) {
        el = document.createElement("div");
        el.className = "row fresh";               // "fresh" = no transitions until placed once
        const { bg, tc } = this._colors(d);
        el.style.setProperty("--lc", bg);
        el.style.setProperty("--tc", tc);
        el.innerHTML = this._rowInner(d);
      } else {
        this._patchRow(el, d);
      }
      next.set(k, el);
      const cur = cont.children[i];
      if (cur !== el) cont.insertBefore(el, cur || null);
    });
    for (const [k, el] of old) if (!next.has(k)) el.remove();
    this._rowEls = next;
    this._rowData = rows;
    this._tick();
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const el of next.values()) el.classList.remove("fresh"); }));
    clearTimeout(this._settle);
    this._settle = setTimeout(() => { this._tick(); this._clip(); }, 700);
    this._clip();
  }

  _clockClass(d) { return "clock " + (d.cancelled ? "cancel" : d.realtime ? "" : "sched"); }

  _rowInner(d) {
    const inline = this._config.label === "inline";
    const stop = (this._config.stop_labels || {})[String(d.quay)] || d.stop || "";
    const dest = this._config.short_dest ? String(d.dest || "").replace(/\s+via\s.*$/i, "") : (d.dest || "");
    const clockHtml = `<span class="rt" ${d.realtime ? "" : "hidden"}></span><span class="${this._clockClass(d)}">${clock(d.expected)}</span><span class="delay"></span>`;
    const bar = `<div class="bar"><div class="fill"><div class="lbl"></div></div><div class="tick">${svg(ICON_BUS)}<span class="tl"></span></div></div>`;
    const badge = `<div class="badge${String(d.line).length > 3 ? " long" : ""}">${esc(d.line)}</div>`;
    if (inline) {
      return `
        ${badge}
        <div class="dest" title="${esc(d.dest)}">${esc(dest)}</div>
        <div class="time">${clockHtml}</div>
        <div class="stop">${esc(stop)}</div>
        <div class="in"></div>
        ${bar}`;
    }
    return `
        ${badge}
        <div class="dest" title="${esc(d.dest)}">${esc(dest)}${this._config.show_stop ? `<small>${esc(stop)} · ${esc(this._t.walk(d.walk_min))}</small>` : ""}</div>
        <div class="time">
          <div>${clockHtml}</div>
          <div class="in"></div>
        </div>
        ${bar}`;
  }

  // Same journey, new data (usually just a shifted real-time estimate): touch only what changed.
  _patchRow(el, d) {
    const c = el.querySelector(".clock");
    const txt = clock(d.expected), cls = this._clockClass(d);
    if (c.textContent !== txt) c.textContent = txt;
    if (c.className !== cls) c.className = cls;
    const rt = el.querySelector(".rt");
    if (rt.hidden === !!d.realtime) rt.hidden = !d.realtime;
  }

  // In a height-limited card (info screen) hide rows that do not fit completely.
  _clip() {
    const cont = this._els && this._els.rows;
    if (!cont) return;
    const limit = cont.clientHeight;
    const constrained = cont.scrollHeight > limit + 1;
    for (const el of cont.children) {
      const over = constrained && el.offsetTop - cont.offsetTop + el.offsetHeight > limit + 1;
      if (el._clipped !== over) { el.style.visibility = over ? "hidden" : ""; el._clipped = over; }
    }
  }

  _tick() {
    if (!this._els || !this._rowData) return;
    const t = this._t;
    const now = Date.now() / 1000;
    const dropAfter = Number(this._config.drop_after) || 0;
    if (this._rowData.some((d) => (d.expected_ts - now) <= (Number(d.walk_min) || 0) * 0.6 * 60 - dropAfter)) {
      this._lastKey = null; this._draw(); return;   // a row expired: rebuild the list
    }
    const inline = this._config.label === "inline";
    const scale = Math.max(5, Number(this._config.scale_min) || 20);
    const els = this._els.rows.querySelectorAll(".row");
    let nextLeave = null;
    els.forEach((row, i) => {
      const d = this._rowData[i];
      if (!d) return;
      const depIn = (d.expected_ts - now) / 60;      // minutes until the bus leaves the stop
      const leaveIn = (d.leave_ts - now) / 60;       // minutes until you must leave the house
      const walk = Number(d.walk_min) || 0;
      const gone = depIn <= 0;
      row.classList.toggle("gone", gone || !!d.cancelled);

      // right column
      const delayEl = row.querySelector(".delay");
      const dm = Number(d.delay_min) || 0;
      delayEl.textContent = dm > 0 ? `+${dm}` : dm < 0 ? `${dm}` : "";
      delayEl.classList.toggle("early", dm < 0);
      const busTxt = d.cancelled ? t.cancelled : gone ? t.gone : depIn < 1 ? t.now : t.in_min(Math.round(depIn));
      const inEl = row.querySelector(".in");
      if (!inline) inEl.textContent = busTxt;

      // bar
      const fill = row.querySelector(".fill");
      const lbl = row.querySelector(".lbl");
      const tick = row.querySelector(".tick");
      const tl = row.querySelector(".tl");
      const depPct = Math.max(0, Math.min(100, (depIn / scale) * 100));
      const edge = depPct >= 97;
      tick.style.left = edge ? "calc(100% - 9px)" : `${depPct}%`;
      tick.classList.toggle("edge", edge);
      tl.textContent = depIn > 0 && depPct < 85 ? t.min(Math.round(depIn)) : "";
      let color, text, icon = ICON_WALK, pct;
      if (d.cancelled) {
        color = "#6b7280"; text = t.cancelled; pct = 0;
      } else if (leaveIn > 0) {
        pct = Math.max(0, Math.min(100, (leaveIn / scale) * 100));
        color = leaveIn <= 1 ? "#d32f2f" : leaveIn <= 3 ? "#f9a825" : "#43a047";
        text = leaveIn < 1 ? t.leave_now : t.leave_in(Math.round(leaveIn));
      } else if (depIn > walk * 0.6) {
        // leave-time passed but a brisk pace still makes it
        pct = 0; color = "#d32f2f"; text = t.run; icon = ICON_RUN;
      } else if (depIn > 0) {
        pct = 0; color = "#6b7280"; text = t.too_late; icon = ICON_RUN;
      } else {
        pct = 0; color = "#6b7280"; text = t.gone;
      }
      fill.style.width = pct > 0 ? `max(${pct}%, 8px)` : "0";
      fill.style.setProperty("--fc", color);
      lbl.classList.toggle("out", pct < 40);
      lbl.innerHTML = `${svg(icon)}<span>${esc(text)}</span>`;
      if (inline) {
        // icons only: [walker] 2 min · [bus] 6 min
        const cls = d.cancelled || gone ? "" : leaveIn <= 1 ? "now" : leaveIn <= 3 ? "soon" : "";
        const leaveShort = d.cancelled ? "" : leaveIn > 0 ? (leaveIn < 1 ? t.now : t.min(Math.round(leaveIn))) : text;
        const busShort = d.cancelled ? t.cancelled : gone ? t.gone : depIn < 1 ? t.now : t.min(Math.round(depIn));
        inEl.innerHTML = d.cancelled ? esc(t.cancelled) : `<b class="${cls}">${svg(icon)}${esc(leaveShort)}</b> · <span class="bus">${svg(ICON_BUS)}${esc(busShort)}</span>`;
      }
      // Place the label, dodging the bus marker (and its "N min" tag) if they would overlap.
      const bar = row.querySelector(".bar");
      const barW = bar.clientWidth;
      let left = pct < 40 ? (pct / 100) * barW + 8 : 8;
      if (barW > 0) {
        const lw = lbl.offsetWidth || 80;
        const tickPx = edge ? barW - 9 : (depPct / 100) * barW;
        const tickEnd = tickPx + 9 + (tl.textContent ? tl.offsetWidth + 5 : 0);
        if (left - 6 < tickEnd && left + lw + 6 > tickPx - 9) {
          const after = tickEnd + 6;
          const before = tickPx - 9 - 6 - lw;
          left = after + lw <= barW - 4 ? after : Math.max(4, before);
        }
        left = Math.min(left, Math.max(4, barW - lw - 4));
      }
      lbl.style.left = `${Math.round(left)}px`;
      if (nextLeave == null && !d.cancelled && !gone && leaveIn > -0.5) nextLeave = leaveIn;
    });
    if (this._els.sub) {
      let txt = nextLeave == null ? "" : nextLeave < 1 ? t.next_leave_now : t.next_leave_in(Math.round(nextLeave));
      const stale = this._config.source && this._error && this._raw;
      if (stale) txt = `⚠ ${t.offline}${txt ? " · " + txt : ""}`;
      this._els.sub.textContent = txt;
      this._els.sub.classList.toggle("warn", !!stale);
    }
  }
}

if (!customElements.get("bus-board-card")) customElements.define("bus-board-card", BusBoardCard);
if (!customElements.get("bus-board-card-editor")) customElements.define("bus-board-card-editor", BusBoardCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "bus-board-card",
  name: "Bus Board Card",
  description: "Upcoming departures with leave-the-house countdown bars (Entur or any HA sensor)",
  preview: false,
  documentationURL: "https://github.com/andersgar/bus-board-card",
});
console.info(`%c BUS-BOARD-CARD %c ${VERSION} `, "color: #0b0d10; background: #f2a900; font-weight: 700;", "color: #f2a900; background: #0b0d10;");
