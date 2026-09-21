export default {
  handle: 'Omega',
  owner: 'omeg4-dev',
  discordId: '626069774002159619',

  // The Work section leads with the GitHub-pinned repos (then `extras`). The build
  // reads the real pin list from the GraphQL API; this array is the order and
  // the fallback used when that call is unavailable (no token, API down), so
  // it must be kept in step with what is actually pinned on the profile.
  pinned: ['gamehub', 'hypr-keybind-overlay', 'magpie', 'mc-jukebox'],

  // Never eligible, even if pinned — spec §5.3 deny-list
  deny: ['sus', 'DeadlyOmega.github.io'],

  // Repos that have a page of their own on this site. Their row on / links
  // there instead of to GitHub.
  pages: {
    gamehub: '/games/',
    'mc-jukebox': '/games/#jukebox',
  },

  // Work that isn't a GitHub pin: shown after the pins, in this order.
  // `href` is where the row leads; `kind` stands in for the language column.
  extras: [
    {
      name: 'JerkCraft',
      description: 'A Minecraft server for friends: skills with mana abilities, an auction house, trading, homes, Bedrock crossplay.',
      kind: 'Minecraft server',
      href: '/jerkcraft/',
    },
    {
      name: 'Dactylus Airbus',
      description: 'The Discord bot for a friends’ server: casino, voice leveling, music, AI chat, and a lot of nonsense.',
      kind: 'Discord bot',
      href: '/bot/',
    },
    {
      name: 'Abi-Coach',
      description: 'A local-first exam tutor that learns from the textbook and the teacher’s own notes, on a hard budget.',
      kind: 'Python',
      href: '/abi/',
    },
    {
      name: 'vista-sddm',
      description: 'Login screen theme: full-bleed photo or video background, quiet login column, and a setup that turns any video link into a calibrated background.',
      kind: 'QML',
      href: 'https://github.com/omeg4-dev/vista-sddm',
    },
  ],

  links: {
    discord: 'https://discord.com/users/626069774002159619',
    // github.com/DeadlyOmega was a dead account — it 404s. Everything is
    // under omeg4-dev.
    github: 'https://github.com/omeg4-dev',
  },
};
