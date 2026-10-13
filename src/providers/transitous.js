// Transitous (https://transitous.org) — a community-run MOTIS instance with
// GTFS(-RT) feeds from most of the world. No key, CORS open.
// Terms: free for open-source / non-commercial use; identify yourself and link
// https://transitous.org/sources/ somewhere. Stop ids are feed-prefixed, e.g.
// "no-Entur_NSR:StopPlace:60447", "de-DELFI_de:08111:6115" — look them up with
// https://api.transitous.org/api/v1/geocode?text=<name>&type=STOP
// API: https://raw.githubusercontent.com/motis-project/motis/master/openapi.yaml

const DEFAULT_URL = "https://api.transitous.org/api/v6/stoptimes";

export default {
  id: "transitous",
  async fetch(src) {
    const base = src.url || DEFAULT_URL;
    const n = Number(src.departures_per_stop) || 40;
    const stops = src.stops || [];
    const results = await Promise.all(stops.map(async (s) => {
      const u = new URL(base);
      u.searchParams.set("stopId", String(s.id));
      u.searchParams.set("n", String(n));
      if (src.time_range) u.searchParams.set("window", String(Math.round(Number(src.time_range) / 60)));
      const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return [s, await r.json()];
    }));
    const out = [];
    for (const [s, j] of results) {
      for (const st of j.stopTimes || []) {
        const p = st.place || {};
        out.push({
          stop_id: String(s.id),
          stop_name: p.name || "",
          quay_id: p.stopId || "",
          quay_code: p.track || p.scheduledTrack || null,
          quay_desc: null,
          line: st.routeShortName || st.displayName || "?",
          line_color: st.routeColor ? `#${String(st.routeColor).replace(/^#/, "")}` : null,
          line_text_color: st.routeTextColor ? `#${String(st.routeTextColor).replace(/^#/, "")}` : null,
          dest: st.headsign || "",
          aimed: p.scheduledDeparture || p.departure,
          expected: p.departure || p.scheduledDeparture,
          realtime: !!st.realTime,
          cancelled: !!(st.cancelled || st.tripCancelled || p.cancelled),
          sj: st.tripId || null,
        });
      }
    }
    return out;
  },
};
