// Provider registry. A provider is { id, fetch(source) -> Promise<Call[]> }
// where Call = { stop_id, stop_name, quay_id, quay_code, quay_desc, line,
// line_color, line_text_color, dest, aimed, expected, realtime, cancelled, sj }
// (times as ISO strings). Third-party providers can be registered at runtime
// from another dashboard resource, no fork needed:
//   window.busBoardProviders = window.busBoardProviders || {};
//   window.busBoardProviders.myapi = { id: "myapi", fetch: async (src) => [...] };
import entur from "./entur.js";
import transitous from "./transitous.js";

const builtin = { entur, "otp-transmodel": entur, transitous };

const external = () => (typeof window !== "undefined" && window.busBoardProviders) || {};

export function getProvider(name) {
  return external()[name] || builtin[name] || null;
}

export const providerNames = () => Object.keys({ ...builtin, ...external() });
