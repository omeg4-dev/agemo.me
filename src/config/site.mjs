export default {
  handle: 'Omega',
  owner: 'omeg4-dev',
  discordId: '626069774002159619',

  // The Work section shows GitHub-pinned repos and nothing else. The build
  // reads the real pin list from the GraphQL API; this array is the order and
  // the fallback used when that call is unavailable (no token, API down), so
  // it must be kept in step with what is actually pinned on the profile.
  pinned: ['gamehub', 'hypr-keybind-overlay', 'magpie', 'mc-jukebox'],

  // Never eligible, even if pinned — spec §5.3 deny-list
  deny: ['sus', 'DeadlyOmega.github.io'],

  tagline: 'I build things for Linux desktops that should not need to exist.',

  links: {
    discord: 'https://discord.com/users/626069774002159619',
    // github.com/DeadlyOmega was a dead account — it 404s. Everything is
    // under omeg4-dev.
    github: 'https://github.com/omeg4-dev',
  },

  // spec §5.4 — the machine, laid out the way fastfetch prints it here.
  //
  // Stable facts only. Nothing moment-to-moment (uptime, used RAM, pending
  // updates) — a static page reprinting a snapshot of those would just be
  // wrong most of the time. The NETWORK section is dropped outright rather
  // than reproduced: the real one prints a LAN address and the local weather,
  // and neither belongs on a public page that is deliberately pseudonymous.
  machine: [
    {
      name: 'system',
      colour: '#a0cfd4',
      icon: 'gear',
      rows: [
        { icon: 'user',   k: 'user',   v: 'omega@cachyos' },
        { icon: 'os',     k: 'os',     v: 'CachyOS x86_64' },
        { icon: 'kernel', k: 'kernel', v: 'Linux 7.2.2-1-cachyos' },
      ],
    },
    {
      name: 'environment',
      colour: '#e3b5ff',
      icon: 'terminal',
      rows: [
        { icon: 'shell',   k: 'shell',   v: 'zsh 5.9.2' },
        { icon: 'wm',      k: 'wm',      v: 'Hyprland 0.56.0 (Wayland)' },
        { icon: 'bar',     k: 'bar',     v: 'Noctalia v5' },
        { icon: 'display', k: 'display', v: '3840x2160 @ 60Hz' },
        { icon: 'display', k: 'display', v: '2560x1440 @ 180Hz' },
        { icon: 'display', k: 'display', v: '1920x1080 @ 240Hz' },
      ],
    },
    {
      name: 'hardware',
      colour: '#4cd9e7',
      icon: 'chip',
      rows: [
        { icon: 'cpu',  k: 'cpu',  v: 'AMD Ryzen 7 5700X (16) @ 4.67 GHz' },
        { icon: 'gpu',  k: 'gpu',  v: 'NVIDIA GeForce RTX 4060' },
        { icon: 'ram',  k: 'ram',  v: '31.26 GiB' },
        { icon: 'disk', k: 'root', v: '384.57 GiB' },
        { icon: 'disk', k: 'home', v: '484.49 GiB' },
        { icon: 'vol',  k: 'gv',   v: '915.82 GiB' },
        { icon: 'vol',  k: 'xv',   v: '457.38 GiB' },
        { icon: 'vol',  k: 'zv',   v: '3.58 TiB' },
      ],
    },
    {
      name: 'setup',
      colour: '#ffb4ab',
      icon: 'palette',
      rows: [
        { icon: 'palette', k: 'palette', v: 'Oxocarbon' },
        { icon: 'fs',      k: 'fs',      v: 'btrfs + snapper' },
        { icon: 'lang',    k: 'lang',    v: 'Python, then shell' },
        { icon: 'editor',  k: 'editor',  v: 'Neovim' },
      ],
    },
  ],

  // The eight terminal colours fastfetch prints as a row of circles.
  swatches: ['#3a4348', '#dde4e4', '#4cd9e7', '#e3b5ff', '#78a9ff', '#f7d774', '#95e0a8', '#ffb4ab'],

};
