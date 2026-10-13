# Data providers

The card can get departures in two ways:

1. **Source mode** – the card itself calls a public API from the browser.
   Needs an API that (a) has no key, or a key you are happy to put in a
   dashboard, and (b) sends CORS headers so a browser may call it.
2. **Entity mode** – Home Assistant fetches the data (a `rest:` sensor or an
   integration) and a template sensor reshapes it into the card's list format.
   Works with any API, keyed or not, CORS or not. See
   [home-assistant-sensors.md](home-assistant-sensors.md).

Everything below was checked on 2026-10-13 by actually calling the APIs.

## Built-in providers

### `entur` – Norway, all operators

- Endpoint `https://api.entur.io/journey-planner/v3/graphql` (OpenTripPlanner
  "Transmodel" GraphQL API). No key; Entur asks for an `ET-Client-Name` header,
  which the card sends. CORS open. NLOD licence.
- Real-time expected times, cancellations, quays, line colours
  (`presentation.colour`, used for the badge when the operator publishes them —
  Ruter does, AtB does not).
- Stop ids: `NSR:StopPlace:60447` (all platforms) or `NSR:Quay:103009` (one
  platform). Look up on [stoppested.entur.org](https://stoppested.entur.org) or
  with the geocoder `https://api.entur.io/geocoder/v1/autocomplete?text=<name>&layers=venue`.
- Any other OpenTripPlanner 2 deployment that enables the Transmodel API works
  with `url:`; the card sends `ET-Client-Name` only to `*.entur.io` unless
  `client_name` is set, because other servers may reject unknown headers in the
  CORS preflight. No other *public* Transmodel endpoint was found; Entur is the
  reference deployment.

### `transitous` – most of the world

- Endpoint `https://api.transitous.org/api/v6/stoptimes?stopId=…&n=…`
  ([Transitous](https://transitous.org), a community MOTIS instance loading
  GTFS and GTFS-RT feeds from Europe, the Americas, Asia and Oceania; the
  Norwegian data is the same Entur feed, with real-time).
- No key, CORS open. **Policy:** free for open-source and non-commercial use;
  best effort; be reasonable with the polling interval (30 s per dashboard is
  fine, do not run it on a public signage network); link
  [their sources page](https://transitous.org/sources/).
- Stop ids are feed-prefixed. Geocode with
  `https://api.transitous.org/api/v1/geocode?text=<name>&type=STOP`, e.g.
  `de-VBB_de:11000:900100003` (Berlin Alexanderplatz), `se-Trafiklab_740000001`
  (Stockholm C), `no-Entur_NSR:StopPlace:60447`.
- Fields used: `place.departure` / `scheduledDeparture`, `realTime`,
  `cancelled`, `headsign`, `routeShortName`, `routeColor`, `place.track` (as
  the quay code), `place.stopId` (as the quay id, so `quays:` filters work with
  e.g. `no-Entur_NSR:Quay:103009`).

## Other key-free, browser-friendly APIs (not built in yet)

These were verified to work without a key and with CORS. Each needs a ~30-line
provider (see *Adding a provider* below); contributions welcome.

| Region | API | Notes |
|---|---|---|
| Stockholm | SL Transport `https://transport.integration.sl.se/v1/sites/{siteId}/departures` | `scheduled`, `expected`, `destination`, `line.designation`, `stop_point.designation` (platform). No key, no quota beyond "be reasonable". |
| Switzerland | `https://transport.opendata.ch/v1/stationboard?station=Bern&limit=10` | `stop.departure`, `stop.prognosis.departure`, `stop.platform`, `number`, `to`. Do **not** send custom headers (preflight fails). ~1000 req/day guideline. |
| Belgium (trains) | iRail `https://api.irail.be/v1/liveboard/?id=…&format=json` | `time`, `delay` (s), `canceled`, `platform`, `vehicleinfo.shortname`. 3 req/s per IP. |
| London | TfL `https://api.tfl.gov.uk/StopPoint/{naptan}/Arrivals` | Predictions only (`expectedArrival`, `timeToStation`, `lineName`, `destinationName`, `platformName`); no scheduled time, cancellations simply vanish. 50 req/min anonymous. |
| Germany (regional) | transport.rest (`v6.db` / `v6.vbb` / `v6.bvg`) | Designed for browsers, no key, but all instances returned 503 in October 2026 after Deutsche Bahn closed the HAFAS backend. Transitous covers Germany (DELFI, VBB, …) instead. |

## APIs that need a key or block browsers → entity mode

| Region | API | Why entity mode |
|---|---|---|
| Finland | Digitransit routing API (OTP GTFS GraphQL) | `digitransit-subscription-key` required since 2024 (free registration). CORS is open, so a provider with the key in the dashboard would also work. Transitous has Finland too. |
| Sweden (nationwide) | Trafiklab ResRobot / Realtime APIs | Key required. Transitous loads Trafiklab's GTFS, so `transitous` is the easier route. |
| Denmark | Rejseplanen | Key required (free, request form); the old open API was closed in 2024. Use the core `rejseplanen` integration or Transitous. |
| Netherlands | OVapi | HTTP only and no CORS. Transitous (OpenOV) works. |
| Hamburg | HVV | Credentials required; core `hvv_departures` integration exposes `next[]`. |
| Australia (NSW) | Transport NSW | Key required; core `transport_nsw` integration. |

Home Assistant integrations whose attributes can be reshaped with a template
into the card's list: core `entur_public_transport` (only next two departures),
`hvv_departures` (`next[]` with `departure`, `line`, `direction`, `delay`),
`nmbs`, `rmv` (`next_departures[]`), HACS
[`db_infoscreen`](https://github.com/FaserF/ha-db_infoscreen)
(`next_departures[]` with `scheduledDeparture`, `delayDeparture`, `train`,
`destination`, `isCancelled`, `platform`; ~50 German and international
backends, no key) and HACS
[`openpublictransport`](https://github.com/NerdySoftPaw/openpublictransport)
(38 providers). For the static `gtfs` integration there is no real-time data,
so the bars would only ever be scheduled.

## Adding a provider

A provider is an object with an `id` and an async `fetch(source)` that returns
an array of calls:

```js
{
  stop_id: "…",        // the id from source.stops[].id this call belongs to
  stop_name: "…",
  quay_id: "…",        // platform id; the part after the last ":" is matched against source.stops[].quays
  quay_code: "A",      // platform code shown after the stop name (optional)
  quay_desc: null,
  line: "22",
  line_color: "#f2a900", line_text_color: "#0b0d10",   // optional
  dest: "Vestlia via sentrum",
  aimed: "2026-10-13T15:12:00+02:00",     // scheduled, ISO 8601
  expected: "2026-10-13T15:13:40+02:00",  // real-time estimate (= aimed if none)
  realtime: true,
  cancelled: false,
  sj: "unique journey id (used to keep rows stable between refreshes)",
}
```

Register it from any other dashboard resource (a small JS module you add under
`/local/`), no fork needed:

```js
window.busBoardProviders = window.busBoardProviders || {};
window.busBoardProviders.sl = {
  id: "sl",
  async fetch(src) {
    const out = [];
    for (const s of src.stops) {
      const r = await fetch(`https://transport.integration.sl.se/v1/sites/${s.id}/departures?forecast=90`);
      const j = await r.json();
      for (const d of j.departures) out.push({
        stop_id: String(s.id), stop_name: d.stop_point?.name || "", quay_id: String(d.stop_point?.id || ""),
        quay_code: d.stop_point?.designation || null, line: d.line?.designation || "?",
        dest: d.destination || "", aimed: d.scheduled, expected: d.expected || d.scheduled,
        realtime: !!d.expected, cancelled: d.state === "CANCELLED" || d.journey?.state === "CANCELLED",
        sj: String(d.journey?.id || ""),
      });
    }
    return out;
  },
};
```

Then `source: { provider: sl, stops: [{ id: 9001, walk_min: 6 }] }`. Built-in
providers live in `src/providers/`; a pull request adding one there is the
better home for anything generally useful.
