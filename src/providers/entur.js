// Entur JourneyPlanner v3 (Norway, every operator) — an OpenTripPlanner
// "Transmodel" GraphQL API. Any other OTP deployment that exposes the same
// Transmodel API works by setting `url:` in the source block.
// Docs: https://developer.entur.org/pages-journeyplanner-journeyplanner
// Terms: free, NLOD licence, identify yourself with the ET-Client-Name header.

const DEFAULT_URL = "https://api.entur.io/journey-planner/v3/graphql";
const DEFAULT_CLIENT = "homeassistant-bus-board-card";

const FRAGMENT = `fragment c on EstimatedCall {
  quay { id publicCode description }
  realtime cancellation aimedDepartureTime expectedDepartureTime
  destinationDisplay { frontText }
  serviceJourney { id line { publicCode presentation { colour textColour } } }
}`;

export default {
  id: "entur",
  async fetch(src) {
    const url = src.url || DEFAULT_URL;
    const n = Number(src.departures_per_stop) || 40;
    const tr = Number(src.time_range) || 5400;
    const stops = src.stops || [];
    const parts = stops.map((s, i) => {
      const isQuay = /:Quay:/i.test(String(s.id));
      return `s${i}: ${isQuay ? "quay" : "stopPlace"}(id: ${JSON.stringify(String(s.id))}) { id name estimatedCalls(numberOfDepartures: ${n}, timeRange: ${tr}) { ...c } }`;
    });
    const query = `{ ${parts.join("\n")} }\n${FRAGMENT}`;
    // ET-Client-Name is Entur's own convention; other OTP instances may reject
    // unknown headers in the CORS preflight, so only send it to Entur by default.
    const headers = { "Content-Type": "application/json" };
    if (src.client_name || /entur\.io$/i.test(new URL(url).hostname)) headers["ET-Client-Name"] = src.client_name || DEFAULT_CLIENT;
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.errors && j.errors.length) throw new Error(j.errors[0].message || "GraphQL error");
    const out = [];
    stops.forEach((s, i) => {
      const sp = j.data && j.data[`s${i}`];
      if (!sp) return;
      for (const c of sp.estimatedCalls || []) {
        const line = (c.serviceJourney && c.serviceJourney.line) || {};
        const pres = line.presentation || {};
        out.push({
          stop_id: String(s.id),
          stop_name: sp.name || "",
          quay_id: c.quay ? c.quay.id : "",
          quay_code: c.quay ? c.quay.publicCode : null,
          quay_desc: c.quay ? c.quay.description : null,
          line: line.publicCode || "?",
          line_color: pres.colour ? `#${pres.colour}` : null,
          line_text_color: pres.textColour ? `#${pres.textColour}` : null,
          dest: (c.destinationDisplay && c.destinationDisplay.frontText) || "",
          aimed: c.aimedDepartureTime,
          expected: c.expectedDepartureTime || c.aimedDepartureTime,
          realtime: !!c.realtime,
          cancelled: !!c.cancellation,
          sj: c.serviceJourney ? c.serviceJourney.id : null,
        });
      }
    });
    return out;
  },
};
