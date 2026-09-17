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
  setInterval(tick, 30_000);
}

export async function initPresence() {
  const roots = document.querySelectorAll('[data-presence]');
  if (!roots.length) return;

  roots.forEach((root) => {
    startClock(root.querySelector('[data-clock]'));
  });

  const firstWithId = Array.from(roots).find((r) => r.getAttribute('data-discord-id'));
  const id = firstWithId ? firstWithId.getAttribute('data-discord-id') : null;
  if (!id) return;

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));

    const json = await res.json();
    if (!json?.success || !json.data) throw new Error('unexpected payload');

    const status = json.data.discord_status ?? 'offline';
    const statusText = STATES[status] ?? 'offline';
    const actText = describe(json.data.activities);

    roots.forEach((root) => {
      const stateEl = root.querySelector('[data-presence-state]');
      const actEl = root.querySelector('[data-presence-activity]');
      if (stateEl) {
        stateEl.textContent = statusText;
        stateEl.setAttribute('data-state', status);
      }
      if (actEl) {
        actEl.textContent = actText;
      }
    });
  } catch {
    // Degrade silently to offline
    roots.forEach((root) => {
      const stateEl = root.querySelector('[data-presence-state]');
      const actEl = root.querySelector('[data-presence-activity]');
      if (stateEl) {
        stateEl.textContent = 'offline';
        stateEl.setAttribute('data-state', 'offline');
      }
      if (actEl) {
        actEl.textContent = 'presence unavailable';
      }
    });
  }
}
