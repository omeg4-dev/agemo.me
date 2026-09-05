// Lanyard presence. Read-only, best-effort, and never load-bearing:
// every failure path ends at "offline" with no console noise.

const STATES = {
  online: 'online',
  idle: 'idle',
  dnd: 'do not disturb',
  offline: 'offline',
};

// Discord activity type 4 is a custom status, 2 is Spotify (Phase 3).
function describe(activities = []) {
  const act = activities.find((a) => a.type !== 4);
  if (!act) return 'nothing in particular';
  return act.state ? `${act.name} — ${act.state}` : act.name;
}

function startClock(el) {
  if (!el) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  });
  const tick = () => { el.textContent = `${fmt.format(new Date())} local`; };
  tick();
  // Never cleared: the clock lives for the life of the page, which never
  // unmounts this element (static site, no client-side routing). See
  // Task 8 ledger note — a real teardown path would only matter if this
  // component could be removed from the DOM without a full page nav.
  setInterval(tick, 30_000);
}

export async function initPresence() {
  const root = document.querySelector('[data-presence]');
  if (!root) return;

  startClock(root.querySelector('[data-clock]'));

  const id = root.getAttribute('data-discord-id');
  const stateEl = root.querySelector('[data-presence-state]');
  const actEl = root.querySelector('[data-presence-activity]');
  if (!id || !stateEl || !actEl) return;

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));

    const json = await res.json();
    if (!json?.success || !json.data) throw new Error('unexpected payload');

    const status = json.data.discord_status ?? 'offline';
    stateEl.textContent = STATES[status] ?? 'offline';
    stateEl.setAttribute('data-state', status);
    actEl.textContent = describe(json.data.activities);
  } catch {
    // Spec §4.3 — degrade silently.
    stateEl.textContent = 'offline';
    stateEl.setAttribute('data-state', 'offline');
    actEl.textContent = 'presence unavailable';
  }
}
