export default {
  handle: 'Omega',
  owner: 'omeg4-dev',
  discordId: '626069774002159619',

  // Repos given large treatment in the Work grid — spec §5.3
  featured: ['mc-jukebox', 'magpie', 'hypr-keybind-overlay', 'gamehub'],

  // Suppressed from the grid entirely — spec §5.3 deny-list
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
