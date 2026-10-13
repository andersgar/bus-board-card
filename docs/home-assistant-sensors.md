# Entity mode: feeding the card from Home Assistant sensors

In entity mode the card reads one entity and renders its `list` attribute. The
sensor can be built from anything: a `rest:` sensor calling an API, a core or
HACS integration, MQTT. Entity mode is the right choice when

- the API needs a key you do not want in a dashboard, or blocks browsers (CORS);
- you want the data in Home Assistant anyway, e.g. a "leave in N minutes"
  sensor for notifications, or one fetch shared by every device on the network;
- you already have the sensors from a previous setup.

## The list format

`state` can be anything (the count is handy). `attributes.list` is an array,
sorted by `expected_ts`, of:

| Key | Type | Meaning |
|---|---|---|
| `line` | string | Line number shown in the badge. |
| `dest` | string | Destination text. |
| `quay` | string | Platform id (used by `stop_labels`). |
| `stop` | string | Label shown under the destination. |
| `aimed` | ISO 8601 | Scheduled departure. |
| `expected` | ISO 8601 | Real-time departure estimate (= `aimed` if none). |
| `expected_ts` | int | `expected` as a Unix timestamp. The card computes all countdowns from this, so a 30 s poll never makes a countdown stale. |
| `delay_min` | int | `expected - aimed` in minutes (negative = early). |
| `realtime` | bool | Live data (green dot) or timetable only (dimmed clock). |
| `cancelled` | bool | Strike-through and "cancelled". |
| `sj` | string | Unique journey id; rows are keyed on it so they animate instead of flicker. |
| `walk_min` | number | Walking time to this stop, used for *run!* / *too late* thresholds. |
| `leave_at` | ISO 8601 | `expected - (walk_min + door_buffer) * 60`. |
| `leave_ts` | int | `leave_at` as a Unix timestamp; the bar counts down to this. |
| `color`, `text_color` | string | Optional badge colours. |

## Ready-made package for Entur

[`homeassistant/packages/bus_board_entur.yaml`](../homeassistant/packages/bus_board_entur.yaml)
is a complete example: a `rest` sensor that POSTs one GraphQL query for two
stops every 30 s, a template sensor that filters the calls by the `line@quay`
tokens in `input_text.bus_watch` and attaches walk times from `input_number`s,
plus `sensor.bus_next_leave` (timestamp) and `sensor.bus_leave_in` (minutes)
for automations. Copy it to `config/packages/`, edit the stop ids, walk
entities and labels, and use `entity: sensor.bus_departures`.

Because the selection lives in an `input_text`, automations can switch it:

```yaml
automation:
  - alias: "Bus routes: morning set on weekdays"
    triggers:
      - trigger: time
        at: "05:00:00"
      - trigger: time
        at: "10:00:00"
    actions:
      - action: input_text.set_value
        target: { entity_id: input_text.bus_watch }
        data:
          value: >-
            {{ '22@103009' if now().weekday() < 5 and 5 <= now().hour < 10
               else '1@103009, 22@103009, 28@103009' }}
```

(The same trick works in source mode with `watch_entity: input_text.bus_watch`,
without any sensors.)

## Reshaping another integration

Anything that gives you departures as attributes can be mapped with a template
sensor. Sketch for an integration that exposes `next_departures` with
`scheduledDeparture`, `delayDeparture`, `train`, `destination`, `isCancelled`
(the `db_infoscreen` shape):

```yaml
template:
  - sensor:
      - name: "Bus departures"
        state: "{{ (this.attributes.list | count) if this.attributes.list is defined else 0 }}"
        attributes:
          list: >-
            {% set walk = 5 %}{% set buf = 1 %}
            {% set ns = namespace(l=[]) %}
            {% for d in state_attr('sensor.hbf_departures', 'next_departures') or [] %}
              {% set aim = as_timestamp(d.scheduledDeparture) %}
              {% set exp = aim + (d.delayDeparture | int(0)) * 60 %}
              {% set ns.l = ns.l + [{
                'line': d.train, 'dest': d.destination, 'quay': d.platform | string, 'stop': 'Hbf ' ~ d.platform,
                'aimed': aim | timestamp_local, 'expected': exp | timestamp_local, 'expected_ts': exp | int,
                'delay_min': d.delayDeparture | int(0), 'realtime': d.delayDeparture is not none,
                'cancelled': d.isCancelled | bool, 'sj': d.train ~ d.scheduledDeparture,
                'walk_min': walk, 'leave_at': (exp - (walk + buf) * 60) | timestamp_local,
                'leave_ts': (exp - (walk + buf) * 60) | int }] %}
            {% endfor %}
            {{ ns.l | sort(attribute='expected_ts') }}
```

Exclude the sensor from the recorder (the attribute changes every poll).
