// ═══════════════════════════════════════════
// SECTION A: Hand Tier Map
// ═══════════════════════════════════════════

const HAND_TIERS = {
  SINGLETONS: 1, LOWBALL: 1, PAI_GOW: 1,
  ONE_PAIR: 2, TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4, FLUSH: 4, BROADWAY: 4, WHEEL: 4,
  FULL_HOUSE: 5, FOUR_OF_A_KIND: 5, QUAD_DEUCES: 5,
  QUAD_ACES: 6, STRAIGHT_FLUSH: 6, QUINTS: 6,
  QUINT_ACES: 7, STEEL_WHEEL: 7, ROYAL_FLUSH: 7,
};

// ═══════════════════════════════════════════
// SECTION B: Easing & Math
// ═══════════════════════════════════════════

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function lerp(a, b, t) { return a + (b - a) * t; }
function quadBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

// ═══════════════════════════════════════════
// SECTION C: Particle System
// ═══════════════════════════════════════════

const ParticleSystem = {
  canvas: null,
  ctx: null,
  particles: [],
  running: false,

  init() {
    this.canvas = document.getElementById('particle-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  add(particles) {
    this.particles.push(...particles);
    if (!this.running) this.start();
  },

  start() {
    this.running = true;
    this.loop();
  },

  loop() {
    if (!this.running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.life -= p.decay;
      p.rotation += p.spin || 0;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.shape === 'star') {
        this.drawStar(ctx, p.size, p.color);
      } else if (p.shape === 'square') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.particles.length === 0) {
      this.running = false;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      requestAnimationFrame(() => this.loop());
    }
  },

  drawStar(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](Math.cos(angle) * size, Math.sin(angle) * size);
    }
    ctx.closePath();
    ctx.fill();
  },
};

// ═══════════════════════════════════════════
// Particle Presets
// ═══════════════════════════════════════════

function makeParticle(x, y, overrides) {
  return {
    x, y,
    vx: (Math.random() - 0.5) * 4,
    vy: (Math.random() - 0.5) * 4,
    gravity: 0.08,
    life: 1,
    decay: 0.02,
    size: 3,
    color: '#f4d03f',
    shape: 'circle',
    rotation: 0,
    spin: 0,
    ...overrides,
  };
}

const ParticlePresets = {
  place(x, y) {
    const particles = [];
    for (let i = 0; i < 10; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 1,
        size: 2 + Math.random() * 2,
        decay: 0.04,
        color: Math.random() > 0.3 ? '#f4d03f' : '#ffe66d',
      }));
    }
    ParticleSystem.add(particles);
  },

  scoreLow(x, y) {
    const particles = [];
    for (let i = 0; i < 8; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 3 - 1,
        size: 2 + Math.random() * 2,
        decay: 0.025,
        color: Math.random() > 0.5 ? '#f4d03f' : '#c9a81e',
      }));
    }
    ParticleSystem.add(particles);
  },

  scoreMid(x, y) {
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 8,
        vy: -Math.random() * 5 - 1,
        size: 3 + Math.random() * 3,
        decay: 0.018,
        shape: Math.random() > 0.5 ? 'star' : 'circle',
        color: Math.random() > 0.4 ? '#f4d03f' : '#ffffff',
        spin: (Math.random() - 0.5) * 0.15,
      }));
    }
    ParticleSystem.add(particles);
  },

  scoreHigh(x, y) {
    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 7 - 2,
        size: 3 + Math.random() * 4,
        decay: 0.015,
        shape: 'star',
        color: ['#f4d03f', '#ffe66d', '#ffffff', '#ffd700'][Math.floor(Math.random() * 4)],
        spin: (Math.random() - 0.5) * 0.2,
      }));
    }
    ParticleSystem.add(particles);
  },

  royalFlush(x, y) {
    const particles = [];
    const colors = ['#ff6b6b', '#ffa500', '#f4d03f', '#4ecdc4', '#45b7d1', '#a55eea', '#ff6b9d'];
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80;
      const speed = 3 + Math.random() * 8;
      particles.push(makeParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        decay: 0.01,
        gravity: 0.05,
        shape: 'star',
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 0.3,
      }));
    }
    ParticleSystem.add(particles);
  },

  confetti(x, y) {
    const particles = [];
    const colors = ['#ff6b6b', '#ffa500', '#f4d03f', '#4ecdc4', '#45b7d1', '#a55eea', '#ff6b9d', '#26de81'];
    for (let i = 0; i < 60; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 10 - 3,
        size: 4 + Math.random() * 4,
        decay: 0.008,
        gravity: 0.12,
        shape: 'square',
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 0.3,
      }));
    }
    ParticleSystem.add(particles);
  },

  scoreLand(x, y) {
    const particles = [];
    for (let i = 0; i < 12; i++) {
      particles.push(makeParticle(x, y, {
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 4 - 1,
        size: 2 + Math.random() * 3,
        decay: 0.03,
        shape: 'star',
        color: '#f4d03f',
        spin: (Math.random() - 0.5) * 0.2,
      }));
    }
    ParticleSystem.add(particles);
  },

  scoreByTier(x, y, tier) {
    if (tier <= 2) this.scoreLow(x, y);
    else if (tier <= 4) this.scoreMid(x, y);
    else if (tier <= 6) this.scoreHigh(x, y);
    else this.royalFlush(x, y);
  },
};

// ═══════════════════════════════════════════
// SECTION D: Screen Shake
// ═══════════════════════════════════════════

const ScreenShake = {
  wrapper: null,
  timer: null,

  init() {
    this.wrapper = document.getElementById('shake-wrapper');
  },

  trigger(tier) {
    if (!this.wrapper || tier <= 1) return;

    const configs = {
      2: { intensity: 1, duration: 50 },
      3: { intensity: 2, duration: 80 },
      4: { intensity: 4, duration: 120 },
      5: { intensity: 5, duration: 180 },
      6: { intensity: 7, duration: 250 },
      7: { intensity: 8, duration: 300 },
    };
    const cfg = configs[Math.min(tier, 7)] || configs[2];
    const start = performance.now();

    if (this.timer) cancelAnimationFrame(this.timer);

    const shake = () => {
      const elapsed = performance.now() - start;
      if (elapsed > cfg.duration) {
        this.wrapper.style.transform = '';
        return;
      }
      const progress = elapsed / cfg.duration;
      const decay = 1 - progress;
      const x = (Math.random() - 0.5) * 2 * cfg.intensity * decay;
      const y = (Math.random() - 0.5) * 2 * cfg.intensity * decay;
      this.wrapper.style.transform = `translate(${x}px, ${y}px)`;
      this.timer = requestAnimationFrame(shake);
    };
    shake();
  },
};

// ═══════════════════════════════════════════
// SECTION E: Rolling Score Counter
// ═══════════════════════════════════════════

function animateScoreCounter(element, from, to, durationMs) {
  return new Promise(resolve => {
    const start = performance.now();
    const diff = to - from;

    function tick() {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / durationMs, 1);
      const value = Math.round(from + diff * easeOutCubic(t));
      element.textContent = value.toLocaleString();
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    tick();
  });
}

// ═══════════════════════════════════════════
// SECTION F: Points Fly Animation
// ═══════════════════════════════════════════

function flyPointsToScoreboard(startX, startY, text, duration = 500) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'fly-points';
    el.textContent = text;
    document.body.appendChild(el);

    const scoreEl = document.getElementById('score-value');
    const scoreRect = scoreEl.getBoundingClientRect();
    const endX = scoreRect.left + scoreRect.width / 2;
    const endY = scoreRect.top + scoreRect.height / 2;

    // Control point above midpoint for arc
    const cpX = (startX + endX) / 2;
    const cpY = Math.min(startY, endY) - 80;

    const start = performance.now();

    function animate() {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(t);

      const x = quadBezier(startX, cpX, endX, eased);
      const y = quadBezier(startY, cpY, endY, eased);
      const scale = lerp(1.2, 0.6, eased);
      const opacity = t < 0.8 ? 1 : lerp(1, 0, (t - 0.8) / 0.2);

      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      el.style.opacity = opacity;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        el.remove();
        resolve();
      }
    }
    animate();
  });
}

// ═══════════════════════════════════════════
// SECTION G: Init
// ═══════════════════════════════════════════

function initEffects() {
  ParticleSystem.init();
  ScreenShake.init();
}
