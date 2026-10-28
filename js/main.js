(function () {
  'use strict';

  const CONFIG = {
    candles: 5,
    typing: {
      speed: 55,
      punctuationPause: 350,
      paragraphDelay: 500,
    },
    music: {
      src: "",
      volume: 0.4,
      tempo: 110,
    },
    blowThreshold: 0.18,
    blowFrames: 8,
    confettiColors: ["#ff5c8a", "#ffd45c", "#8fd3fe", "#ffffff", "#ffb8cd"],
    floatingIcons: ["🎈", "🎁", "🎂", "🌸", "✨", "♥"],
  };

  const MAX_CANDLES = 7;

  const MELODY = [
    [67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
    [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
    [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
    [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 3]
  ];

  const $ = (selector, context = document) => context.querySelector(selector);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  function goToStep(name) {
    document.querySelectorAll('[data-step]').forEach((step) => {
      step.hidden = step.dataset.step !== name;
    });

    const heading = $(`[data-step="${name}"] [data-step-heading]`);
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }

  function fireConfetti(options) {
    if (typeof window.confetti !== 'function' || prefersReducedMotion) {
      return;
    }

    window.confetti(Object.assign({
      particleCount: 120,
      spread: 80,
      colors: CONFIG.confettiColors
    }, options));
  }

  function celebrate(duration = 1800) {
    const end = Date.now() + duration;

    (function frame() {
      fireConfetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
      fireConfetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  function initFloatingIcons() {
    const container = $('.floating-icons');
    const icons = CONFIG.floatingIcons;
    if (!container || !icons.length || prefersReducedMotion) {
      return;
    }

    const count = window.innerWidth < 600 ? 12 : 20;

    for (let i = 0; i < count; i += 1) {
      const icon = document.createElement('span');
      icon.className = 'floating-icons__item';
      icon.textContent = icons[i % icons.length];
      icon.style.left = `${Math.random() * 100}%`;
      icon.style.fontSize = `${16 + Math.random() * 18}px`;
      icon.style.animationDuration = `${8 + Math.random() * 10}s`;
      icon.style.animationDelay = `${-Math.random() * 18}s`;
      container.appendChild(icon);
    }
  }

  function createMusic() {
    const button = $('#music-toggle');
    let audio = null;
    let context = null;
    let master = null;
    let muted = false;
    let ducked = false;

    function scheduleMelody() {
      const beat = 60 / CONFIG.music.tempo;
      let time = context.currentTime + 0.1;

      MELODY.forEach(([note, beats]) => {
        const duration = beats * beat;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
        envelope.gain.setValueAtTime(0.0001, time);
        envelope.gain.exponentialRampToValueAtTime(1, time + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.9);
        oscillator.connect(envelope).connect(master);
        oscillator.start(time);
        oscillator.stop(time + duration);
        time += duration;
      });

      setTimeout(scheduleMelody, (time - context.currentTime + beat * 2) * 1000);
    }

    function update() {
      const silent = muted || ducked;

      if (audio) {
        if (silent) {
          audio.pause();
        } else {
          audio.play().catch(() => {});
        }
      }

      if (master) {
        master.gain.setTargetAtTime(silent ? 0 : CONFIG.music.volume, context.currentTime, 0.1);
      }

      button.setAttribute('aria-pressed', String(!muted));
    }

    function start() {
      if (audio || context) {
        return;
      }

      if (CONFIG.music.src) {
        audio = new Audio(CONFIG.music.src);
        audio.loop = true;
        audio.volume = CONFIG.music.volume;
      } else if (AudioContextClass) {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        scheduleMelody();
      } else {
        return;
      }

      button.hidden = false;
      update();
    }

    function duck(value) {
      ducked = value;
      update();
    }

    button.addEventListener('click', () => {
      muted = !muted;
      update();
    });

    return { start, duck };
  }

  function initGift(music) {
    const heading = $('#gift-heading');
    const gift = $('#gift-box');

    gift.addEventListener('click', () => {
      if (gift.classList.contains('is-open') || gift.classList.contains('is-shaking')) {
        return;
      }

      music.start();
      gift.classList.add('is-shaking');

      setTimeout(() => {
        gift.classList.remove('is-shaking');
        gift.classList.add('is-open');
        gift.setAttribute('aria-disabled', 'true');
        heading.textContent = 'Bất ngờ chưa!';

        const rect = gift.getBoundingClientRect();
        fireConfetti({
          particleCount: 180,
          spread: 100,
          startVelocity: 45,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 3) / window.innerHeight
          }
        });

        setTimeout(() => goToStep('cake'), 1000);
      }, 500);
    });
  }

  function getVolume(samples) {
    let sum = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const normalized = (samples[i] - 128) / 128;
      sum += normalized * normalized;
    }

    return Math.sqrt(sum / samples.length);
  }

  function createCandles(container) {
    const count = Math.min(Math.max(Math.round(CONFIG.candles) || 1, 1), MAX_CANDLES);
    const candles = [];

    for (let i = 0; i < count; i += 1) {
      const candle = document.createElement('button');
      candle.className = 'candle';
      candle.type = 'button';
      candle.setAttribute('aria-label', `Thổi tắt ngọn nến ${i + 1}`);
      candle.innerHTML = '<span class="candle__flame"></span><span class="candle__smoke"></span>';
      container.appendChild(candle);
      candles.push(candle);
    }

    return candles;
  }

  function createTypewriter() {
    const card = $('.wish');
    const targets = Array.from(card.querySelectorAll('[data-typewriter]'));
    let skipped = prefersReducedMotion;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, skipped ? 0 : ms));

    function createSpan(className, text) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      return span;
    }

    function prepare(element) {
      const label = createSpan('visually-hidden', element.innerText.trim());
      const visual = document.createElement('span');
      const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT);
      const textNodes = [];

      visual.setAttribute('aria-hidden', 'true');
      visual.append(...element.childNodes);
      element.replaceChildren(label, visual);

      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      // Each text node becomes a typed part plus an invisible remainder, keeping inline markup and the final layout
      return textNodes.map((node) => {
        const text = node.textContent.normalize('NFC');
        const typed = createSpan('typewriter__typed', '');
        const rest = createSpan('typewriter__rest', text);

        node.replaceWith(typed, rest);
        return { text, typed, rest };
      });
    }

    async function typePart({ text, typed, rest }) {
      const chars = Array.from(text);

      typed.classList.add('is-active');

      for (let i = 1; i <= chars.length && !skipped; i += 1) {
        const char = chars[i - 1];

        typed.textContent = chars.slice(0, i).join('');
        rest.textContent = chars.slice(i).join('');

        if (!/\s/.test(char)) {
          await wait(/[.,!?…]/.test(char) ? CONFIG.typing.punctuationPause : CONFIG.typing.speed);
        }
      }

      typed.textContent = text;
      rest.textContent = '';
      typed.classList.remove('is-active');
    }

    async function start() {
      const items = targets.map(prepare);

      card.classList.add('is-typing');

      for (const parts of items) {
        await wait(CONFIG.typing.paragraphDelay);

        for (const part of parts) {
          await typePart(part);
        }
      }

      card.classList.remove('is-typing');
    }

    card.addEventListener('click', () => {
      skipped = true;
    });

    return { start };
  }

  function initCake(music, onComplete) {
    const cake = $('#cake');
    const status = $('#cake-status');
    const micButton = $('#mic-start');
    const candles = createCandles($('.cake__candles', cake));
    let stream = null;
    let audioContext = null;
    let frameId = 0;
    let finished = false;

    const litCandles = () => candles.filter((candle) => !candle.classList.contains('is-out'));

    function stopMic() {
      cancelAnimationFrame(frameId);
      cake.style.setProperty('--wind', 0);

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
    }

    function finish() {
      if (finished) {
        return;
      }

      finished = true;
      stopMic();
      music.duck(false);
      micButton.hidden = true;
      celebrate();
      setTimeout(onComplete, 2400);
    }

    function extinguish(candle) {
      if (candle.classList.contains('is-out')) {
        return;
      }

      candle.classList.add('is-out');
      candle.disabled = true;

      const remaining = litCandles().length;
      status.textContent = remaining
        ? `Còn ${remaining} ngọn nến nữa, cố lên!`
        : 'Điều ước của em đã được gửi đi rồi!';

      if (!remaining) {
        finish();
      }
    }

    function listen(analyser, samples) {
      let loudFrames = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        const volume = getVolume(samples);

        cake.style.setProperty('--wind', Math.min(volume / CONFIG.blowThreshold, 1).toFixed(2));

        if (volume > CONFIG.blowThreshold) {
          loudFrames += 1;

          if (loudFrames >= CONFIG.blowFrames) {
            loudFrames = 0;
            const lit = litCandles();
            extinguish(lit[Math.floor(Math.random() * lit.length)]);
          }
        } else {
          loudFrames = 0;
        }

        if (litCandles().length) {
          frameId = requestAnimationFrame(tick);
        }
      };

      tick();
    }

    async function startMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AudioContextClass) {
        status.textContent = 'Trình duyệt không hỗ trợ micro, em chạm vào nến nhé.';
        return;
      }

      micButton.disabled = true;
      audioContext = new AudioContextClass();
      music.duck(true);

      try {
        // Noise suppression would filter out the blowing sound
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } catch (error) {
        stopMic();
        music.duck(false);
        micButton.disabled = false;
        status.textContent = 'Không bật được micro, em chạm vào nến nhé.';
        return;
      }

      if (finished) {
        stopMic();
        return;
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      micButton.hidden = true;
      status.textContent = 'Micro đã sẵn sàng, thổi thật mạnh nào!';
      listen(analyser, new Uint8Array(analyser.fftSize));
    }

    candles.forEach((candle) => {
      candle.addEventListener('click', () => extinguish(candle));
    });

    micButton.addEventListener('click', startMic);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const music = createMusic();
    const typewriter = createTypewriter();

    initFloatingIcons();
    initGift(music);
    initCake(music, () => {
      goToStep('wish');
      typewriter.start();
    });
    $('#replay').addEventListener('click', () => window.location.reload());
  });
})();
