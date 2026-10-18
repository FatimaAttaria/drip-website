const FRAME_COUNT = 50;
const FRAME_WIDTH = 478;
const FRAME_HEIGHT = 850;
const OPENING_FRAME = 14;
const framePath = (index) => (window.DRIP_FRAMES ? window.DRIP_FRAMES[index] : `frames/frame_${String(index + 1).padStart(3, '0')}.webp`);
const images = Array.from({ length: FRAME_COUNT }, (_, index) => {
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('error', () => {
    console.error(`Could not load animation frame: ${framePath(index)}`);
  });
  image.src = framePath(index);
  return image;
});

const canvas = document.getElementById('cv');
const context = canvas?.getContext('2d');
const wrap = document.getElementById('wrap');
const track = document.getElementById('track');
const stage = document.getElementById('stage');
const blue = document.querySelector('.blue');
const orbitField = document.getElementById('orbit-field');
const powerChain = document.getElementById('power-chain');
const powerHalo = document.getElementById('power-halo');
const powerIcons = powerChain ? [...powerChain.children] : [];
const number = document.getElementById('n');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const textItems = [...document.querySelectorAll('.t')].map((element) => ({
  element,
  window: element.dataset.w.split(',').map(Number),
  fromRight: element.classList.contains('R'),
  centered: element.classList.contains('C'),
}));

if (!canvas || !context || !wrap || !track || !stage || !blue || !orbitField || !number || !powerChain || !powerHalo) {
  throw new Error('The hydration animation is missing required page elements.');
}

const renderScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
canvas.width = Math.round(FRAME_WIDTH * renderScale);
canvas.height = Math.round(FRAME_HEIGHT * renderScale);
context.setTransform(renderScale, 0, 0, renderScale, 0, 0);
context.imageSmoothingEnabled = true;
context.imageSmoothingQuality = 'high';

const frameBounds = new Array(FRAME_COUNT);
const scaleStops = [[0, 1.1], [0.17, 1.06], [0.23, 1], [0.27, 1.1], [0.45, 1.08], [0.53, 1.03], [1, 1]];
const xStops = [[0, 5], [0.17, 2], [0.23, 0], [1, 0]];
const clamp = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (value) => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};
const interpolate = (stops, progress) => {
  for (let index = 1; index < stops.length; index += 1) {
    if (progress <= stops[index][0]) {
      const [start, startValue] = stops[index - 1];
      const [end, endValue] = stops[index];
      return startValue + (endValue - startValue) * (progress - start) / (end - start);
    }
  }
  return stops[stops.length - 1][1];
};

let progress = 0;
let pointerX = 0;
let pointerY = 0;
let targetX = 0;
let targetY = 0;
let lastTime = 0;
let lastFrame = -1;
let anchorY = 0.3;

function measureFrame(image) {
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = FRAME_WIDTH;
  scanCanvas.height = FRAME_HEIGHT;
  const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });

  if (!scanContext) {
    throw new Error('Could not prepare the bottle frame for rendering.');
  }

  scanContext.drawImage(image, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  const pixels = scanContext.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
  let left = FRAME_WIDTH;
  let top = FRAME_HEIGHT;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      if (pixels[(y * FRAME_WIDTH + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error('The bottle animation frame has no visible cutout.');
  }

  return {
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

window.addEventListener('pointermove', (event) => {
  targetX = event.clientX / window.innerWidth - 0.5;
  targetY = event.clientY / window.innerHeight - 0.5;
}, { passive: true });

function drawFrame(frame) {
  const frameIndex = Math.round(frame);
  if (frameIndex === lastFrame) return;
  const image = images[frameIndex];
  if (!image.complete || !image.naturalWidth) return;
  const bounds = frameBounds[frameIndex] || (frameBounds[frameIndex] = measureFrame(image));
  const fit = Math.min((FRAME_WIDTH * 0.59) / bounds.width, (FRAME_HEIGHT * 0.75) / bounds.height);
  lastFrame = frameIndex;
  // the charging point: centre of the cap's top face, as a fraction of the stage height
  anchorY = (FRAME_HEIGHT * 0.58 + (bounds.top - bounds.centerY) * fit + bounds.height * fit * -0.012) / FRAME_HEIGHT;
  const capReveal = progress >= 0.56 && progress <= 0.76;
  wrap.classList.toggle('cropped-bottom', bounds.bottom >= FRAME_HEIGHT - 6 || capReveal);
  context.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  context.save();
  context.filter = 'blur(0.18px)';
  context.drawImage(
    image,
    FRAME_WIDTH / 2 - bounds.centerX * fit,
    FRAME_HEIGHT * 0.58 - bounds.centerY * fit,
    FRAME_WIDTH * fit,
    FRAME_HEIGHT * fit,
  );
  const sheenProgress = smoothstep((progress - 0.015) / 0.22);
  const sheenOpacity = smoothstep(progress / 0.045) * (1 - smoothstep((progress - 0.2) / 0.08));
  const sheen = context.createLinearGradient(
    FRAME_WIDTH * (0.24 + sheenProgress * 0.35),
    0,
    FRAME_WIDTH * (0.4 + sheenProgress * 0.35),
    FRAME_HEIGHT,
  );
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.46, 'rgba(255, 255, 255, 0.025)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.32)');
  sheen.addColorStop(0.54, 'rgba(255, 255, 255, 0.025)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.globalAlpha = sheenOpacity;
  context.globalCompositeOperation = 'source-atop';
  context.fillStyle = sheen;
  context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  context.restore();
}

function animate(time) {
  const elapsed = lastTime ? Math.min(time - lastTime, 50) : 16;
  lastTime = time;

  const bounds = track.getBoundingClientRect();
  const scrollableDistance = Math.max(1, track.offsetHeight - window.innerHeight);
  const targetProgress = clamp(-bounds.top / scrollableDistance);
  const easing = reducedMotion ? 1 : 1 - Math.exp(-elapsed / 90);
  progress += (targetProgress - progress) * easing;
  pointerX += (targetX - pointerX) * easing;
  pointerY += (targetY - pointerY) * easing;

  drawFrame(OPENING_FRAME + progress * (FRAME_COUNT - 1 - OPENING_FRAME));

  const tiltY = reducedMotion ? 0 : Math.sin(progress * Math.PI * 2) * 1.6 + pointerX * 3;
  const tiltX = reducedMotion ? 0 : -pointerY * 2.5;
  wrap.style.opacity = String(1 - 0.82 * smoothstep((progress - 0.92) / 0.08));
  wrap.style.transform = `translateX(${interpolate(xStops, progress)}vw) scale(${interpolate(scaleStops, progress)}) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`;

  textItems.forEach(({ element, window: [start, end], fromRight, centered }) => {
    const opacity = Math.min(
      start === 0 ? 1 : smoothstep((progress - start) / 0.025),
      smoothstep((end - progress) / 0.025),
    );
    const offset = (fromRight ? 1 : -1) * (1 - opacity) * (centered ? 0 : 20);
    element.style.opacity = String(opacity);
    element.style.setProperty('--tx', `${offset}px`);

    if (element.querySelector('#n')) {
      number.textContent = String(Math.round(99 * smoothstep((progress - start) / 0.08)));
    }
  });

  const blueProgress = smoothstep((progress - 0.745) / 0.04);
  const orbitReveal = smoothstep((progress - 0.22) / 0.08) * (1 - smoothstep((progress - 0.78) / 0.08));
  const charge = smoothstep((progress - 0.615) / 0.06);
  orbitField.style.opacity = String(orbitReveal * (0.46 + charge * 0.44));
  orbitField.style.transform = `scale(${0.88 + orbitReveal * 0.12 + charge * 0.05})`;
  // charging sequence: blue spot -> it shoots up as a chain of power icons -> chain settles into a purple glow
  const rise = smoothstep((progress - 0.6) / 0.05);
  const settle = smoothstep((progress - 0.745) / 0.05);
  const mix = (a, b, t) => Math.round(a + (b - a) * clamp(t));
  powerIcons.forEach((icon, index) => {
    const lag = smoothstep(clamp(rise * 1.4 - index * 0.17));
    const lift = lag * index * 0.066 * (1 - settle) + lag * 0.02 * (1 - settle);
    const tone = charge * 1.45 - index * 0.2;
    const visible = lag * (1 - smoothstep((settle - 0.25) / 0.75));
    icon.style.top = `${(anchorY - lift) * 100}%`;
    icon.style.opacity = String(visible * (0.55 + 0.4 * (1 - index / 4)));
    icon.style.transform = `translate(-50%, -50%) scale(${(0.55 + 0.45 * lag) * (1 - 0.4 * settle)})`;
    icon.style.setProperty('--pc', `rgb(${mix(226, 192, tone)}, ${mix(214, 58, tone)}, 255)`);
    icon.style.setProperty('--pg', String(clamp(tone) * visible));
  });
  const haloOpacity = settle * (1 - smoothstep((progress - 0.87) / 0.06));
  powerHalo.style.top = `${anchorY * 100}%`;
  powerHalo.style.opacity = String(haloOpacity * 0.95);
  powerHalo.style.transform = `translate(-50%, -50%) scale(${0.45 + 0.75 * settle})`;
  blue.style.opacity = String(blueProgress);
  document.body.classList.toggle('dark', blueProgress > 0.5);

  window.requestAnimationFrame(animate);
}

images[OPENING_FRAME].decode().then(() => {
  window.requestAnimationFrame(animate);
}).catch((error) => {
  console.error('Could not load the opening hydration animation frame.', error);
});
