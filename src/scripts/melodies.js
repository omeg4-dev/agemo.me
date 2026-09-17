// melodies.js: Chiptune loop data for mc-jukebox
// Note format: [midiNote | null, lengthInSixteenths]
// 128 sixteenths = 8 whole bars of 4/4 time (16 sixteenths per bar)

export const OMEGA_LEAD = [
  // Bar 1 (Am)
  [69, 2], [64, 2], [60, 2], [64, 2], [69, 2], [72, 2], [71, 2], [67, 2],
  // Bar 2 (F)
  [65, 2], [69, 2], [72, 2], [76, 2], [72, 2], [69, 2], [65, 2], [64, 2],
  // Bar 3 (C)
  [60, 2], [64, 2], [67, 2], [72, 2], [67, 2], [64, 2], [60, 2], [62, 2],
  // Bar 4 (G)
  [59, 2], [62, 2], [67, 2], [71, 2], [67, 2], [62, 2], [59, 2], [60, 2],
  // Bar 5 (Am)
  [69, 2], [72, 2], [76, 2], [81, 2], [76, 2], [72, 2], [69, 2], [67, 2],
  // Bar 6 (Dm)
  [62, 2], [65, 2], [69, 2], [74, 2], [69, 2], [65, 2], [62, 2], [64, 2],
  // Bar 7 (Em)
  [64, 2], [67, 2], [71, 2], [76, 2], [71, 2], [67, 2], [64, 2], [65, 2],
  // Bar 8 (E/Am turnaround)
  [64, 2], [68, 2], [71, 2], [76, 2], [72, 2], [71, 2], [69, 4],
];

export const OMEGA_BASS = [
  // 8 bars of root bass notes (16 sixteenths each = 128 sixteenths total)
  [45, 8], [45, 8], // Am
  [41, 8], [41, 8], // F
  [48, 8], [48, 8], // C
  [43, 8], [43, 8], // G
  [45, 8], [45, 8], // Am
  [38, 8], [38, 8], // Dm
  [40, 8], [40, 8], // Em
  [40, 8], [45, 8], // E -> Am
];

// AGEMO is the palindrome: exact same note sequence reversed!
export const AGEMO_LEAD = OMEGA_LEAD.slice().reverse();
export const AGEMO_BASS = OMEGA_BASS.slice().reverse();

export const CACHY_LEAD = [
  // Bar 1 (C)
  [60, 4], [64, 4], [67, 4], [72, 4],
  // Bar 2 (G/B)
  [71, 4], [67, 4], [64, 4], [62, 4],
  // Bar 3 (Am)
  [57, 4], [60, 4], [64, 4], [69, 4],
  // Bar 4 (Em)
  [67, 4], [64, 4], [60, 4], [59, 4],
  // Bar 5 (F)
  [53, 4], [57, 4], [60, 4], [65, 4],
  // Bar 6 (C/E)
  [64, 4], [60, 4], [57, 4], [55, 4],
  // Bar 7 (G)
  [55, 4], [59, 4], [62, 4], [67, 4],
  // Bar 8 (C turnaround)
  [65, 4], [64, 4], [62, 4], [60, 4],
];

export const CACHY_BASS = [
  [36, 16], // C
  [35, 16], // B
  [33, 16], // A
  [28, 16], // E
  [29, 16], // F
  [28, 16], // E
  [31, 16], // G
  [36, 16], // C
];

export const TRACKS = [
  {
    id: 'omega',
    title: 'disc · omega',
    subtitle: 'bright A-minor arpeggio',
    tempo: 124,
    lead: OMEGA_LEAD,
    bass: OMEGA_BASS,
  },
  {
    id: 'agemo',
    title: 'disc · agemo',
    subtitle: 'omega, backwards',
    tempo: 124,
    lead: AGEMO_LEAD,
    bass: AGEMO_BASS,
  },
  {
    id: 'cachy',
    title: 'disc · cachy',
    subtitle: 'slower melodic loop',
    tempo: 114,
    lead: CACHY_LEAD,
    bass: CACHY_BASS,
  },
];
