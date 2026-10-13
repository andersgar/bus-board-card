// Shared pollers: every card with an identical `source` block shares one fetch
// loop, so three copies of a board on one dashboard still make one request.
// Polling pauses while the page is hidden and resumes at once when it is shown.
const pollers = new Map();

export function subscribe(key, fetchFn, intervalS, cb) {
  let p = pollers.get(key);
  if (!p) {
    p = {
      key,
      fetchFn,
      subs: new Set(),
      timer: null,
      running: false,
      data: null,
      error: null,
      at: 0,
      interval: Math.max(10, Number(intervalS) || 30),
    };
    p.onVisible = () => {
      if (!document.hidden) run(p);
    };
    pollers.set(key, p);
    document.addEventListener("visibilitychange", p.onVisible);
    run(p);
  }
  p.subs.add(cb);
  if (p.data || p.error) cb(p.data, p.error, p.at);
  return () => {
    p.subs.delete(cb);
    if (p.subs.size === 0) {
      clearTimeout(p.timer);
      document.removeEventListener("visibilitychange", p.onVisible);
      pollers.delete(key);
    }
  };
}

async function run(p) {
  clearTimeout(p.timer);
  if (p.running) return;
  if (document.hidden && p.data) {
    p.timer = setTimeout(() => run(p), p.interval * 1000);
    return;
  }
  p.running = true;
  try {
    p.data = await p.fetchFn();
    p.error = null;
  } catch (e) {
    p.error = e;
    console.warn("[bus-board-card] fetch failed:", e);
  } finally {
    p.running = false;
    p.at = Date.now();
    for (const cb of p.subs) {
      try {
        cb(p.data, p.error, p.at);
      } catch (e) {
        console.error(e);
      }
    }
    if (pollers.get(p.key) === p) p.timer = setTimeout(() => run(p), p.interval * 1000);
  }
}
