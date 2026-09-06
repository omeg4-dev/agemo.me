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
    github: 'https://github.com/DeadlyOmega',
    dotfiles: 'https://github.com/omeg4-dev',
  },

  // spec §5.4 — the machine
  uses: [
    { k: 'os', v: 'CachyOS' },
    { k: 'wm', v: 'Hyprland' },
    { k: 'shell', v: 'Noctalia v5' },
    { k: 'palette', v: 'Oxocarbon' },
    { k: 'lang', v: 'Python' },
    { k: 'fs', v: 'btrfs + snapper' },
  ],
};
