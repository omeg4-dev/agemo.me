// mc-jukebox.js: Live WebAudio chiptune synthesizer and disc player
import { TRACKS } from '../melodies.js';
import { notify } from '../notify.js';

function midiToFreq(m) {
  if (!m) return 0;
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function mount(slot) {
  if (!slot) return;
  slot.textContent = '';

  let audioCtx = null;
  let masterGain = null;
  let filterNode = null;
  let analyserNode = null;

  let currentTrackIdx = 0;
  let isPlaying = false;
  let volume = 0.7;

  // Scheduler state
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let leadNoteIdx = 0;
  let leadRemaining = 0;
  let bassNoteIdx = 0;
  let bassRemaining = 0;

  // Visualiser state
  let animId = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'live-jukebox';

  // Player top section (disc + track meta + visualiser)
  const topSec = document.createElement('div');
  topSec.className = 'live-jukebox__top';

  // Spinning disc
  const disc = document.createElement('div');
  disc.className = 'live-jukebox__disc';
  disc.setAttribute('aria-hidden', 'true');

  const discCenter = document.createElement('div');
  discCenter.className = 'live-jukebox__disc-center';
  disc.appendChild(discCenter);
  topSec.appendChild(disc);

  // Meta & Visualiser
  const metaCol = document.createElement('div');
  metaCol.className = 'live-jukebox__meta-col';

  const trackTitle = document.createElement('div');
  trackTitle.className = 'live-jukebox__title';
  trackTitle.textContent = TRACKS[0].title;

  const trackSub = document.createElement('div');
  trackSub.className = 'live-jukebox__sub';
  trackSub.textContent = TRACKS[0].subtitle;

  // 12-bar visualiser
  const viz = document.createElement('div');
  viz.className = 'live-jukebox__viz';
  viz.setAttribute('aria-hidden', 'true');
  const vizBars = [];
  for (let i = 0; i < 12; i++) {
    const bar = document.createElement('span');
    bar.className = 'live-jukebox__viz-bar';
    viz.appendChild(bar);
    vizBars.push(bar);
  }

  metaCol.appendChild(trackTitle);
  metaCol.appendChild(trackSub);
  metaCol.appendChild(viz);
  topSec.appendChild(metaCol);
  wrapper.appendChild(topSec);

  // Controls row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'live-jukebox__controls';

  function setButtonSvg(btn, d, width, height, cls) {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    btn.appendChild(svg);
  }

  // Prev button
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'live-jukebox__ctrl-btn';
  prevBtn.setAttribute('aria-label', 'Previous track');
  setButtonSvg(prevBtn, 'M6 6h2v12H6zm3.5 6l8.5 6V6z', 16, 16);

  // Play / Pause button
  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'live-jukebox__ctrl-btn live-jukebox__play-btn';
  playBtn.setAttribute('aria-label', 'Play disc');
  playBtn.setAttribute('aria-pressed', 'false');
  setButtonSvg(playBtn, 'M8 5v14l11-7z', 20, 20, 'live-jukebox__play-icon');

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'live-jukebox__ctrl-btn';
  nextBtn.setAttribute('aria-label', 'Next track');
  setButtonSvg(nextBtn, 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z', 16, 16);

  // Volume slider
  const volWrap = document.createElement('div');
  volWrap.className = 'live-jukebox__vol-wrap';

  const volLabel = document.createElement('span');
  volLabel.className = 'live-jukebox__vol-icon';
  volLabel.setAttribute('aria-hidden', 'true');
  volLabel.textContent = '♪';

  const volSlider = document.createElement('input');
  volSlider.type = 'range';
  volSlider.min = '0';
  volSlider.max = '1';
  volSlider.step = '0.05';
  volSlider.value = String(volume);
  volSlider.className = 'live-jukebox__vol-slider';
  volSlider.setAttribute('aria-label', 'Jukebox volume');

  volWrap.appendChild(volLabel);
  volWrap.appendChild(volSlider);

  controlsRow.appendChild(prevBtn);
  controlsRow.appendChild(playBtn);
  controlsRow.appendChild(nextBtn);
  controlsRow.appendChild(volWrap);
  wrapper.appendChild(controlsRow);

  // Track list buttons
  const trackListEl = document.createElement('div');
  trackListEl.className = 'live-jukebox__tracklist';
  trackListEl.setAttribute('role', 'tablist');
  trackListEl.setAttribute('aria-label', 'Tracks');

  const trackBtns = [];
  TRACKS.forEach((track, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `live-jukebox__track-btn ${idx === 0 ? 'is-active' : ''}`;
    btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'live-jukebox__track-name';
    nameSpan.textContent = track.title;
    const subSpan = document.createElement('span');
    subSpan.className = 'live-jukebox__track-sub';
    subSpan.textContent = track.subtitle;
    btn.appendChild(nameSpan);
    btn.appendChild(subSpan);
    btn.addEventListener('click', () => {
      selectTrack(idx, true);
    });
    trackListEl.appendChild(btn);
    trackBtns.push(btn);
  });
  wrapper.appendChild(trackListEl);

  slot.appendChild(wrapper);

  function ensureAudio() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtxClass();

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 4500;

      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;

      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.08 * volume;

      filterNode.connect(analyserNode);
      analyserNode.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playNote(freq, durationSec, isLead = true) {
    if (!freq || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = isLead ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(freq, nextNoteTime);

    const attack = 0.01;
    const decay = durationSec * 0.85;
    const sustain = isLead ? 0.35 : 0.6;
    const noteGain = isLead ? 0.45 : 0.8;

    gain.gain.setValueAtTime(0.001, nextNoteTime);
    gain.gain.exponentialRampToValueAtTime(noteGain, nextNoteTime + attack);
    gain.gain.exponentialRampToValueAtTime(sustain * noteGain, nextNoteTime + attack + decay * 0.3);
    gain.gain.setValueAtTime(sustain * noteGain, nextNoteTime + durationSec - 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, nextNoteTime + durationSec);

    osc.connect(gain);
    gain.connect(filterNode);

    osc.start(nextNoteTime);
    osc.stop(nextNoteTime + durationSec);
  }

  function schedule() {
    const curTrack = TRACKS[currentTrackIdx];
    const sixteenthSec = 60 / curTrack.tempo / 4;
    const lookahead = 0.12;

    while (nextNoteTime < audioCtx.currentTime + lookahead) {
      // Schedule lead
      if (leadRemaining <= 0) {
        const [note, len] = curTrack.lead[leadNoteIdx];
        const dur = len * sixteenthSec;
        if (note) playNote(midiToFreq(note), dur, true);
        leadRemaining = len;
        leadNoteIdx = (leadNoteIdx + 1) % curTrack.lead.length;
      }

      // Schedule bass
      if (bassRemaining <= 0) {
        const [bnote, blen] = curTrack.bass[bassNoteIdx];
        const bdur = blen * sixteenthSec;
        if (bnote) playNote(midiToFreq(bnote), bdur, false);
        bassRemaining = blen;
        bassNoteIdx = (bassNoteIdx + 1) % curTrack.bass.length;
      }

      nextNoteTime += sixteenthSec;
      leadRemaining -= 1;
      bassRemaining -= 1;
    }
  }

  function startAudio() {
    ensureAudio();
    if (isPlaying) return;

    isPlaying = true;
    playBtn.setAttribute('aria-pressed', 'true');
    setButtonSvg(playBtn, 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', 20, 20);

    disc.classList.add('is-spinning');

    leadNoteIdx = 0;
    leadRemaining = 0;
    bassNoteIdx = 0;
    bassRemaining = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;

    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = setInterval(schedule, 25);

    renderVisualiser();

    const cur = TRACKS[currentTrackIdx];
    window.dispatchEvent(new CustomEvent('agemo:jukebox-active', { detail: { track: cur.id } }));
    notify({
      title: `now playing · ${cur.title}`,
      body: cur.subtitle,
      icon: '🎵',
    });
  }

  function stopAudio() {
    if (!isPlaying) return;
    isPlaying = false;
    playBtn.setAttribute('aria-pressed', 'false');
    setButtonSvg(playBtn, 'M8 5v14l11-7z', 20, 20, 'live-jukebox__play-icon');

    disc.classList.remove('is-spinning');

    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    vizBars.forEach((bar) => {
      bar.style.transform = 'scaleY(0.1)';
    });

    window.dispatchEvent(new CustomEvent('agemo:jukebox-inactive'));
  }

  function selectTrack(idx, autoStart = false) {
    currentTrackIdx = idx;
    const tr = TRACKS[idx];
    trackTitle.textContent = tr.title;
    trackSub.textContent = tr.subtitle;

    trackBtns.forEach((b, i) => {
      const isCur = i === idx;
      b.classList.toggle('is-active', isCur);
      b.setAttribute('aria-selected', isCur ? 'true' : 'false');
    });

    if (isPlaying) {
      stopAudio();
      startAudio();
    } else if (autoStart) {
      startAudio();
    }
  }

  function renderVisualiser() {
    if (!isPlaying || !analyserNode) return;

    const data = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(data);

    for (let i = 0; i < vizBars.length; i++) {
      const val = data[i * 2] || 0;
      const scale = Math.max(0.08, val / 255);
      vizBars[i].style.transform = `scaleY(${scale.toFixed(2)})`;
    }

    animId = requestAnimationFrame(renderVisualiser);
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  });

  prevBtn.addEventListener('click', () => {
    const nextIdx = (currentTrackIdx - 1 + TRACKS.length) % TRACKS.length;
    selectTrack(nextIdx, isPlaying);
  });

  nextBtn.addEventListener('click', () => {
    const nextIdx = (currentTrackIdx + 1) % TRACKS.length;
    selectTrack(nextIdx, isPlaying);
  });

  volSlider.addEventListener('input', () => {
    volume = parseFloat(volSlider.value);
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(0.08 * volume, audioCtx.currentTime);
    }
  });

  // Tab visibility: pause on hide, do not auto-resume
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) {
      stopAudio();
    }
  });

  // External events from terminal / launcher
  const onPlayReq = (e) => {
    const reqTrack = (e.detail || '').toLowerCase();
    const foundIdx = TRACKS.findIndex((t) => t.id === reqTrack);
    if (foundIdx !== -1) {
      selectTrack(foundIdx, false);
    }
    startAudio();
  };

  const onStopReq = () => {
    stopAudio();
  };

  window.addEventListener('agemo:jukebox-play', onPlayReq);
  window.addEventListener('agemo:jukebox-stop', onStopReq);

  return () => {
    stopAudio();
    window.removeEventListener('agemo:jukebox-play', onPlayReq);
    window.removeEventListener('agemo:jukebox-stop', onStopReq);
  };
}
