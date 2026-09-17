import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/scripts/terminal-commands.js';

const mockCtx = {
  pinned: [
    { name: 'gamehub', description: 'Multiplayer games on a TV', url: 'https://github.com/omeg4-dev/gamehub' },
    { name: 'hypr-keybind-overlay', description: 'Hyprland overlay', url: 'https://github.com/omeg4-dev/hypr-keybind-overlay' },
    { name: 'magpie', description: 'Wayland clipboard history', url: 'https://github.com/omeg4-dev/magpie' },
    { name: 'mc-jukebox', description: 'Jukebox widget for Noctalia', url: 'https://github.com/omeg4-dev/mc-jukebox' },
  ],
  links: [
    { title: 'FMHY', url: 'https://fmhy.net', note: 'Free media' },
  ],
  machine: [
    {
      name: 'system',
      colour: '#a0cfd4',
      rows: [
        { icon: 'user', k: 'user', v: 'omega@cachyos' },
        { icon: 'os', k: 'os', v: 'CachyOS x86_64' },
        { icon: 'kernel', k: 'kernel', v: 'Linux 7.2.2-1-cachyos' },
      ],
    },
  ],
  history: ['help', 'whoami'],
};

function flattenText(lines) {
  return lines.map((l) => l.map((s) => s.text).join('')).join('\n');
}

test('whitespace or empty command returns empty lines', () => {
  assert.deepEqual(run('', mockCtx), { lines: [], effects: [] });
  assert.deepEqual(run('   ', mockCtx), { lines: [], effects: [] });
});

test('whoami returns omega', () => {
  const res = run('whoami', mockCtx);
  assert.equal(flattenText(res.lines), 'omega');
});

test('hostname returns cachyos', () => {
  const res = run('hostname', mockCtx);
  assert.equal(flattenText(res.lines), 'cachyos');
});

test('uname -a returns kernel info', () => {
  const res = run('uname -a', mockCtx);
  assert.match(flattenText(res.lines), /Linux 7\.2\.2-1-cachyos/);
});

test('date returns formatted local date', () => {
  const res = run('date', mockCtx);
  assert.ok(res.lines.length > 0);
});

test('fastfetch returns summary with scroll action button', () => {
  const res = run('fastfetch', mockCtx);
  const text = flattenText(res.lines);
  assert.match(text, /omega@cachyos/);
  assert.match(text, /full panel on workspace 3/);
});

test('neofetch directs to fastfetch', () => {
  const res = run('neofetch', mockCtx);
  assert.match(flattenText(res.lines), /neofetch is archived\. did you mean fastfetch\?/);
});

test('ls lists workspaces', () => {
  const res = run('ls', mockCtx);
  const text = flattenText(res.lines);
  assert.match(text, /work\//);
  assert.match(text, /machine\//);
  assert.match(text, /links\//);
  assert.match(text, /reach\//);
});

test('ls work lists pinned repo names', () => {
  const res = run('ls work', mockCtx);
  const text = flattenText(res.lines);
  assert.match(text, /gamehub/);
  assert.match(text, /magpie/);
});

test('cd scrolls to workspace', () => {
  assert.deepEqual(run('cd work', mockCtx).effects, [{ type: 'scroll', target: '#ws-work' }]);
  assert.deepEqual(run('cd machine', mockCtx).effects, [{ type: 'scroll', target: '#ws-machine' }]);
  assert.deepEqual(run('cd links', mockCtx).effects, [{ type: 'scroll', target: '#ws-links' }]);
  assert.deepEqual(run('cd reach', mockCtx).effects, [{ type: 'scroll', target: '#ws-reach' }]);
  assert.deepEqual(run('cd ..', mockCtx).effects, [{ type: 'scroll', target: '#ws-home' }]);
  assert.deepEqual(run('cd ~', mockCtx).effects, [{ type: 'scroll', target: '#ws-home' }]);
  assert.match(flattenText(run('cd nonexist', mockCtx).lines), /no such file or directory/);
});

test('open project opens repo url or shows error with suggestions', () => {
  const ok = run('open gamehub', mockCtx);
  assert.match(flattenText(ok.lines), /opening gamehub/);
  assert.deepEqual(ok.effects, [{ type: 'open', url: 'https://github.com/omeg4-dev/gamehub' }]);

  const err = run('open nonexistent', mockCtx);
  assert.match(flattenText(err.lines), /no such project/);
  assert.match(flattenText(err.lines), /gamehub/);
});

test('cat readme returns 3 lines about site', () => {
  const res = run('cat readme', mockCtx);
  assert.equal(res.lines.length, 3);
  const text = flattenText(res.lines);
  assert.match(text, /desktop rice/);
});

test('cat repo returns repo description', () => {
  const res = run('cat gamehub', mockCtx);
  assert.match(flattenText(res.lines), /Multiplayer games/);
});

test('links lists curated entries', () => {
  const res = run('links', mockCtx);
  assert.match(flattenText(res.lines), /FMHY/);
});

test('discord and github commands open their URLs', () => {
  const d = run('discord', mockCtx);
  assert.deepEqual(d.effects[0].type, 'open');
  assert.match(d.effects[0].url, /discord\.com/);

  const g = run('github', mockCtx);
  assert.deepEqual(g.effects[0].type, 'open');
  assert.match(g.effects[0].url, /github\.com/);
});

test('theme lists accents or sets valid accent', () => {
  const list = run('theme', mockCtx);
  assert.match(flattenText(list.lines), /available accents/);

  const set = run('theme green', mockCtx);
  assert.deepEqual(set.effects, [{ type: 'theme', name: 'green' }]);

  const bad = run('theme neon', mockCtx);
  assert.match(flattenText(bad.lines), /unknown accent/);
});

test('palindrome mirrors text around arrow', () => {
  const p1 = run('palindrome', mockCtx);
  assert.match(flattenText(p1.lines), /omega ⟷ agemo/);

  const p2 = run('palindrome racecar', mockCtx);
  assert.match(flattenText(p2.lines), /racecar ⟷ racecar/);
});

test('echo prints input text', () => {
  const res = run('echo hello world', mockCtx);
  assert.equal(flattenText(res.lines), 'hello world');
});

test('clear returns clear effect', () => {
  const res = run('clear', mockCtx);
  assert.deepEqual(res.effects, [{ type: 'clear' }]);
});

test('history returns history lines', () => {
  const res = run('history', mockCtx);
  const text = flattenText(res.lines);
  assert.match(text, /help/);
  assert.match(text, /whoami/);
});

test('exit returns exit effect', () => {
  const res = run('exit', mockCtx);
  assert.deepEqual(res.effects, [{ type: 'exit' }]);
});

test('sudo warning', () => {
  const res = run('sudo su', mockCtx);
  assert.match(flattenText(res.lines), /sudoers/);
});

test('package manager simulation', () => {
  const p = run('paru -S neovim', mockCtx);
  assert.match(flattenText(p.lines), /already installed/);

  const a = run('apt install curl', mockCtx);
  assert.match(flattenText(a.lines), /Arch box/);
});

test('destructive or editor commands jokes', () => {
  assert.match(flattenText(run('rm -rf /', mockCtx).lines), /nice try/);
  assert.match(flattenText(run('hyprctl dispatch', mockCtx).lines), /pretending/);
  assert.match(flattenText(run('nvim', mockCtx).lines), /leave/);
});

test('keys and launch commands return effects', () => {
  assert.deepEqual(run('keys', mockCtx).effects, [{ type: 'keys' }]);
  assert.deepEqual(run('launch', mockCtx).effects, [{ type: 'launcher' }]);
});

test('unknown command message', () => {
  const res = run('xyzabc123', mockCtx);
  assert.match(flattenText(res.lines), /zsh: command not found: xyzabc123/);
});

test('cowsay returns ascii cow with message', () => {
  const res = run('cowsay moo', mockCtx);
  const text = flattenText(res.lines);
  assert.match(text, /< moo >/);
  assert.match(text, /\(oo\)/);
});

test('sl returns 3-line train with sl effect', () => {
  const res = run('sl', mockCtx);
  assert.equal(res.lines.length, 3);
  assert.deepEqual(res.effects, [{ type: 'sl' }]);
});

test('fortune returns a hyprland/linux one-liner', () => {
  const res = run('fortune', mockCtx);
  const text = flattenText(res.lines);
  assert.ok(text.length > 5);
});

test('play and stop control jukebox', () => {
  const p1 = run('play', mockCtx);
  assert.deepEqual(p1.effects, [{ type: 'jukebox-play', track: 'omega' }]);

  const p2 = run('play agemo', mockCtx);
  assert.deepEqual(p2.effects, [{ type: 'jukebox-play', track: 'agemo' }]);

  const s = run('stop', mockCtx);
  assert.deepEqual(s.effects, [{ type: 'jukebox-stop' }]);
});

test('privacy: no command output contains email address (@ followed by domain) or mailto', () => {
  const testCommands = [
    'help', 'whoami', 'hostname', 'uname -a', 'date', 'fastfetch', 'neofetch',
    'ls', 'ls work', 'cd work', 'open gamehub', 'cat readme', 'cat gamehub',
    'links', 'discord', 'github', 'theme', 'theme green', 'palindrome',
    'echo test', 'history', 'exit', 'sudo rm -rf /', 'paru -S git', 'apt update',
    'hyprctl reload', 'vim', 'keys', 'launch', 'nonexistent',
  ];

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  for (const cmd of testCommands) {
    const res = run(cmd, mockCtx);
    const text = flattenText(res.lines);
    assert.doesNotMatch(text, emailPattern, `Email found in command '${cmd}': ${text}`);
    assert.doesNotMatch(text, /mailto:/i, `mailto found in command '${cmd}': ${text}`);
  }
});
