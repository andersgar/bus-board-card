// Visual editor for bus-board-card, shown in the dashboard card editor.
// Built on Home Assistant's own <ha-form> (selectors, entity pickers,
// switches); the list of stops uses a small custom list editor.
import { EDITOR, pickEditorLanguage } from "./i18n.js";

const LANGS = [
  { value: "", label: "Home Assistant" }, { value: "en", label: "English" }, { value: "nb", label: "Norsk" },
  { value: "sv", label: "Svenska" }, { value: "de", label: "Deutsch" },
];

const STYLE = `
  :host { display: block; }
  h3 { font-size: 14px; font-weight: 600; margin: 20px 0 6px; color: var(--primary-text-color); }
  h3:first-child { margin-top: 0; }
  p.help { margin: 0 0 10px; font-size: 12px; color: var(--secondary-text-color); }
  .stop { border: 1px solid var(--divider-color, #444); border-radius: 10px; padding: 10px 12px 6px; margin: 0 0 10px; }
  .stop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-weight: 500; }
  button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--divider-color, #444);
    background: var(--card-background-color, #222); color: var(--primary-text-color); cursor: pointer; }
  button.danger { color: #f87171; }
  button.add { margin-top: 2px; }
  .modes { display: flex; gap: 8px; margin-bottom: 10px; }
  .modes button[aria-pressed="true"] { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
`;

// The dashboard editor already loads ha-form, but a card editor can be opened
// before that import finishes; creating a core card editor forces it.
async function ensureHaForm() {
  if (customElements.get("ha-form")) return;
  try {
    const helpers = await window.loadCardHelpers();
    const el = helpers.createCardElement({ type: "entities", entities: [] });
    if (el && el.constructor && el.constructor.getConfigElement) await el.constructor.getConfigElement();
  } catch (e) { /* ignore: ha-form will appear once the editor loads */ }
  await customElements.whenDefined("ha-form");
}

const listToText = (v) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
const textToList = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const numOrEntity = (v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : String(v);
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export class BusBoardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!this._config.source && !this._config.entity) this._config.entity = "";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._t = pickEditorLanguage(hass);
    if (this.shadowRoot) for (const f of this.shadowRoot.querySelectorAll("ha-form")) f.hass = hass;
  }

  get _mode() { return this._config.source ? "source" : "entity"; }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  async _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._t = this._t || pickEditorLanguage(this._hass);
    await ensureHaForm();
    if (this._rendering) return;
    this._rendering = true;
    const t = this._t;
    const root = this.shadowRoot;
    root.innerHTML = `<style>${STYLE}</style>
      <h3>${t.section_data}</h3>
      <div class="modes">
        <button id="m-entity" aria-pressed="${this._mode === "entity"}">${t.mode_entity}</button>
        <button id="m-source" aria-pressed="${this._mode === "source"}">${t.mode_source}</button>
      </div>
      <div id="data"></div>
      <h3>${t.section_display}</h3>
      <div id="display"></div>
      <h3>${t.section_advanced}</h3>
      <p class="help">${t.advanced_help}</p>
      <div id="advanced"></div>`;
    root.getElementById("m-entity").addEventListener("click", () => this._switchMode("entity"));
    root.getElementById("m-source").addEventListener("click", () => this._switchMode("source"));
    this._renderData(root.getElementById("data"));
    this._renderDisplay(root.getElementById("display"));
    this._renderAdvanced(root.getElementById("advanced"));
    this._rendering = false;
  }

  _switchMode(mode) {
    if (mode === this._mode) return;
    if (mode === "entity") {
      this._savedSource = this._config.source;
      delete this._config.source;
      this._config.entity = this._savedEntity || "";
    } else {
      this._savedEntity = this._config.entity;
      delete this._config.entity;
      this._config.source = this._savedSource || { provider: "entur", stops: [{ id: "", walk_min: 5 }] };
    }
    this._emit();
    this._render();
  }

  _form(container, schema, data, onChange) {
    const f = document.createElement("ha-form");
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => this._t.labels[s.name] || s.name;
    f.computeHelper = (s) => this._t.helpers[s.name] || "";
    f.addEventListener("value-changed", (ev) => { ev.stopPropagation(); onChange(ev.detail.value); });
    container.appendChild(f);
    return f;
  }

  _renderData(el) {
    const t = this._t;
    if (this._mode === "entity") {
      this._form(el, [{ name: "entity", required: true, selector: { entity: { domain: "sensor" } } }], { entity: this._config.entity || "" }, (v) => {
        this._config.entity = v.entity || "";
        this._emit();
      });
      return;
    }
    const src = this._config.source;
    const schema = [
      { type: "grid", name: "", schema: [
        { name: "provider", selector: { select: { mode: "dropdown", custom_value: true, options: [
          { value: "entur", label: "Entur (Norway / OTP Transmodel)" }, { value: "transitous", label: "Transitous (worldwide)" }] } } },
        { name: "refresh", selector: { number: { min: 10, max: 600, mode: "box", unit_of_measurement: "s" } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "door_buffer_min", selector: { text: {} } },
        { name: "watch_entity", selector: { entity: { domain: ["input_text", "sensor"] } } },
      ] },
      { name: "watch", selector: { text: {} } },
      { name: "url", selector: { text: {} } },
    ];
    const data = { ...src, watch: listToText(src.watch), door_buffer_min: src.door_buffer_min == null ? "" : String(src.door_buffer_min) };
    delete data.stops;
    this._form(el, schema, data, (v) => {
      const keep = this._config.source.stops;
      this._config.source = clean({ ...this._config.source, ...v, watch: textToList(v.watch).length ? textToList(v.watch) : undefined, door_buffer_min: numOrEntity(v.door_buffer_min), stops: keep });
      this._emit();
    });
    const h = document.createElement("h3"); h.textContent = t.section_stops; el.appendChild(h);
    const help = document.createElement("p"); help.className = "help"; help.textContent = t.stops_help; el.appendChild(help);
    this._stopsEl = document.createElement("div"); el.appendChild(this._stopsEl);
    this._renderStops();
  }

  _renderStops() {
    const t = this._t;
    const el = this._stopsEl;
    el.innerHTML = "";
    const stops = this._config.source.stops || [];
    const schema = [
      { type: "grid", name: "", schema: [
        { name: "id", required: true, selector: { text: {} } },
        { name: "name", selector: { text: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "walk_min", selector: { text: {} } },
        { name: "lines", selector: { text: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "quays", selector: { text: {} } },
        { name: "exclude_lines", selector: { text: {} } },
      ] },
    ];
    stops.forEach((s, i) => {
      const box = document.createElement("div"); box.className = "stop";
      const head = document.createElement("div"); head.className = "stop-head";
      head.innerHTML = `<span>${t.stop} ${i + 1}</span>`;
      const rm = document.createElement("button"); rm.className = "danger"; rm.textContent = t.remove;
      rm.addEventListener("click", () => { stops.splice(i, 1); this._emit(); this._renderStops(); });
      head.appendChild(rm); box.appendChild(head);
      const data = { id: s.id || "", name: s.name || "", walk_min: s.walk_min == null ? "" : String(s.walk_min), lines: listToText(s.lines), quays: listToText(s.quays), exclude_lines: listToText(s.exclude_lines) };
      this._form(box, schema, data, (v) => {
        const extra = Object.fromEntries(Object.entries(s).filter(([k]) => !(k in data)));
        stops[i] = clean({ ...extra, id: v.id, name: v.name, walk_min: numOrEntity(v.walk_min),
          lines: textToList(v.lines).length ? textToList(v.lines) : undefined,
          quays: textToList(v.quays).length ? textToList(v.quays) : undefined,
          exclude_lines: textToList(v.exclude_lines).length ? textToList(v.exclude_lines) : undefined });
        this._emit();
      });
      el.appendChild(box);
    });
    const add = document.createElement("button"); add.className = "add"; add.textContent = t.add_stop;
    add.addEventListener("click", () => { stops.push({ id: "", walk_min: 5 }); this._config.source.stops = stops; this._emit(); this._renderStops(); });
    el.appendChild(add);
  }

  _renderDisplay(el) {
    const c = this._config;
    const schema = [
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "language", selector: { select: { mode: "dropdown", options: LANGS } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "max_rows", selector: { number: { min: 1, max: 30, mode: "box" } } },
        { name: "scale_min", selector: { number: { min: 5, max: 120, mode: "box", unit_of_measurement: "min" } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "compact", selector: { boolean: {} } },
        { name: "label", selector: { select: { mode: "dropdown", options: [
          { value: "", label: this._t.auto }, { value: "bar", label: this._t.label_bar }, { value: "inline", label: this._t.label_inline }] } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "show_header", selector: { boolean: {} } },
        { name: "show_stop", selector: { boolean: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "short_dest", selector: { select: { mode: "dropdown", options: [
          { value: "", label: this._t.auto }, { value: "true", label: this._t.yes }, { value: "false", label: this._t.no }] } } },
        { name: "animations", selector: { boolean: {} } },
      ] },
      { name: "tap_action", selector: { ui_action: {} } },
    ];
    const data = {
      title: c.title ?? "", language: c.language || "", max_rows: c.max_rows ?? 6, scale_min: c.scale_min ?? 20,
      compact: !!c.compact, label: c.label || "", show_header: c.show_header !== false, show_stop: c.show_stop !== false,
      short_dest: c.short_dest == null ? "" : String(!!c.short_dest), animations: c.animations !== false, tap_action: c.tap_action,
    };
    this._form(el, schema, data, (v) => {
      const out = { ...this._config };
      const set = (k, val, dflt) => { if (val === dflt || val === "" || val == null) delete out[k]; else out[k] = val; };
      set("title", v.title, "");
      set("language", v.language, "");
      set("max_rows", v.max_rows, 6);
      set("scale_min", v.scale_min, 20);
      set("compact", v.compact, false);
      set("label", v.label, "");
      set("show_header", v.show_header, true);
      set("show_stop", v.show_stop, true);
      set("short_dest", v.short_dest === "" ? null : v.short_dest === "true", null);
      set("animations", v.animations, true);
      set("tap_action", v.tap_action && v.tap_action.action && v.tap_action.action !== "none" ? v.tap_action : null, null);
      this._config = out;
      this._emit();
    });
  }

  _renderAdvanced(el) {
    const c = this._config;
    const schema = [
      { type: "grid", name: "", schema: [
        { name: "drop_after", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
        { name: "bar_height", selector: { number: { min: 4, max: 40, mode: "box", unit_of_measurement: "px" } } },
      ] },
      { name: "line_colors", selector: { object: {} } },
      { name: "stop_labels", selector: { object: {} } },
    ];
    const data = { drop_after: c.drop_after ?? 20, bar_height: c.bar_height ?? 10, line_colors: c.line_colors || {}, stop_labels: c.stop_labels || {} };
    this._form(el, schema, data, (v) => {
      const out = { ...this._config };
      if (v.drop_after === 20 || v.drop_after == null) delete out.drop_after; else out.drop_after = v.drop_after;
      if (v.bar_height === 10 || v.bar_height == null) delete out.bar_height; else out.bar_height = v.bar_height;
      for (const k of ["line_colors", "stop_labels"]) {
        if (v[k] && typeof v[k] === "object" && Object.keys(v[k]).length) out[k] = v[k]; else delete out[k];
      }
      this._config = out;
      this._emit();
    });
  }
}

export { EDITOR };
