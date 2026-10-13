#!/usr/bin/env python3
"""Rebuild dev/fixture.json: the list sensor.bus_departures would produce for the
example stops (Buran and Lademoen stasjon, Trondheim), straight from Entur.
Run with -I from the repo root: python -I dev/make_fixture.py"""
import datetime, json, pathlib, urllib.request

STOPS = {"a": "NSR:StopPlace:60447", "b": "NSR:StopPlace:271"}
WATCH = {"1@103009", "22@103009", "28@103009", "2@108948", "R70@445", "R60@445"}
WALK = {"103009": 4, "108948": 4, "445": 6}
LABEL = {"103009": "Buran 1", "108948": "Buran 3", "445": "Lademoen st."}
BUF = 1

Q = "{ " + " ".join(f'{k}: stopPlace(id: "{v}") {{ estimatedCalls(numberOfDepartures: 40, timeRange: 5400) {{ ...c }} }}' for k, v in STOPS.items()) + """ }
fragment c on EstimatedCall { quay { id } realtime cancellation aimedDepartureTime expectedDepartureTime
destinationDisplay { frontText } serviceJourney { id line { publicCode } } }"""

req = urllib.request.Request("https://api.entur.io/journey-planner/v3/graphql", data=json.dumps({"query": Q}).encode(),
                             headers={"Content-Type": "application/json", "ET-Client-Name": "bus-board-card-dev"})
data = json.load(urllib.request.urlopen(req, timeout=30))["data"]
ts = lambda s: datetime.datetime.fromisoformat(s).timestamp()
out = []
for key in STOPS:
    for c in data[key]["estimatedCalls"]:
        q = c["quay"]["id"].split(":")[-1]; line = c["serviceJourney"]["line"]["publicCode"]
        if f"{line}@{q}" not in WATCH: continue
        exp, aim = ts(c["expectedDepartureTime"]), ts(c["aimedDepartureTime"])
        walk = WALK.get(q, 3); leave = exp - (walk + BUF) * 60
        out.append({"line": line, "dest": c["destinationDisplay"]["frontText"], "quay": q, "stop": LABEL.get(q, q),
                    "aimed": c["aimedDepartureTime"], "expected": c["expectedDepartureTime"], "expected_ts": int(exp),
                    "delay_min": int(round((exp - aim) / 60)), "realtime": c["realtime"], "cancelled": c["cancellation"],
                    "sj": c["serviceJourney"]["id"], "walk_min": walk,
                    "leave_at": datetime.datetime.fromtimestamp(leave).astimezone().isoformat(), "leave_ts": int(leave)})
out.sort(key=lambda d: d["expected_ts"])
p = pathlib.Path(__file__).with_name("fixture.json")
p.write_text(json.dumps({"list": out}, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(out), "departures ->", p)
