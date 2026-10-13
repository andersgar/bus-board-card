# Changelog

## 1.1.0 — 2026-10-13

- Visual editor in the dashboard card editor: data source, stops list,
  appearance and advanced options, in English and Norwegian.

## 1.0.0 — 2026-10-13

First public release.

- Source mode: the card fetches departures itself from Entur (Norway, any
  OpenTripPlanner Transmodel API via `url`) or Transitous (most of the world).
  Route selection and walk times can be read from Home Assistant entities.
- Entity mode: any sensor with the documented `list` attribute; Entur package
  included.
- Leave-the-house countdown bars, real-time/cancellation markers, official
  line colours from the data source, stable palette otherwise.
- Compact / inline / bar layouts, info-screen mode, en / nb / sv / de strings.
- Runtime provider registry (`window.busBoardProviders`).
