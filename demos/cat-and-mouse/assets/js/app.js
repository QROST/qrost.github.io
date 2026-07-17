/* Cat & Mouse — top-down canvas interaction and procedural feline rig. */
(function startCatAndMouse() {
  'use strict';

  const Gait = window.CatGait;
  const I18n = window.CatMouseI18n;
  const canvas = document.getElementById('world');
  const errorCard = document.getElementById('canvas-error');
  const stateLabel = document.getElementById('behavior-label');
  const gaitName = document.getElementById('gait-name');
  const pauseButton = document.getElementById('pause-toggle');
  const themeButton = document.getElementById('theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const phaseElements = new Map();
  const THEME_KEY = 'qrost-cat-and-mouse-theme';

  function wireCanvasFailure() {
    if (errorCard) {
      errorCard.hidden = false;
      errorCard.textContent = I18n.t('canvasFailure');
    }
    if (pauseButton) {
      pauseButton.disabled = true;
      pauseButton.hidden = true;
    }
    function syncFallbackThemeUi() {
      const dark = document.documentElement.classList.contains('dark');
      if (themeMeta) themeMeta.content = dark ? '#171914' : '#e8dfcf';
      if (themeButton) {
        const ariaKey = dark ? 'themeLightAria' : 'themeDarkAria';
        const titleKey = dark ? 'themeLightTitle' : 'themeDarkTitle';
        themeButton.setAttribute('aria-label', I18n.t(ariaKey));
        themeButton.setAttribute('title', I18n.t(titleKey));
      }
      if (errorCard) errorCard.textContent = I18n.t('canvasFailure');
    }
    if (themeButton) {
      themeButton.addEventListener('click', () => {
        const dark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', dark);
        try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
        syncFallbackThemeUi();
      });
    }
    I18n.onChange(syncFallbackThemeUi);
    syncFallbackThemeUi();
  }

  if (!canvas || !Gait || !I18n) {
    if (errorCard) {
      errorCard.hidden = false;
      errorCard.textContent = I18n ? I18n.t('canvasFailure') : 'Canvas failed to start.';
    }
    return;
  }

  let ctx = null;
  try {
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  } catch (_) {}
  if (!ctx) {
    wireCanvasFailure();
    return;
  }

  document.querySelectorAll('[data-limb]').forEach((element) => {
    phaseElements.set(element.getAttribute('data-limb'), element);
  });

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const viewport = { width: 0, height: 0, dpr: 1 };
  const prints = [];
  let reducedMotion = reduceQuery.matches;
  let paused = false;
  let lastFrame = performance.now();
  let elapsed = 0;
  let rafId = 0;
  let uiAccumulator = 0;
  let initialized = false;

  const palette = {
    light: {
      rug: 'rgba(248, 243, 233, 0.78)',
      rugEdge: 'rgba(104, 79, 50, 0.17)',
      rugThread: 'rgba(119, 91, 58, 0.045)',
      catShadow: 'rgba(66, 43, 24, 0.19)',
      fur: '#c87340',
      furLight: '#e7a36c',
      furDark: '#7d4126',
      stripe: 'rgba(93, 45, 24, 0.52)',
      cream: '#f3d2a6',
      eye: '#cbdc75',
      pupil: '#241c17',
      mouse: '#736b64',
      mouseLight: '#a39a90',
      mouseEar: '#cf9d96',
      mouseTail: '#9c756f',
      print: 'rgba(116, 75, 43, 0.15)',
      whisker: 'rgba(71, 48, 31, 0.66)',
      alert: 'rgba(169, 91, 50, 0.38)',
    },
    dark: {
      rug: 'rgba(39, 42, 34, 0.82)',
      rugEdge: 'rgba(226, 206, 173, 0.11)',
      rugThread: 'rgba(223, 205, 174, 0.035)',
      catShadow: 'rgba(0, 0, 0, 0.42)',
      fur: '#d7804a',
      furLight: '#f0ad74',
      furDark: '#713a24',
      stripe: 'rgba(80, 36, 22, 0.62)',
      cream: '#f2d0a3',
      eye: '#d8e985',
      pupil: '#17130f',
      mouse: '#aaa29a',
      mouseLight: '#d0c7bd',
      mouseEar: '#d9a49e',
      mouseTail: '#bd8f88',
      print: 'rgba(224, 176, 126, 0.11)',
      whisker: 'rgba(244, 226, 202, 0.62)',
      alert: 'rgba(236, 154, 103, 0.38)',
    },
  };

  const prey = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    angle: Math.PI,
    active: false,
    justAppeared: false,
    appearedAt: -10,
    lastInputAt: 0,
    lastPointerType: 'mouse',
  };

  const cat = {
    x: 0,
    y: 0,
    heading: -0.28,
    speed: 0,
    state: 'prowl',
    stateSince: 0,
    headYaw: 0,
    eyeYaw: 0,
    gait: Gait.createController('prowl'),
    strideLength: 0,
    feet: {},
    tail: [],
    wanderGoal: { x: 0, y: 0 },
    nextWanderAt: 0,
    bodySway: 0,
  };

  const LEG_CONFIG = Object.freeze({
    rightHind: Object.freeze({ fore: false, side: 1 }),
    rightFore: Object.freeze({ fore: true, side: 1 }),
    leftHind: Object.freeze({ fore: false, side: -1 }),
    leftFore: Object.freeze({ fore: true, side: -1 }),
  });

  function isDark() {
    return document.documentElement.classList.contains('dark');
  }

  function colors() {
    return isDark() ? palette.dark : palette.light;
  }

  function expLerp(current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function worldFromLocal(localX, localY, extraX, extraY) {
    const rotated = rotatePoint(localX, localY, cat.heading);
    return {
      x: cat.x + (extraX || 0) + rotated.x,
      y: cat.y + (extraY || 0) + rotated.y,
    };
  }

  function anatomy() {
    const scale = Gait.clamp(Math.min(viewport.width, viewport.height) / 720, 0.68, 1.14);
    return {
      scale,
      bodyLength: 126 * scale,
      bodyWidth: 52 * scale,
      headRadius: 24 * scale,
      tailSegment: 12.5 * scale,
    };
  }

  function localAnchor(limb) {
    const config = LEG_CONFIG[limb];
    const a = anatomy();
    return {
      x: (config.fore ? 29 : -31) * a.scale,
      y: config.side * 17 * a.scale,
    };
  }

  function anchorWorld(limb) {
    const anchor = localAnchor(limb);
    return worldFromLocal(anchor.x, anchor.y);
  }

  function expectedPawWorld(limb, sample, futureSeconds) {
    const config = LEG_CONFIG[limb];
    const a = anatomy();
    const localX = (config.fore ? 35 : -37) * a.scale + sample.longitudinal;
    const localY = config.side * 34 * a.scale + config.side * sample.lateral;
    const forward = Math.max(0, futureSeconds || 0) * cat.speed;
    const rotated = rotatePoint(localX + forward, localY, cat.heading);
    return { x: cat.x + rotated.x, y: cat.y + rotated.y };
  }

  function chooseWanderGoal(force) {
    if (!force && elapsed < cat.nextWanderAt) return;
    const marginX = Math.min(150, viewport.width * 0.18);
    const marginY = Math.min(130, viewport.height * 0.2);
    const phase = elapsed * 0.37 + cat.x * 0.011 + cat.y * 0.007;
    const nx = 0.5 + Math.sin(phase * 1.31) * 0.34;
    const ny = 0.5 + Math.cos(phase * 0.91 + 1.4) * 0.32;
    cat.wanderGoal.x = marginX + nx * Math.max(40, viewport.width - marginX * 2);
    cat.wanderGoal.y = marginY + ny * Math.max(40, viewport.height - marginY * 2);
    cat.nextWanderAt = elapsed + 4.8 + (Math.sin(phase) + 1) * 1.4;
  }

  function initializeTail() {
    cat.tail.length = 0;
    const a = anatomy();
    const base = worldFromLocal(-a.bodyLength * 0.45, 0);
    for (let index = 0; index < 10; index += 1) {
      const distance = a.tailSegment * index;
      const x = base.x - Math.cos(cat.heading) * distance;
      const y = base.y - Math.sin(cat.heading) * distance;
      cat.tail.push({ x, y, oldX: x, oldY: y });
    }
  }

  function initializeFeet() {
    cat.feet = {};
    Gait.LIMBS.forEach((limb) => {
      const sample = Gait.sampleLimb(cat.gait, limb, 0);
      const point = expectedPawWorld(limb, sample, 0);
      cat.feet[limb] = {
        x: point.x,
        y: point.y,
        lift: 0,
        phase: sample.phase,
        planted: sample.planted,
        wasPlanted: sample.planted,
        swingOffsetX: 0,
        swingOffsetY: 0,
        settleActive: false,
        settleProgress: 0,
        settleStartX: point.x,
        settleStartY: point.y,
        settleStartLift: 0,
        settleTargetX: point.x,
        settleTargetY: point.y,
      };
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const oldWidth = viewport.width || rect.width;
    const oldHeight = viewport.height || rect.height;
    viewport.width = Math.max(1, rect.width);
    viewport.height = Math.max(1, rect.height);
    const nativeDpr = Math.min(window.devicePixelRatio || 1, 2);
    const areaCappedDpr = Math.sqrt(8_400_000 / Math.max(1, viewport.width * viewport.height));
    viewport.dpr = Math.max(0.75, Math.min(nativeDpr, areaCappedDpr));
    canvas.width = Math.round(viewport.width * viewport.dpr);
    canvas.height = Math.round(viewport.height * viewport.dpr);
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);

    if (!initialized) {
      cat.x = viewport.width * 0.34;
      cat.y = viewport.height * 0.58;
      prey.x = viewport.width * 0.68;
      prey.y = viewport.height * 0.43;
      initialized = true;
      chooseWanderGoal(true);
    } else {
      cat.x *= viewport.width / Math.max(1, oldWidth);
      cat.y *= viewport.height / Math.max(1, oldHeight);
      prey.x = Gait.clamp(prey.x * viewport.width / Math.max(1, oldWidth), 0, viewport.width);
      prey.y = Gait.clamp(prey.y * viewport.height / Math.max(1, oldHeight), 0, viewport.height);
      cat.wanderGoal.x *= viewport.width / Math.max(1, oldWidth);
      cat.wanderGoal.y *= viewport.height / Math.max(1, oldHeight);
    }
    initializeFeet();
    initializeTail();
    draw();
  }

  function setPreyPosition(x, y, inputTime, pointerType) {
    const now = Number.isFinite(inputTime) ? inputTime : performance.now();
    const nextX = Gait.clamp(x, 8, viewport.width - 8);
    const nextY = Gait.clamp(y, 8, viewport.height - 8);
    const wasActive = prey.active;
    const dt = Math.max(0.008, Math.min(0.12, (now - prey.lastInputAt) / 1000 || 0.016));
    const instantVx = (nextX - prey.x) / dt;
    const instantVy = (nextY - prey.y) / dt;
    const blend = wasActive ? 0.42 : 0;

    prey.vx = prey.vx * blend + instantVx * (1 - blend);
    prey.vy = prey.vy * blend + instantVy * (1 - blend);
    prey.speed = Math.hypot(prey.vx, prey.vy);
    if (prey.speed > 8) {
      const desiredAngle = Math.atan2(prey.vy, prey.vx);
      prey.angle += Gait.angleDelta(prey.angle, desiredAngle) * 0.58;
    }
    prey.x = nextX;
    prey.y = nextY;
    prey.active = true;
    prey.justAppeared = !wasActive;
    if (!wasActive) prey.appearedAt = elapsed;
    prey.lastInputAt = now;
    prey.lastPointerType = pointerType || prey.lastPointerType;
    if (paused) draw();
  }

  function releasePrey() {
    prey.active = false;
    prey.justAppeared = false;
    prey.vx = 0;
    prey.vy = 0;
    prey.speed = 0;
    if (paused) draw();
  }

  function stateKey(state) {
    return `state${state.charAt(0).toUpperCase()}${state.slice(1)}`;
  }

  function gaitKey(profileName) {
    return `gait${profileName.charAt(0).toUpperCase()}${profileName.slice(1)}`;
  }

  function setBehavior(next) {
    if (cat.state === next) return;
    cat.state = next;
    cat.stateSince = elapsed;
    document.body.dataset.behavior = next;
    refreshDynamicUi();
  }

  function updateBehavior() {
    const dx = prey.x - cat.x;
    const dy = prey.y - cat.y;
    const distance = Math.hypot(dx, dy);
    const scale = anatomy().scale;
    const next = Gait.chooseBehavior({
      targetActive: prey.active,
      justAppeared: prey.justAppeared,
      current: cat.state,
      stateAge: elapsed - cat.stateSince,
      distance: distance / scale,
      targetSpeed: prey.speed / scale,
      reducedMotion,
    });

    prey.justAppeared = false;
    if (next !== cat.state && (elapsed - cat.stateSince > 0.16 || next === 'observe')) {
      setBehavior(next);
    }
  }

  function updateCat(dt) {
    updateBehavior();
    let goalX = prey.x;
    let goalY = prey.y;
    let goalDistance = Math.hypot(goalX - cat.x, goalY - cat.y);

    if (!prey.active) {
      const wanderDistance = Math.hypot(cat.wanderGoal.x - cat.x, cat.wanderGoal.y - cat.y);
      if (wanderDistance < 54) {
        cat.speed = expLerp(cat.speed, 0, 2.8, dt);
        if (elapsed > cat.nextWanderAt - 3.2) chooseWanderGoal(true);
      } else if (elapsed >= cat.nextWanderAt) {
        chooseWanderGoal(true);
      }
      goalX = cat.wanderGoal.x;
      goalY = cat.wanderGoal.y;
      goalDistance = Math.hypot(goalX - cat.x, goalY - cat.y);
    } else if (cat.state === 'chase') {
      const lead = 0.16;
      goalX = Gait.clamp(prey.x + prey.vx * lead, 24, viewport.width - 24);
      goalY = Gait.clamp(prey.y + prey.vy * lead, 24, viewport.height - 24);
      goalDistance = Math.hypot(goalX - cat.x, goalY - cat.y);
    }

    const targetAngle = Math.atan2(goalY - cat.y, goalX - cat.x);
    const lookAngle = prey.active ? Math.atan2(prey.y - cat.y, prey.x - cat.x) : targetAngle;
    const lookRelative = Gait.angleDelta(cat.heading, lookAngle);
    const targetHeadYaw = Gait.clamp(lookRelative, -0.76, 0.76);
    cat.headYaw = expLerp(cat.headYaw, targetHeadYaw, prey.active ? 10 : 3.6, dt);
    cat.eyeYaw = expLerp(cat.eyeYaw, Gait.clamp(lookRelative - cat.headYaw, -0.34, 0.34), 14, dt);

    const a = anatomy();
    let desiredSpeed = Gait.targetSpeedForBehavior(
      cat.state,
      goalDistance / a.scale,
      prey.speed / a.scale,
      reducedMotion,
    ) * a.scale;
    if (cat.state === 'prowl') desiredSpeed *= Gait.clamp(goalDistance / 82, 0, 1);
    if (cat.state === 'watch' || cat.state === 'observe') desiredSpeed = 0;
    if (prey.active && goalDistance < 58 * a.scale) {
      desiredSpeed *= Gait.clamp((goalDistance - 28 * a.scale) / (30 * a.scale), 0, 1);
    }

    const turnRates = { prowl: 1.25, observe: 0.74, watch: 0.62, stalk: 1.58, chase: 3.25 };
    const turnRate = turnRates[cat.state] || 1.4;
    const turnError = Gait.angleDelta(cat.heading, targetAngle);
    const bodyMayTurn = cat.state !== 'watch' || Math.abs(turnError) > 0.46;
    if (bodyMayTurn) cat.heading += Gait.clamp(turnError, -turnRate * dt, turnRate * dt);

    const speedResponse = cat.state === 'chase' ? 6.4 : 3.2;
    cat.speed = expLerp(cat.speed, desiredSpeed, speedResponse, dt);
    cat.x += Math.cos(cat.heading) * cat.speed * dt;
    cat.y += Math.sin(cat.heading) * cat.speed * dt;

    const margin = Math.min(a.bodyLength * 0.52, Math.min(viewport.width, viewport.height) * 0.16);
    const clampedX = Gait.clamp(cat.x, margin, viewport.width - margin);
    const clampedY = Gait.clamp(cat.y, margin, viewport.height - margin);
    if (clampedX !== cat.x || clampedY !== cat.y) {
      cat.x = clampedX;
      cat.y = clampedY;
      const inward = Math.atan2(viewport.height * 0.5 - cat.y, viewport.width * 0.5 - cat.x);
      cat.heading += Gait.angleDelta(cat.heading, inward) * Math.min(1, dt * 3.2);
      chooseWanderGoal(true);
    }

    Gait.updateController(cat.gait, {
      dt,
      speed: cat.speed / a.scale,
      behavior: cat.state,
      reducedMotion,
    });
    const cadence = Math.max(0.01, cat.gait.cadence);
    cat.strideLength = cat.speed < 3 * a.scale
      ? expLerp(cat.strideLength, 0, 7, dt)
      : expLerp(cat.strideLength, Gait.clamp(cat.speed * cat.gait.dutyFactor / cadence, 9 * a.scale, 72 * a.scale), 6, dt);
    cat.bodySway = Math.sin(cat.gait.masterPhase * Gait.TAU) * Gait.clamp(cat.speed / (150 * a.scale), 0, 1);

    updateFeet(dt);
    updateTail(dt);
  }

  function updateFeet(dt) {
    const a = anatomy();
    const settling = cat.speed < 2.5 * a.scale && cat.gait.cadence < 0.12;
    Gait.LIMBS.forEach((limb) => {
      const foot = cat.feet[limb];
      const sample = Gait.sampleLimb(cat.gait, limb, cat.strideLength);
      const expected = expectedPawWorld(limb, sample, sample.planted ? 0 : (1 - sample.swingProgress) * 0.05);

      if (!foot) return;
      if (settling) {
        foot.wasPlanted = foot.planted;
        if (foot.planted && !foot.settleActive) {
          foot.lift = 0;
          return;
        }
        if (!foot.settleActive) {
          const restPoint = expectedPawWorld(limb, { longitudinal: 0, lateral: 0 }, 0);
          foot.settleActive = true;
          foot.settleProgress = 0;
          foot.settleStartX = foot.x;
          foot.settleStartY = foot.y;
          foot.settleStartLift = foot.lift;
          foot.settleTargetX = restPoint.x;
          foot.settleTargetY = restPoint.y;
        }
        foot.settleProgress = Math.min(1, foot.settleProgress + dt / 0.24);
        const settleEase = Gait.smoothstep(foot.settleProgress);
        foot.x = foot.settleStartX + (foot.settleTargetX - foot.settleStartX) * settleEase;
        foot.y = foot.settleStartY + (foot.settleTargetY - foot.settleStartY) * settleEase;
        foot.lift = foot.settleStartLift * (1 - settleEase) + Math.sin(Math.PI * foot.settleProgress) * 0.34;
        foot.phase = 0.82 + foot.settleProgress * 0.18;
        if (foot.settleProgress >= 1) {
          foot.settleActive = false;
          foot.wasPlanted = true;
          foot.planted = true;
          foot.phase = 0;
          foot.lift = 0;
          foot.swingOffsetX = 0;
          foot.swingOffsetY = 0;
        }
        return;
      }
      if (foot.settleActive) {
        foot.swingOffsetX = foot.x - expected.x;
        foot.swingOffsetY = foot.y - expected.y;
      }
      foot.settleActive = false;
      foot.wasPlanted = foot.planted;
      foot.planted = sample.planted;
      foot.phase = sample.phase;
      foot.lift = sample.lift;

      if (sample.planted) {
        if (!foot.wasPlanted) {
          foot.x = expected.x;
          foot.y = expected.y;
          if (cat.speed > 8) {
            prints.push({ x: foot.x, y: foot.y, heading: cat.heading, born: elapsed, scale: a.scale });
            if (prints.length > 32) prints.shift();
          }
        }
      } else {
        if (foot.wasPlanted) {
          foot.swingOffsetX = foot.x - expected.x;
          foot.swingOffsetY = foot.y - expected.y;
        }
        const correction = 1 - Gait.smoothstep(sample.swingProgress);
        foot.x = expected.x + foot.swingOffsetX * correction;
        foot.y = expected.y + foot.swingOffsetY * correction;
      }
    });
    while (prints.length && elapsed - prints[0].born > 5.2) prints.shift();
  }

  function updateTail(dt) {
    if (!cat.tail.length) initializeTail();
    const a = anatomy();
    const base = worldFromLocal(-a.bodyLength * 0.43, cat.bodySway * 1.3 * a.scale);
    const flickStrength = cat.state === 'watch' || cat.state === 'observe' ? 92 : cat.state === 'chase' ? 18 : 42;
    const flickRate = cat.state === 'watch' ? 2.25 : cat.state === 'chase' ? 0.75 : 1.15;

    cat.tail[0].x = base.x;
    cat.tail[0].y = base.y;
    cat.tail[0].oldX = base.x;
    cat.tail[0].oldY = base.y;
    const damping = Math.pow(0.84, dt * 60);
    for (let index = 1; index < cat.tail.length; index += 1) {
      const point = cat.tail[index];
      const velocityX = (point.x - point.oldX) * damping;
      const velocityY = (point.y - point.oldY) * damping;
      point.oldX = point.x;
      point.oldY = point.y;
      const weight = index / (cat.tail.length - 1);
      const wave = Math.sin(elapsed * flickRate * Gait.TAU - index * 0.42) * flickStrength * weight;
      point.x += velocityX - Math.sin(cat.heading) * wave * dt * dt;
      point.y += velocityY + Math.cos(cat.heading) * wave * dt * dt;
    }

    for (let pass = 0; pass < 5; pass += 1) {
      cat.tail[0].x = base.x;
      cat.tail[0].y = base.y;
      for (let index = 1; index < cat.tail.length; index += 1) {
        const previous = cat.tail[index - 1];
        const point = cat.tail[index];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        point.x = previous.x + dx / distance * a.tailSegment;
        point.y = previous.y + dy / distance * a.tailSegment;
      }
    }
  }

  function updatePrey(dt) {
    const decay = Math.exp(-dt * 4.8);
    prey.vx *= decay;
    prey.vy *= decay;
    prey.speed = Math.hypot(prey.vx, prey.vy);
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawRoom(c) {
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    const padX = Math.max(24, viewport.width * 0.055);
    const padY = Math.max(78, viewport.height * 0.11);
    const width = viewport.width - padX * 2;
    const height = viewport.height - padY * 1.75;
    roundedRectPath(ctx, padX, padY, width, height, Math.min(58, width * 0.08));
    ctx.fillStyle = c.rug;
    ctx.fill();
    ctx.strokeStyle = c.rugEdge;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    roundedRectPath(ctx, padX + 2, padY + 2, width - 4, height - 4, Math.min(56, width * 0.08));
    ctx.clip();
    ctx.strokeStyle = c.rugThread;
    ctx.lineWidth = 1;
    for (let index = 0; index < 28; index += 1) {
      const y = padY + (index + 0.5) * height / 28;
      const wobble = Math.sin(index * 2.31) * 9;
      ctx.beginPath();
      ctx.moveTo(padX + 12, y);
      ctx.bezierCurveTo(
        padX + width * 0.3, y + wobble,
        padX + width * 0.7, y - wobble,
        padX + width - 12, y + Math.sin(index) * 3,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPrints(c) {
    prints.forEach((print) => {
      const age = elapsed - print.born;
      const alpha = Gait.clamp(1 - age / 5.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(print.x, print.y);
      ctx.rotate(print.heading);
      ctx.fillStyle = c.print;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.3 * print.scale, 3.9 * print.scale, 0, 0, Gait.TAU);
      ctx.fill();
      [-2.8, 0, 2.8].forEach((offset) => {
        ctx.beginPath();
        ctx.ellipse(5.2 * print.scale, offset * print.scale, 1.5 * print.scale, 1.15 * print.scale, 0, 0, Gait.TAU);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  function drawTail(c) {
    const a = anatomy();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let index = 0; index < cat.tail.length - 1; index += 1) {
      const point = cat.tail[index];
      const next = cat.tail[index + 1];
      const taper = 1 - index / (cat.tail.length - 1) * 0.58;
      ctx.strokeStyle = c.furDark;
      ctx.lineWidth = (14.5 * taper + 1) * a.scale;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      ctx.strokeStyle = c.fur;
      ctx.lineWidth = (11.8 * taper + 0.8) * a.scale;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLegs(c) {
    const a = anatomy();
    Gait.LIMBS.forEach((limb) => {
      const config = LEG_CONFIG[limb];
      const foot = cat.feet[limb];
      const anchor = anchorWorld(limb);
      if (!foot) return;
      const dx = foot.x - anchor.x;
      const dy = foot.y - anchor.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const bend = config.side * (config.fore ? 7.2 : -5.6) * a.scale;
      const joint = {
        x: (anchor.x + foot.x) * 0.5 - dy / distance * bend,
        y: (anchor.y + foot.y) * 0.5 + dx / distance * bend,
      };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = c.furDark;
      ctx.lineWidth = 12.2 * a.scale;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(joint.x, joint.y);
      ctx.stroke();
      ctx.strokeStyle = c.fur;
      ctx.lineWidth = 8.5 * a.scale;
      ctx.beginPath();
      ctx.moveTo(joint.x, joint.y);
      ctx.lineTo(foot.x, foot.y);
      ctx.stroke();

      ctx.globalAlpha = 0.2 + (1 - foot.lift) * 0.25;
      ctx.fillStyle = c.catShadow;
      ctx.translate(foot.x + 2 * a.scale, foot.y + (3 + foot.lift * 5) * a.scale);
      ctx.rotate(cat.heading);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.2 * a.scale, 4.3 * a.scale, 0, 0, Gait.TAU);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(foot.x, foot.y);
      ctx.rotate(cat.heading);
      ctx.scale(1 - foot.lift * 0.1, 1 - foot.lift * 0.15);
      ctx.fillStyle = c.furDark;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7.2 * a.scale, 4.6 * a.scale, 0, 0, Gait.TAU);
      ctx.fill();
      ctx.fillStyle = c.furLight;
      [-2.3, 0, 2.3].forEach((offset) => {
        ctx.beginPath();
        ctx.ellipse(4.8 * a.scale, offset * a.scale, 1.2 * a.scale, 0.85 * a.scale, 0, 0, Gait.TAU);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  function drawBody(c) {
    const a = anatomy();
    const phase = cat.gait.masterPhase * Gait.TAU;
    const speedNorm = Gait.clamp(cat.speed / 210, 0, 1);
    const stalking = cat.state === 'stalk' ? 1 : 0;
    const stretch = 1 + Math.sin(phase * 2) * speedNorm * 0.025;
    const narrow = 1 - stalking * 0.06 + Math.cos(phase * 2) * speedNorm * 0.012;
    const rearSway = cat.bodySway * 2.5 * a.scale;
    const frontSway = -cat.bodySway * 1.5 * a.scale;

    ctx.save();
    ctx.translate(cat.x + 3 * a.scale, cat.y + 6 * a.scale);
    ctx.rotate(cat.heading);
    ctx.scale(stretch, narrow);
    ctx.fillStyle = c.catShadow;
    ctx.filter = `blur(${6 * a.scale}px)`;
    ctx.beginPath();
    ctx.ellipse(-4 * a.scale, 0, 64 * a.scale, 24 * a.scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    ctx.save();
    ctx.translate(cat.x, cat.y);
    ctx.rotate(cat.heading);
    ctx.scale(stretch, narrow);

    ctx.beginPath();
    ctx.moveTo(-60 * a.scale, rearSway);
    ctx.bezierCurveTo(-54 * a.scale, -18 * a.scale + rearSway, -36 * a.scale, -27 * a.scale + rearSway, -13 * a.scale, -25 * a.scale);
    ctx.bezierCurveTo(12 * a.scale, -27 * a.scale, 39 * a.scale, -22 * a.scale + frontSway, 52 * a.scale, -10 * a.scale + frontSway);
    ctx.bezierCurveTo(58 * a.scale, -4 * a.scale, 58 * a.scale, 4 * a.scale, 52 * a.scale, 10 * a.scale + frontSway);
    ctx.bezierCurveTo(38 * a.scale, 22 * a.scale + frontSway, 12 * a.scale, 27 * a.scale, -13 * a.scale, 25 * a.scale);
    ctx.bezierCurveTo(-37 * a.scale, 27 * a.scale + rearSway, -55 * a.scale, 18 * a.scale + rearSway, -60 * a.scale, rearSway);
    ctx.closePath();
    ctx.fillStyle = c.fur;
    ctx.fill();
    ctx.strokeStyle = c.furDark;
    ctx.lineWidth = 1.4 * a.scale;
    ctx.stroke();

    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = c.furLight;
    ctx.lineWidth = 7 * a.scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-45 * a.scale, -6 * a.scale + rearSway);
    ctx.bezierCurveTo(-14 * a.scale, -11 * a.scale, 19 * a.scale, -10 * a.scale, 42 * a.scale, -5 * a.scale + frontSway);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = c.stripe;
    ctx.lineWidth = 4.1 * a.scale;
    ctx.lineCap = 'round';
    [-35, -16, 4, 24].forEach((x, index) => {
      const length = (index === 0 ? 13 : 16) * a.scale;
      ctx.beginPath();
      ctx.moveTo(x * a.scale, -22 * a.scale);
      ctx.quadraticCurveTo((x + 4) * a.scale, -14 * a.scale, (x + 1) * a.scale, -8 * a.scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x * a.scale, 22 * a.scale);
      ctx.quadraticCurveTo((x + 4) * a.scale, length, (x + 1) * a.scale, 8 * a.scale);
      ctx.stroke();
    });

    ctx.fillStyle = c.cream;
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.ellipse(29 * a.scale, 0, 23 * a.scale, 13 * a.scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    drawHead(c, a, frontSway);
    ctx.restore();
  }

  function drawHead(c, a, frontSway) {
    const headX = 57 * a.scale;
    const headY = frontSway + Math.sin(cat.gait.masterPhase * Gait.TAU) * cat.speed / 190 * 0.8 * a.scale;
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(cat.headYaw);

    ctx.fillStyle = c.furDark;
    ctx.beginPath();
    ctx.moveTo(-5 * a.scale, -14 * a.scale);
    ctx.lineTo(-13 * a.scale, -28 * a.scale);
    ctx.lineTo(9 * a.scale, -22 * a.scale);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5 * a.scale, 14 * a.scale);
    ctx.lineTo(-13 * a.scale, 28 * a.scale);
    ctx.lineTo(9 * a.scale, 22 * a.scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = c.mouseEar;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-4 * a.scale, -17 * a.scale);
    ctx.lineTo(-10 * a.scale, -25 * a.scale);
    ctx.lineTo(5 * a.scale, -21 * a.scale);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4 * a.scale, 17 * a.scale);
    ctx.lineTo(-10 * a.scale, 25 * a.scale);
    ctx.lineTo(5 * a.scale, 21 * a.scale);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = c.fur;
    ctx.strokeStyle = c.furDark;
    ctx.lineWidth = 1.3 * a.scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 * a.scale, 21 * a.scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = c.cream;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(14 * a.scale, 0, 12 * a.scale, 12 * a.scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    const gazeX = Math.cos(cat.eyeYaw) * 1.8 * a.scale;
    const gazeY = Math.sin(cat.eyeYaw) * 2.4 * a.scale;
    [-8, 8].forEach((side) => {
      ctx.fillStyle = c.eye;
      ctx.beginPath();
      ctx.ellipse(6 * a.scale, side * a.scale, 5.3 * a.scale, 3.2 * a.scale, 0, 0, Gait.TAU);
      ctx.fill();
      ctx.fillStyle = c.pupil;
      ctx.beginPath();
      ctx.ellipse(7.2 * a.scale + gazeX, side * a.scale + gazeY, 1.15 * a.scale, 2.85 * a.scale, 0, 0, Gait.TAU);
      ctx.fill();
    });

    ctx.fillStyle = c.mouseEar;
    ctx.beginPath();
    ctx.moveTo(23 * a.scale, 0);
    ctx.lineTo(18.5 * a.scale, -3.1 * a.scale);
    ctx.lineTo(18.5 * a.scale, 3.1 * a.scale);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = c.whisker;
    ctx.lineWidth = 0.75 * a.scale;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.moveTo(17 * a.scale, side * (4.5 + index * 2.3) * a.scale);
        ctx.quadraticCurveTo(
          28 * a.scale,
          side * (7 + index * 4.4) * a.scale,
          38 * a.scale,
          side * (7 + index * 6.2) * a.scale,
        );
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawMouse(c) {
    if (!prey.active) return;
    const scale = Gait.clamp(Math.min(viewport.width, viewport.height) / 800, 0.78, 1.05);
    const speedStretch = Gait.clamp(prey.speed / 700, 0, 0.14);
    ctx.save();
    ctx.translate(prey.x, prey.y);
    ctx.rotate(prey.angle);

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = c.catShadow;
    ctx.beginPath();
    ctx.ellipse(-8 * scale, 4 * scale, 17 * scale, 9 * scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = c.mouseTail;
    ctx.lineWidth = 2.1 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20 * scale, 0);
    ctx.bezierCurveTo(
      -31 * scale,
      Math.sin(elapsed * 4.2) * 5 * scale,
      -39 * scale,
      Math.cos(elapsed * 3.1) * 8 * scale,
      -48 * scale,
      Math.sin(elapsed * 2.7) * 9 * scale,
    );
    ctx.stroke();

    ctx.scale(1 + speedStretch, 1 - speedStretch * 0.35);
    ctx.fillStyle = c.mouse;
    ctx.beginPath();
    ctx.ellipse(-7 * scale, 0, 17 * scale, 10 * scale, 0, 0, Gait.TAU);
    ctx.fill();
    ctx.fillStyle = c.mouseLight;
    ctx.beginPath();
    ctx.ellipse(4 * scale, 0, 9 * scale, 7.5 * scale, 0, 0, Gait.TAU);
    ctx.fill();

    [-6, 6].forEach((side) => {
      ctx.fillStyle = c.mouseEar;
      ctx.beginPath();
      ctx.arc(-1 * scale, side * scale, 4.5 * scale, 0, Gait.TAU);
      ctx.fill();
    });
    ctx.fillStyle = c.pupil;
    [-3.7, 3.7].forEach((side) => {
      ctx.beginPath();
      ctx.arc(6.2 * scale, side * scale, 1.15 * scale, 0, Gait.TAU);
      ctx.fill();
    });
    ctx.fillStyle = '#d5847b';
    ctx.beginPath();
    ctx.arc(13.2 * scale, 0, 2 * scale, 0, Gait.TAU);
    ctx.fill();

    ctx.strokeStyle = c.whisker;
    ctx.lineWidth = 0.55 * scale;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(10 * scale, side * 2.5 * scale);
      ctx.lineTo(21 * scale, side * 7.5 * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10 * scale, side * 1.2 * scale);
      ctx.lineTo(22 * scale, side * 2.8 * scale);
      ctx.stroke();
    });
    ctx.restore();

    const arrivalAge = elapsed - prey.appearedAt;
    if (arrivalAge >= 0 && arrivalAge < 0.9) {
      ctx.save();
      ctx.globalAlpha = 1 - arrivalAge / 0.9;
      ctx.strokeStyle = c.alert;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(prey.x, prey.y, 18 + arrivalAge * 27, 0, Gait.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    const c = colors();
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    drawRoom(c);
    drawPrints(c);
    drawTail(c);
    drawLegs(c);
    drawBody(c);
    drawMouse(c);
  }

  function refreshDynamicUi() {
    if (stateLabel) stateLabel.textContent = paused ? I18n.t('paused') : I18n.t(stateKey(cat.state));
    if (gaitName) gaitName.textContent = I18n.t(gaitKey(cat.gait.profileName));
    if (pauseButton) {
      const key = paused ? 'resumeAria' : 'pauseAria';
      pauseButton.setAttribute('aria-label', I18n.t(key));
      pauseButton.setAttribute('title', I18n.t(key));
      pauseButton.setAttribute('aria-pressed', String(paused));
    }
    if (themeButton) {
      const key = isDark() ? 'themeLightAria' : 'themeDarkAria';
      const titleKey = isDark() ? 'themeLightTitle' : 'themeDarkTitle';
      themeButton.setAttribute('aria-label', I18n.t(key));
      themeButton.setAttribute('title', I18n.t(titleKey));
    }
    Gait.LIMBS.forEach((limb) => {
      const element = phaseElements.get(limb);
      if (element) element.setAttribute('title', I18n.t(`${limb}Long`));
    });
  }

  function refreshPhaseUi() {
    if (gaitName) gaitName.textContent = I18n.t(gaitKey(cat.gait.profileName));
    Gait.LIMBS.forEach((limb) => {
      const element = phaseElements.get(limb);
      const foot = cat.feet[limb];
      if (!element || !foot) return;
      element.classList.toggle('is-contact', foot.planted);
      element.classList.toggle('is-swing', !foot.planted && foot.lift > 0.12);
      element.style.setProperty('--phase', String(foot.phase));
    });
  }

  function setPaused(next) {
    paused = Boolean(next);
    document.body.classList.toggle('paused', paused);
    lastFrame = performance.now();
    refreshDynamicUi();
    draw();
    if (!paused && !rafId) rafId = requestAnimationFrame(frame);
  }

  function readStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; }
  }

  function applyTheme(dark, persist) {
    document.documentElement.classList.toggle('dark', Boolean(dark));
    if (persist) {
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
    }
    if (themeMeta) themeMeta.content = dark ? '#171914' : '#e8dfcf';
    refreshDynamicUi();
    draw();
  }

  function frame(timestamp) {
    rafId = 0;
    if (paused) {
      draw();
      return;
    }
    const dt = Math.min(0.034, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    if (dt > 0) {
      elapsed += dt;
      updatePrey(dt);
      updateCat(dt);
      uiAccumulator += dt;
      if (uiAccumulator > 0.075) {
        uiAccumulator = 0;
        refreshPhaseUi();
      }
    }
    draw();
    rafId = requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerenter', (event) => {
    const rect = canvas.getBoundingClientRect();
    setPreyPosition(event.clientX - rect.left, event.clientY - rect.top, event.timeStamp, event.pointerType);
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    setPreyPosition(event.clientX - rect.left, event.clientY - rect.top, event.timeStamp, event.pointerType);
    if (event.pointerType !== 'mouse') event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    setPreyPosition(event.clientX - rect.left, event.clientY - rect.top, event.timeStamp, event.pointerType);
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  });

  canvas.addEventListener('pointerup', (event) => {
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  });

  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') releasePrey();
  });

  canvas.addEventListener('pointercancel', releasePrey);

  canvas.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 54 : 28;
    const keyDelta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (keyDelta) {
      if (!prey.active) {
        prey.x = Gait.clamp(cat.x + Math.cos(cat.heading) * 150, 20, viewport.width - 20);
        prey.y = Gait.clamp(cat.y + Math.sin(cat.heading) * 150, 20, viewport.height - 20);
      }
      setPreyPosition(prey.x + keyDelta[0], prey.y + keyDelta[1], performance.now(), 'keyboard');
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      releasePrey();
      event.preventDefault();
    } else if (event.key === ' ' || event.key === 'Spacebar') {
      setPaused(!paused);
      event.preventDefault();
    } else if (event.key === 'Enter' && !prey.active) {
      setPreyPosition(viewport.width * 0.66, viewport.height * 0.44, performance.now(), 'keyboard');
      event.preventDefault();
    }
  });

  pauseButton.addEventListener('click', () => setPaused(!paused));
  themeButton.addEventListener('click', () => applyTheme(!isDark(), true));

  reduceQuery.addEventListener('change', (event) => {
    reducedMotion = event.matches;
  });
  darkQuery.addEventListener('change', (event) => {
    if (!readStoredTheme()) applyTheme(event.matches, false);
  });
  I18n.onChange(refreshDynamicUi);

  document.addEventListener('visibilitychange', () => {
    lastFrame = performance.now();
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  document.body.dataset.behavior = cat.state;
  resizeCanvas();
  applyTheme(isDark(), false);
  refreshDynamicUi();
  refreshPhaseUi();
  rafId = requestAnimationFrame(frame);

  window.__catMouseDemo = Object.freeze({
    getSnapshot: () => ({
      behavior: cat.state,
      gait: cat.gait.profileName,
      cat: { x: cat.x, y: cat.y, heading: cat.heading, speed: cat.speed },
      mouse: { x: prey.x, y: prey.y, speed: prey.speed, active: prey.active },
      phases: Object.fromEntries(Gait.LIMBS.map((limb) => [limb, cat.feet[limb] ? cat.feet[limb].phase : null])),
      feet: Object.fromEntries(Gait.LIMBS.map((limb) => [limb, cat.feet[limb]
        ? { x: cat.feet[limb].x, y: cat.feet[limb].y, lift: cat.feet[limb].lift, planted: cat.feet[limb].planted }
        : null])),
      tailTip: cat.tail.length
        ? { x: cat.tail[cat.tail.length - 1].x, y: cat.tail[cat.tail.length - 1].y }
        : null,
      paused,
      reducedMotion,
      viewport: Object.assign({}, viewport),
    }),
    moveMouse: (x, y) => setPreyPosition(Number(x), Number(y), performance.now(), 'test'),
    releaseMouse: releasePrey,
    setPaused,
    setTheme: (mode) => applyTheme(mode === 'dark', true),
    setLanguage: I18n.setLanguage,
  });
})();
