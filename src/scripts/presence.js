// Discord status through Lanyard. Best-effort: any failure leaves the
// label as it was rendered ("message me").

const WORDS = { online: 'online now', idle: 'idle', dnd: 'busy', offline: 'offline' };

export async function initPresence() {
  const el = document.querySelector('[data-presence]');
  const id = el?.getAttribute('data-discord-id');
  if (!id || !window.fetch) return;
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return;
    const json = await res.json();
    const status = json?.data?.discord_status;
    if (!json?.success || !WORDS[status]) return;
    el.querySelector('[data-presence-state]')?.setAttribute('data-state', status);
    const text = el.querySelector('[data-presence-text]');
    if (text) text.textContent = `${WORDS[status]} · message me`;
  } catch {
    /* stays "message me" */
  }
}
