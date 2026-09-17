// terminal-commands.js: Pure, DOM-free command evaluation module

import site from '../config/site.mjs';
import reposData from '../data/repos.json' with { type: 'json' };
import linksData from '../data/links.json' with { type: 'json' };

const VALID_ACCENTS = ['blue', 'cyan', 'green', 'pink', 'purple', 'rose'];

export const FORTUNES = [
  'There is no place like ~ except a freshly riced workspace.',
  'A blurred background conceals a multitude of open terminals.',
  'May your window gaps be even and your frame rates unthrottled.',
  'Any config file sufficiently customized is indistinguishable from art.',
  'Gaps: outer 8, inner 4, productivity: undefined.',
  'In Hyprland, every keystroke is an intentional journey.',
  'A clean desktop is the sign of a hidden scratchpad.',
  "Compile flags won't fix your code, but they'll make it fail faster.",
];

export function cowsay(text) {
  const msg = text || 'moo';
  const len = msg.length;
  const top = ' ' + '_'.repeat(len + 2);
  const mid = `< ${msg} >`;
  const bot = ' ' + '-'.repeat(len + 2);
  const cow = [
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ];
  return [top, mid, bot, ...cow];
}

export const TRAIN = [
  '     ====        ________                ___________',
  ' _D _|  |_______/        \\__I_I_____===__|_________|',
  '  |(_)---  |   |==== |-- |   |  |___/     |--|--|--|',
];

export function run(rawLine, ctx = {}) {
  const line = (rawLine || '').trim();
  const pinned = ctx.pinned || reposData.pinned || [];
  const links = ctx.links || linksData.links || [];
  const machine = ctx.machine || site.machine || [];
  const history = ctx.history || [];

  if (!line) {
    return { lines: [], effects: [] };
  }

  const parts = line.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const rest = parts.slice(1).join(' ');
  const arg1 = parts[1] ? parts[1].toLowerCase() : '';

  // sudo check
  if (cmd === 'sudo') {
    return {
      lines: [[{ text: 'omega is not in the sudoers file. This incident will be reported.', cls: 'rose' }]],
      effects: [],
    };
  }

  // package managers
  if (cmd === 'paru' || cmd === 'pacman') {
    const pkg = parts[2] || parts[1] || 'package';
    return {
      lines: [
        [{ text: 'resolving dependencies...', cls: 'dim' }],
        [{ text: 'looking for conflicting packages...', cls: 'dim' }],
        [{ text: `:: ${pkg} is already installed on the website. nothing to do.`, cls: 'green' }],
      ],
      effects: [],
    };
  }
  if (['apt', 'apt-get', 'dnf', 'snap'].includes(cmd)) {
    return {
      lines: [[{ text: 'this is an Arch box.', cls: 'purple' }]],
      effects: [],
    };
  }

  // rm
  if (cmd === 'rm') {
    return {
      lines: [[{ text: 'nice try.', cls: 'rose' }]],
      effects: [],
    };
  }

  // hyprctl
  if (cmd === 'hyprctl') {
    return {
      lines: [[{ text: 'hyprctl: this is a website pretending very hard.', cls: 'purple' }]],
      effects: [],
    };
  }

  // editors
  if (cmd === 'vim' || cmd === 'nvim') {
    return {
      lines: [[{ text: "you'd never leave.", cls: 'rose' }]],
      effects: [],
    };
  }

  // help
  if (cmd === 'help') {
    return {
      lines: [
        [{ text: 'Available commands:', cls: 'purple bold' }],
        [{ text: '  help              ', cls: 'cyan' }, { text: 'display this help guide', cls: 'dim' }],
        [{ text: '  whoami            ', cls: 'cyan' }, { text: 'print current user identity', cls: 'dim' }],
        [{ text: '  hostname          ', cls: 'cyan' }, { text: 'print system hostname', cls: 'dim' }],
        [{ text: '  uname -a          ', cls: 'cyan' }, { text: 'print kernel version', cls: 'dim' }],
        [{ text: '  date              ', cls: 'cyan' }, { text: 'print local system date', cls: 'dim' }],
        [{ text: '  fastfetch         ', cls: 'cyan' }, { text: 'print machine system information', cls: 'dim' }],
        [{ text: '  ls [dir]          ', cls: 'cyan' }, { text: 'list workspace directories or repos', cls: 'dim' }],
        [{ text: '  cd <workspace>    ', cls: 'cyan' }, { text: 'scroll to workspace (home, work, machine, links, reach)', cls: 'dim' }],
        [{ text: '  open <project>    ', cls: 'cyan' }, { text: 'open project repository in new tab', cls: 'dim' }],
        [{ text: '  cat <file>        ', cls: 'cyan' }, { text: 'read readme or project description', cls: 'dim' }],
        [{ text: '  links             ', cls: 'cyan' }, { text: 'list curated links', cls: 'dim' }],
        [{ text: '  play [track]      ', cls: 'cyan' }, { text: 'play chiptune loop (omega, agemo, cachy)', cls: 'dim' }],
        [{ text: '  stop              ', cls: 'cyan' }, { text: 'stop chiptune music playback', cls: 'dim' }],
        [{ text: '  theme [name]      ', cls: 'cyan' }, { text: 'view or set theme accent (blue, cyan, green, pink, purple, rose)', cls: 'dim' }],
        [{ text: '  palindrome [text] ', cls: 'cyan' }, { text: 'mirror text around arrow', cls: 'dim' }],
        [{ text: '  cowsay <text>     ', cls: 'cyan' }, { text: 'print an ascii talking cow', cls: 'dim' }],
        [{ text: '  fortune           ', cls: 'cyan' }, { text: 'print a linux / hyprland fortune', cls: 'dim' }],
        [{ text: '  sl                ', cls: 'cyan' }, { text: 'run steam locomotive across terminal', cls: 'dim' }],
        [{ text: '  echo <text>       ', cls: 'cyan' }, { text: 'print text to console', cls: 'dim' }],
        [{ text: '  clear             ', cls: 'cyan' }, { text: 'clear terminal screen', cls: 'dim' }],
        [{ text: '  history           ', cls: 'cyan' }, { text: 'show command history', cls: 'dim' }],
        [{ text: '  keys              ', cls: 'cyan' }, { text: 'open keyboard shortcuts overlay', cls: 'dim' }],
        [{ text: '  launch / menu     ', cls: 'cyan' }, { text: 'open application launcher', cls: 'dim' }],
        [{ text: '  exit              ', cls: 'cyan' }, { text: 'lock session', cls: 'dim' }],
      ],
      effects: [],
    };
  }

  // identity
  if (cmd === 'whoami') {
    return { lines: [[{ text: 'omega', cls: 'green' }]], effects: [] };
  }
  if (cmd === 'hostname') {
    return { lines: [[{ text: 'cachyos', cls: 'blue' }]], effects: [] };
  }
  if (cmd === 'uname') {
    let kernel = 'Linux 7.2.2-1-cachyos x86_64';
    const sys = machine.find((m) => m.name === 'system');
    if (sys) {
      const kRow = sys.rows.find((r) => r.k === 'kernel');
      if (kRow) kernel = `${kRow.v} x86_64`;
    }
    return { lines: [[{ text: kernel, cls: 'dim' }]], effects: [] };
  }
  if (cmd === 'date') {
    const d = new Date();
    const str = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { lines: [[{ text: str, cls: 'dim' }]], effects: [] };
  }

  // fastfetch / neofetch
  if (cmd === 'neofetch') {
    return {
      lines: [[{ text: 'neofetch is archived. did you mean fastfetch?', cls: 'rose' }]],
      effects: [],
    };
  }
  if (cmd === 'fastfetch') {
    const outLines = [];
    outLines.push([{ text: 'omega@cachyos', cls: 'green bold' }]);
    outLines.push([{ text: '------------', cls: 'dim' }]);

    for (const sec of machine) {
      outLines.push([
        { text: `[${sec.name}]`, cls: 'purple bold' },
      ]);
      for (const row of sec.rows) {
        outLines.push([
          { text: `  ${row.k}: `, cls: 'cyan' },
          { text: row.v, cls: 'text' },
        ]);
      }
    }

    outLines.push([]);
    outLines.push([
      { text: 'full panel on workspace 3 →', cls: 'accent link', action: 'ws-machine' },
    ]);

    return {
      lines: outLines,
      effects: [],
    };
  }

  // ls
  if (cmd === 'ls') {
    if (arg1 === 'work' || arg1 === 'work/') {
      const names = pinned.map((p) => p.name).join('  ');
      return {
        lines: [[{ text: names, cls: 'blue' }]],
        effects: [],
      };
    }
    return {
      lines: [[
        { text: 'work/  ', cls: 'blue' },
        { text: 'machine/  ', cls: 'purple' },
        { text: 'links/  ', cls: 'cyan' },
        { text: 'reach/  ', cls: 'green' },
      ]],
      effects: [],
    };
  }

  // cd
  if (cmd === 'cd') {
    const target = arg1.replace(/\/$/, '');
    if (!target || target === '~' || target === '..' || target === 'home') {
      return { lines: [], effects: [{ type: 'scroll', target: '#ws-home' }] };
    }
    if (['work', 'machine', 'links', 'reach'].includes(target)) {
      return { lines: [], effects: [{ type: 'scroll', target: `#ws-${target}` }] };
    }
    return {
      lines: [[{ text: `cd: no such file or directory: ${parts[1]}`, cls: 'rose' }]],
      effects: [],
    };
  }

  // open
  if (cmd === 'open') {
    if (!parts[1]) {
      return {
        lines: [[{ text: 'usage: open <project>', cls: 'dim' }]],
        effects: [],
      };
    }
    const repo = pinned.find((p) => p.name.toLowerCase() === arg1);
    if (repo) {
      return {
        lines: [[{ text: `opening ${repo.name}…`, cls: 'dim' }]],
        effects: [{ type: 'open', url: repo.url }],
      };
    }
    const suggestions = pinned.map((p) => p.name).join(', ');
    return {
      lines: [[{ text: `open: ${parts[1]}: no such project. Available: ${suggestions}`, cls: 'rose' }]],
      effects: [],
    };
  }

  // cat
  if (cmd === 'cat') {
    if (!parts[1]) {
      return { lines: [[{ text: 'usage: cat <file>', cls: 'dim' }]], effects: [] };
    }
    if (arg1 === 'readme' || arg1 === 'readme.md') {
      return {
        lines: [
          [{ text: 'The site is a desktop rice running Oxocarbon on CachyOS / Hyprland.', cls: 'text' }],
          [{ text: 'Workspaces hold projects, machine specs, links, and contact.', cls: 'dim' }],
          [{ text: 'Source code is open on GitHub; use keys (? or /) to navigate.', cls: 'accent' }],
        ],
        effects: [],
      };
    }
    const repo = pinned.find((p) => p.name.toLowerCase() === arg1);
    if (repo) {
      return {
        lines: [
          [{ text: repo.name, cls: 'bold accent' }],
          [{ text: repo.description || '(no description)', cls: 'text' }],
        ],
        effects: [],
      };
    }
    return {
      lines: [[{ text: `cat: ${parts[1]}: no such file or directory`, cls: 'rose' }]],
      effects: [],
    };
  }

  // links
  if (cmd === 'links') {
    const lines = [[{ text: 'Curated links:', cls: 'purple bold' }]];
    for (const l of links) {
      let host = l.url;
      try { host = new URL(l.url).host.replace(/^www\./, ''); } catch {}
      lines.push([
        { text: `  ${l.title} `, cls: 'accent bold' },
        { text: `(${host})`, cls: 'dim' },
        l.note ? { text: ` — ${l.note}`, cls: 'text' } : { text: '' },
      ]);
    }
    return { lines, effects: [] };
  }

  // direct shortcuts
  if (cmd === 'discord') {
    return {
      lines: [[{ text: 'opening discord…', cls: 'dim' }]],
      effects: [{ type: 'open', url: site.links.discord }],
    };
  }
  if (cmd === 'github') {
    return {
      lines: [[{ text: 'opening github…', cls: 'dim' }]],
      effects: [{ type: 'open', url: site.links.github }],
    };
  }

  // theme
  if (cmd === 'theme') {
    if (!arg1) {
      const current = ctx.currentAccent || 'blue';
      return {
        lines: [
          [{ text: `current accent: ${current}`, cls: 'text' }],
          [{ text: `available accents: ${VALID_ACCENTS.join(', ')}`, cls: 'dim' }],
        ],
        effects: [],
      };
    }
    if (VALID_ACCENTS.includes(arg1)) {
      return {
        lines: [[{ text: `accent set to ${arg1}`, cls: 'green' }]],
        effects: [{ type: 'theme', name: arg1 }],
      };
    }
    return {
      lines: [[{ text: `theme: unknown accent '${parts[1]}'. Choose from: ${VALID_ACCENTS.join(', ')}`, cls: 'rose' }]],
      effects: [],
    };
  }

  // palindrome
  if (cmd === 'palindrome') {
    const text = rest || 'omega';
    const rev = Array.from(text).reverse().join('');
    return {
      lines: [[
        { text: text, cls: 'blue' },
        { text: ' ⟷ ', cls: 'pink arrow', isArrow: true },
        { text: rev, cls: 'purple' },
      ]],
      effects: [],
    };
  }

  // play
  if (cmd === 'play') {
    const track = arg1 || 'omega';
    return {
      lines: [[{ text: `now playing disc · ${track}`, cls: 'green' }]],
      effects: [{ type: 'jukebox-play', track }],
    };
  }

  // stop
  if (cmd === 'stop') {
    return {
      lines: [[{ text: 'jukebox stopped.', cls: 'dim' }]],
      effects: [{ type: 'jukebox-stop' }],
    };
  }

  // cowsay
  if (cmd === 'cowsay') {
    const speech = cowsay(rest);
    return {
      lines: speech.map((lineStr) => [{ text: lineStr, cls: 'cyan' }]),
      effects: [],
    };
  }

  // sl
  if (cmd === 'sl') {
    return {
      lines: TRAIN.map((lineStr) => [{ text: lineStr, cls: 'purple' }]),
      effects: [{ type: 'sl' }],
    };
  }

  // fortune
  if (cmd === 'fortune') {
    const rand = Math.floor(Math.random() * FORTUNES.length);
    return {
      lines: [[{ text: FORTUNES[rand], cls: 'text' }]],
      effects: [],
    };
  }

  // echo
  if (cmd === 'echo') {
    return {
      lines: [[{ text: rest, cls: 'text' }]],
      effects: [],
    };
  }

  // clear
  if (cmd === 'clear') {
    return { lines: [], effects: [{ type: 'clear' }] };
  }

  // history
  if (cmd === 'history') {
    const lines = history.map((item, idx) => [
      { text: `  ${String(idx + 1).padStart(3, ' ')}  `, cls: 'dim' },
      { text: item, cls: 'text' },
    ]);
    return { lines, effects: [] };
  }

  // exit
  if (cmd === 'exit') {
    return {
      lines: [[{ text: 'locking session…', cls: 'dim' }]],
      effects: [{ type: 'exit' }],
    };
  }

  // keys
  if (cmd === 'keys') {
    return { lines: [], effects: [{ type: 'keys' }] };
  }

  // launch / menu
  if (cmd === 'launch' || cmd === 'menu') {
    return { lines: [], effects: [{ type: 'launcher' }] };
  }

  // Unknown command
  return {
    lines: [[{ text: `zsh: command not found: ${parts[0]}`, cls: 'rose' }]],
    effects: [],
  };
}
