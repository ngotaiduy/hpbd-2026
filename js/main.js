(function () {
  'use strict';

  const CONFIG = {
    // RMS volume (0..1) that counts as blowing; raise it if candles go out too easily
    blowThreshold: 0.18,
    // Consecutive loud frames (~60 per second) needed to put out one candle
    blowFrames: 8,
    confettiColors: ['#ff5c8a', '#ffd45c', '#8fd3fe', '#ffffff', '#ffb8cd']
  };

  const $ = (selector, context = document) => context.querySelector(selector);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function initHearts() {
    const container = $('.hearts');
    if (!container || prefersReducedMotion) {
      return;
    }

    const count = window.innerWidth < 600 ? 12 : 20;

    for (let i = 0; i < count; i += 1) {
      const heart = document.createElement('span');
      heart.className = 'hearts__item';
      heart.textContent = '♥';
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.fontSize = `${12 + Math.random() * 20}px`;
      heart.style.animationDuration = `${8 + Math.random() * 10}s`;
      heart.style.animationDelay = `${-Math.random() * 18}s`;
      container.appendChild(heart);
    }
  }

  function initGift() {
    const heading = $('#gift-heading');
    const gift = $('#gift-box');

    gift.addEventListener('click', () => {
      if (gift.classList.contains('is-open') || gift.classList.contains('is-shaking')) {
        return;
      }

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

  function initCake() {
    const cake = $('#cake');
    const status = $('#cake-status');
    const micButton = $('#mic-start');
    const candles = Array.from(cake.querySelectorAll('.candle'));
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
      micButton.hidden = true;
      celebrate();
      setTimeout(() => goToStep('wish'), 2400);
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'Trình duyệt không hỗ trợ micro, em chạm vào nến nhé.';
        return;
      }

      micButton.disabled = true;

      try {
        // Noise suppression would filter out the blowing sound
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } catch (error) {
        micButton.disabled = false;
        status.textContent = 'Không bật được micro, em chạm vào nến nhé.';
        return;
      }

      if (finished) {
        stopMic();
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();

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
    initHearts();
    initGift();
    initCake();
    $('#replay').addEventListener('click', () => window.location.reload());
  });
})();
