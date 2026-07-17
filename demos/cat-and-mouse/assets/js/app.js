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
      earInner: '#a95f4e',
      cream: '#f3d2a6',
      eye: '#aebc63',
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
      earInner: '#b96857',
      cream: '#f2d0a3',
      eye: '#c3d174',
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
    steerOmega: 0,
    acceleration: 0,
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
    skinNarrow: 1,
    support: { foreBias: 0, hindBias: 0, combined: 0 },
    lastForeTouch: { right: null, left: null },
    touchdowns: [],
    rig: {
      initialized: false,
      pelvis: { x: 0, y: 0, angle: -0.28, visualRadius: 31 },
      waist: { x: 0, y: 0, angle: -0.28, visualRadius: 23 },
      shoulders: { x: 0, y: 0, angle: -0.28, visualRadius: 30 },
      neck: { x: 0, y: 0, angle: -0.28, visualRadius: 17 },
      head: { x: 0, y: 0, angle: -0.28, visualRadius: 42 },
      curvature: 0,
      previousHeading: -0.28,
      turnVelocity: 0,
    },
  };

  const LEG_CONFIG = Object.freeze({
    rightHind: Object.freeze({ fore: false, side: 1, reach: 52 }),
    rightFore: Object.freeze({ fore: true, side: 1, reach: 51 }),
    leftHind: Object.freeze({ fore: false, side: -1, reach: 52 }),
    leftFore: Object.freeze({ fore: true, side: -1, reach: 51 }),
  });

  // The rig stays articulated, while the painted coat deliberately overlaps
  // its joints. These values describe hidden render sockets, not new bones.
  const SKIN_TOPOLOGY = Object.freeze({
    headBridgeT: 0.62,
    headRearReach: 17,
    headSocketCenterX: 2,
    headSocketRadiusX: 18,
    headSocketRadiusY: 17,
    tailSocketForward: -19,
    tailAnchorForward: -28,
    tailRootRadius: 7.5,
    tailTipRadius: 0.7,
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

  function approach(current, target, maxDelta) {
    if (current < target) return Math.min(target, current + maxDelta);
    return Math.max(target, current - maxDelta);
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const inv = 1 - t;
    const a = inv * inv * inv;
    const b = 3 * inv * inv * t;
    const c = 3 * inv * t * t;
    const d = t * t * t;
    return {
      x: p0.x * a + p1.x * b + p2.x * c + p3.x * d,
      y: p0.y * a + p1.y * b + p2.y * c + p3.y * d,
    };
  }

  function angleExpLerp(current, target, rate, dt) {
    return current + Gait.angleDelta(current, target) * (1 - Math.exp(-rate * dt));
  }

  function mixAngle(from, to, amount) {
    return from + Gait.angleDelta(from, to) * amount;
  }

  function constrainAngle(parent, child, limit) {
    return parent + Gait.clamp(Gait.angleDelta(parent, child), -limit, limit);
  }

  function constrainSpineCurvature(rig) {
    const names = ['pelvis', 'waist', 'shoulders', 'neck', 'head'];
    let direction = 0;
    let reversals = 0;
    for (let index = 1; index < names.length; index += 1) {
      const parent = rig[names[index - 1]];
      const child = rig[names[index]];
      const bend = Gait.angleDelta(parent.angle, child.angle);
      if (Math.abs(bend) < 0.025) continue;
      const nextDirection = Math.sign(bend);
      if (direction && nextDirection !== direction) {
        reversals += 1;
        if (reversals > 1) {
          child.angle = parent.angle;
          continue;
        }
      }
      direction = nextDirection;
    }
  }

  function rotatePoint(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function anatomy() {
    const scale = Gait.clamp(Math.min(viewport.width, viewport.height) / 720, 0.68, 1.14);
    return {
      scale,
      tailSegment: 12.5 * scale,
    };
  }

  function pointFromNode(node, forward, lateral) {
    const offset = rotatePoint(forward || 0, lateral || 0, node.angle);
    return { x: node.x + offset.x, y: node.y + offset.y };
  }

  function positionRigNodes(a) {
    const rig = cat.rig;
    const rearSway = (cat.support.hindBias * 2.35 + cat.bodySway * 0.42) * a.scale;
    const frontSway = (cat.support.foreBias * 1.55 - cat.bodySway * 0.28) * a.scale;

    rig.waist.x = cat.x;
    rig.waist.y = cat.y;

    const pelvisAxis = mixAngle(rig.waist.angle, rig.pelvis.angle, 0.58);
    const pelvisOffset = rotatePoint(-31 * a.scale, rearSway, pelvisAxis);
    rig.pelvis.x = rig.waist.x + pelvisOffset.x;
    rig.pelvis.y = rig.waist.y + pelvisOffset.y;

    const shoulderAxis = mixAngle(rig.waist.angle, rig.shoulders.angle, 0.56);
    const shoulderOffset = rotatePoint(32 * a.scale, frontSway, shoulderAxis);
    rig.shoulders.x = rig.waist.x + shoulderOffset.x;
    rig.shoulders.y = rig.waist.y + shoulderOffset.y;

    const neckAxis = mixAngle(rig.shoulders.angle, rig.neck.angle, 0.55);
    const neckOffset = rotatePoint(18 * a.scale, 0, neckAxis);
    rig.neck.x = rig.shoulders.x + neckOffset.x;
    rig.neck.y = rig.shoulders.y + neckOffset.y;

    const headAxis = mixAngle(rig.neck.angle, rig.head.angle, 0.52);
    const headOffset = rotatePoint(15 * a.scale, 0, headAxis);
    rig.head.x = rig.neck.x + headOffset.x;
    rig.head.y = rig.neck.y + headOffset.y;

    rig.pelvis.visualRadius = 31 * a.scale;
    rig.waist.visualRadius = 23 * a.scale;
    rig.shoulders.visualRadius = 30 * a.scale;
    rig.neck.visualRadius = 17 * a.scale;
    // Includes ear and whisker reach, not just the painted skull.
    rig.head.visualRadius = 42 * a.scale;
    rig.curvature = Gait.angleDelta(rig.pelvis.angle, rig.head.angle);
  }

  function initializeRig() {
    const rig = cat.rig;
    ['pelvis', 'waist', 'shoulders', 'neck', 'head'].forEach((name) => {
      rig[name].angle = cat.heading;
    });
    rig.previousHeading = cat.heading;
    rig.turnVelocity = 0;
    rig.initialized = true;
    positionRigNodes(anatomy());
  }

  function updateRig(dt) {
    const rig = cat.rig;
    if (!rig.initialized) initializeRig();

    const rawTurnVelocity = Gait.clamp(
      Gait.angleDelta(rig.previousHeading, cat.heading) / Math.max(0.001, dt),
      -4.5,
      4.5,
    );
    rig.turnVelocity = expLerp(rig.turnVelocity, rawTurnVelocity, 8.5, dt);
    rig.previousHeading = cat.heading;

    const a = anatomy();
    const motionWeight = Gait.clamp(cat.speed / (70 * a.scale), 0, 1);
    const forePhaseTwist = -cat.support.foreBias * 0.038 * motionWeight;
    const hindPhaseTwist = cat.support.hindBias * 0.048 * motionWeight;
    const shoulderLead = Gait.clamp(rig.turnVelocity * 0.026, -0.075, 0.075);
    const pelvisLag = Gait.clamp(rig.turnVelocity * 0.038, -0.105, 0.105);

    // Gaze leads only the head and neck. The torso follows filtered locomotion
    // turn velocity: shoulders anticipate a corner slightly while the pelvis
    // counter-lags, with tiny gait-phase counter-rotation between the girdles.
    const headTarget = cat.heading + cat.headYaw;
    rig.head.angle = angleExpLerp(rig.head.angle, headTarget, prey.active ? 15 : 6.8, dt);

    const headOffset = Gait.clamp(Gait.angleDelta(cat.heading, rig.head.angle), -0.7, 0.7);
    const neckTarget = cat.heading + headOffset * 0.58 + shoulderLead * 0.35;
    rig.neck.angle = angleExpLerp(rig.neck.angle, neckTarget, prey.active ? 10.5 : 5.4, dt);

    const shoulderTarget = cat.heading + shoulderLead + forePhaseTwist - cat.bodySway * 0.012;
    rig.shoulders.angle = angleExpLerp(rig.shoulders.angle, shoulderTarget, 7.4, dt);

    const waistTarget = cat.heading - pelvisLag * 0.28 + cat.bodySway * 0.01;
    rig.waist.angle = angleExpLerp(rig.waist.angle, waistTarget, 5.2, dt);

    const pelvisTarget = cat.heading - pelvisLag + hindPhaseTwist + cat.bodySway * 0.014;
    rig.pelvis.angle = angleExpLerp(rig.pelvis.angle, pelvisTarget, 3.15, dt);

    // Hard anatomical stops are applied every frame, after the soft filters.
    // They preserve visible articulation without permitting a broken neck or
    // an eel-like accumulation of small turns down the whole spine.
    rig.waist.angle = constrainAngle(rig.pelvis.angle, rig.waist.angle, 0.12);
    rig.shoulders.angle = constrainAngle(rig.waist.angle, rig.shoulders.angle, 0.18);
    rig.neck.angle = constrainAngle(rig.shoulders.angle, rig.neck.angle, 0.30);
    rig.head.angle = constrainAngle(rig.neck.angle, rig.head.angle, 0.42);
    rig.head.angle = constrainAngle(rig.pelvis.angle, rig.head.angle, 0.84);
    rig.head.angle = constrainAngle(rig.neck.angle, rig.head.angle, 0.42);
    constrainSpineCurvature(rig);
    positionRigNodes(a);
  }

  function localAnchor(limb) {
    const config = LEG_CONFIG[limb];
    const a = anatomy();
    return {
      x: (config.fore ? -1.5 : 1.5) * a.scale,
      y: config.side * (config.fore ? 12.5 : 15) * a.scale,
    };
  }

  function anchorWorld(limb) {
    if (!cat.rig.initialized) initializeRig();
    const config = LEG_CONFIG[limb];
    const anchor = localAnchor(limb);
    return pointFromNode(config.fore ? cat.rig.shoulders : cat.rig.pelvis, anchor.x, anchor.y);
  }

  function expectedPawWorld(limb, sample, futureSeconds) {
    const config = LEG_CONFIG[limb];
    const a = anatomy();
    const parent = config.fore ? cat.rig.shoulders : cat.rig.pelvis;
    const anchor = localAnchor(limb);
    const track = cat.state === 'stalk'
      ? (config.fore ? 7 : 6.3)
      : cat.state === 'chase'
        ? (config.fore ? 12 : 11)
        : (config.fore ? 9 : 8);
    const localX = anchor.x + (config.fore ? 13.5 : -9.5) * a.scale + sample.longitudinal;
    // Swinging paws arc inward toward the centerline. The root remains at the
    // shoulder/hip, but the visible paw track stays narrow beneath the body.
    const localY = config.side * track * a.scale - config.side * sample.lateral;
    const forward = Math.max(0, futureSeconds || 0) * cat.speed;
    return pointFromNode(parent, localX + forward, localY);
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
    if (!cat.rig.initialized) initializeRig();
    const base = pointFromNode(cat.rig.pelvis, SKIN_TOPOLOGY.tailAnchorForward * a.scale, 0);
    const tailHeading = cat.rig.pelvis.angle;
    for (let index = 0; index < 10; index += 1) {
      const distance = a.tailSegment * index;
      const x = base.x - Math.cos(tailHeading) * distance;
      const y = base.y - Math.sin(tailHeading) * distance;
      cat.tail.push({ x, y, oldX: x, oldY: y });
    }
  }

  function initializeFeet() {
    cat.feet = {};
    cat.lastForeTouch = { right: null, left: null };
    cat.touchdowns.length = 0;
    Gait.LIMBS.forEach((limb) => {
      const sample = Gait.sampleLimb(cat.gait, limb, 0);
      const point = expectedPawWorld(limb, sample, 0);
      cat.feet[limb] = {
        x: point.x,
        y: point.y,
        angle: cat.heading,
        lift: 0,
        phase: sample.phase,
        planted: sample.planted,
        wasPlanted: sample.planted,
        swingStartX: point.x,
        swingStartY: point.y,
        swingTargetX: point.x,
        swingTargetY: point.y,
        swingControl1X: point.x,
        swingControl1Y: point.y,
        swingControl2X: point.x,
        swingControl2Y: point.y,
        swingProgress: sample.swingProgress,
        registerReferenceX: null,
        registerReferenceY: null,
        registerError: null,
        recoveryActive: false,
        recoveryProgress: 0,
        recoveryDuration: 0.22,
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
    initializeRig();
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

  function updateSupportPose(dt) {
    let foreWeight = 0;
    let hindWeight = 0;
    let foreMoment = 0;
    let hindMoment = 0;
    Gait.LIMBS.forEach((limb) => {
      const config = LEG_CONFIG[limb];
      const sample = Gait.sampleLimb(cat.gait, limb, cat.strideLength);
      if (!sample.planted) return;
      const duty = Math.max(0.001, cat.gait.dutyFactors[limb] || cat.gait.dutyFactor);
      const u = Gait.clamp(sample.phase / duty, 0, 1);
      const weight = Gait.smoothstep(u / 0.12) * Gait.smoothstep((1 - u) / 0.16);
      if (config.fore) {
        foreWeight += weight;
        foreMoment += weight * config.side;
      } else {
        hindWeight += weight;
        hindMoment += weight * config.side;
      }
    });
    const foreTarget = foreWeight > 0.001 ? foreMoment / foreWeight : 0;
    const hindTarget = hindWeight > 0.001 ? hindMoment / hindWeight : 0;
    cat.support.foreBias = expLerp(cat.support.foreBias, foreTarget, 7.5, dt);
    cat.support.hindBias = expLerp(cat.support.hindBias, hindTarget, 7.5, dt);
    const combinedTarget = cat.support.foreBias * 0.44 + cat.support.hindBias * 0.56;
    cat.support.combined = expLerp(cat.support.combined, combinedTarget, 6.4, dt);
    cat.bodySway = expLerp(cat.bodySway, cat.support.combined, 6.4, dt);
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

    const turnError = Gait.angleDelta(cat.heading, targetAngle);
    const bodyMayTurn = cat.state !== 'watch' || Math.abs(turnError) > 0.46;
    const steerLimits = {
      prowl: [0.9, 2.5], observe: [0.72, 2.2], watch: [0.58, 1.9], stalk: [1.2, 3.5], chase: [2.4, 7],
    };
    const [omegaMax, alphaMax] = steerLimits[cat.state] || [1.1, 3];
    const desiredOmega = bodyMayTurn ? Gait.clamp(turnError * 2.35, -omegaMax, omegaMax) : 0;
    cat.steerOmega = approach(cat.steerOmega, desiredOmega, alphaMax * dt);
    cat.heading += cat.steerOmega * dt;

    const turnSlowdown = 1 - 0.45 * Gait.smoothstep((Math.abs(turnError) - 0.25) / 0.9);
    desiredSpeed *= turnSlowdown;
    const accelerationLimits = {
      prowl: [44, 66], observe: [36, 70], watch: [36, 70], stalk: [64, 92], chase: [220, 295],
    };
    const [accelerate, decelerate] = accelerationLimits[cat.state] || [60, 90];
    const previousSpeed = cat.speed;
    const speedLimit = (desiredSpeed >= cat.speed ? accelerate : decelerate) * a.scale;
    cat.speed = approach(cat.speed, desiredSpeed, speedLimit * dt);
    cat.acceleration = (cat.speed - previousSpeed) / Math.max(0.001, dt);
    cat.x += Math.cos(cat.heading) * cat.speed * dt;
    cat.y += Math.sin(cat.heading) * cat.speed * dt;

    // The former body-only margin allowed a turned head, ears and whiskers to
    // cross the viewport edge on compact screens. This radius encloses the
    // entire leading anatomy at every heading while remaining viable on very
    // small canvases.
    const margin = Math.max(12, Math.min(
      116 * a.scale,
      viewport.width * 0.5 - 12,
      viewport.height * 0.5 - 12,
    ));
    const clampedX = Gait.clamp(cat.x, margin, viewport.width - margin);
    const clampedY = Gait.clamp(cat.y, margin, viewport.height - margin);
    if (clampedX !== cat.x || clampedY !== cat.y) {
      cat.x = clampedX;
      cat.y = clampedY;
      const inward = Math.atan2(viewport.height * 0.5 - cat.y, viewport.width * 0.5 - cat.x);
      cat.steerOmega = approach(
        cat.steerOmega,
        Gait.clamp(Gait.angleDelta(cat.heading, inward) * 2, -omegaMax, omegaMax),
        alphaMax * dt,
      );
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
    cat.skinNarrow = expLerp(cat.skinNarrow, cat.state === 'stalk' ? 0.96 : 1, 6.2, dt);
    updateSupportPose(dt);

    updateRig(dt);
    updateFeet(dt);
    updateTail(dt);
  }

  function planPawSwing(limb, foot, options) {
    const a = anatomy();
    const config = LEG_CONFIG[limb];
    const settings = options || {};
    const duty = Math.max(0.001, cat.gait.dutyFactors[limb] || cat.gait.dutyFactor);
    const swingDuration = settings.duration || (1 - duty) / Math.max(0.08, cat.gait.cadence);
    const landingSample = {
      longitudinal: settings.recovery ? 0 : cat.strideLength * 0.5,
      lateral: 0,
    };
    const lookahead = swingDuration * (settings.recovery ? 0.42 : 0.82);
    const anatomicalTarget = expectedPawWorld(limb, landingSample, lookahead);
    let targetX = anatomicalTarget.x;
    let targetY = anatomicalTarget.y;
    foot.registerReferenceX = null;
    foot.registerReferenceY = null;

    if (!config.fore && !settings.recovery) {
      const side = config.side > 0 ? 'right' : 'left';
      const foreTouch = cat.lastForeTouch[side];
      if (foreTouch) {
        const parent = cat.rig.pelvis;
        const reach = Math.hypot(foreTouch.x - parent.x, foreTouch.y - parent.y) / a.scale;
        if (reach >= 17 && reach <= 82 && elapsed - foreTouch.time < 5.5) {
          const registerWeight = cat.state === 'stalk' ? 0.94 : cat.state === 'chase' ? 0.15 : 0.9;
          targetX += (foreTouch.x - targetX) * registerWeight;
          targetY += (foreTouch.y - targetY) * registerWeight;
          foot.registerReferenceX = foreTouch.x;
          foot.registerReferenceY = foreTouch.y;
        }
      }
    }

    foot.swingStartX = foot.x;
    foot.swingStartY = foot.y;
    foot.swingTargetX = targetX;
    foot.swingTargetY = targetY;
    const dx = targetX - foot.x;
    const dy = targetY - foot.y;
    const inwardX = Math.sin(cat.heading) * config.side;
    const inwardY = -Math.cos(cat.heading) * config.side;
    const inward = (cat.state === 'chase' ? 1.2 : 2.4) * a.scale;
    foot.swingControl1X = foot.x + dx * 0.2 + inwardX * inward;
    foot.swingControl1Y = foot.y + dy * 0.2 + inwardY * inward;
    foot.swingControl2X = targetX - dx * 0.2 + inwardX * inward * 0.35;
    foot.swingControl2Y = targetY - dy * 0.2 + inwardY * inward * 0.35;
  }

  function recordTouchdown(limb, foot, a, forced) {
    const config = LEG_CONFIG[limb];
    let registerError = null;
    if (config.fore) {
      const side = config.side > 0 ? 'right' : 'left';
      cat.lastForeTouch[side] = { x: foot.x, y: foot.y, heading: foot.angle, time: elapsed };
    } else if (Number.isFinite(foot.registerReferenceX) && Number.isFinite(foot.registerReferenceY)) {
      registerError = Math.hypot(foot.x - foot.registerReferenceX, foot.y - foot.registerReferenceY);
    }
    foot.registerError = registerError;
    cat.touchdowns.push({ limb, x: foot.x, y: foot.y, time: elapsed, registerError, forced: Boolean(forced) });
    if (cat.touchdowns.length > 24) cat.touchdowns.shift();
    if (cat.speed > 8) {
      prints.push({ x: foot.x, y: foot.y, heading: foot.angle, born: elapsed, scale: a.scale });
      if (prints.length > 32) prints.shift();
    }
  }

  function legReach(limb, foot) {
    const anchor = anchorWorld(limb);
    return {
      anchor,
      distance: Math.hypot(foot.x - anchor.x, foot.y - anchor.y),
    };
  }

  function legReachLimit(limb, a) {
    return LEG_CONFIG[limb].reach * a.scale;
  }

  function pointWithinLegReach(limb, x, y, a) {
    const anchor = anchorWorld(limb);
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const distance = Math.hypot(dx, dy);
    const limit = legReachLimit(limb, a);
    if (distance <= limit) return { x, y };
    const ratio = limit / Math.max(0.001, distance);
    return { x: anchor.x + dx * ratio, y: anchor.y + dy * ratio };
  }

  function constrainFootReach(limb, foot, a) {
    const point = pointWithinLegReach(limb, foot.x, foot.y, a);
    foot.x = point.x;
    foot.y = point.y;
  }

  function beginReachRecovery(limb, foot, a) {
    constrainFootReach(limb, foot, a);

    const duration = cat.state === 'chase' ? 0.15 : cat.state === 'stalk' ? 0.19 : 0.22;
    foot.wasPlanted = true;
    foot.planted = false;
    foot.settleActive = false;
    foot.recoveryActive = true;
    foot.recoveryProgress = 0;
    foot.recoveryDuration = duration;
    const duty = Math.max(0.001, cat.gait.dutyFactors[limb] || cat.gait.dutyFactor);
    cat.gait.legPhases[limb] = Math.min(0.999, duty + 0.001);
    planPawSwing(limb, foot, { duration, recovery: true });
  }

  function updateReachRecovery(limb, foot, dt, a) {
    foot.recoveryProgress = Math.min(1, foot.recoveryProgress + dt / foot.recoveryDuration);
    const u = Gait.smootherstep(foot.recoveryProgress);
    const point = cubicPoint(
      { x: foot.swingStartX, y: foot.swingStartY },
      { x: foot.swingControl1X, y: foot.swingControl1Y },
      { x: foot.swingControl2X, y: foot.swingControl2Y },
      { x: foot.swingTargetX, y: foot.swingTargetY },
      u,
    );
    foot.x = point.x;
    foot.y = point.y;
    constrainFootReach(limb, foot, a);
    foot.phase = 0.82 + foot.recoveryProgress * 0.18;
    foot.swingProgress = foot.recoveryProgress;
    foot.lift = Math.sin(Math.PI * foot.recoveryProgress) * 0.62;
    const travelAngle = Math.atan2(
      foot.swingTargetY - foot.swingStartY,
      foot.swingTargetX - foot.swingStartX,
    );
    foot.angle = cat.heading + Gait.angleDelta(cat.heading, travelAngle) * 0.16;

    if (foot.recoveryProgress >= 1) {
      foot.x = foot.swingTargetX;
      foot.y = foot.swingTargetY;
      constrainFootReach(limb, foot, a);
      foot.lift = 0;
      foot.phase = 0;
      foot.swingProgress = 0;
      foot.planted = true;
      foot.wasPlanted = true;
      foot.recoveryActive = false;
      cat.gait.legPhases[limb] = 0;
      cat.gait.dutyFactors[limb] = cat.gait.dutyFactor;
      recordTouchdown(limb, foot, a, true);
    }
  }

  function updateFeet(dt) {
    const a = anatomy();
    const settling = cat.speed < 2.5 * a.scale && cat.gait.cadence < 0.12;
    const airborne = Gait.LIMBS.filter((limb) => {
      const foot = cat.feet[limb];
      if (!foot) return false;
      return foot.recoveryActive || !Gait.sampleLimb(cat.gait, limb, cat.strideLength).planted;
    }).length;
    // Begin unloading before the anatomical stop is visible. Up to three feet
    // may be moving during a tight chase pivot, but one support is retained.
    const recoverySlots = Math.max(0, 3 - airborne);
    const overextended = Gait.LIMBS
      .filter((limb) => (
        cat.feet[limb]?.planted
        && !cat.feet[limb].recoveryActive
        && Gait.sampleLimb(cat.gait, limb, cat.strideLength).planted
      ))
      .map((limb) => ({
        limb,
        ratio: legReach(limb, cat.feet[limb]).distance / legReachLimit(limb, a),
      }))
      .filter((entry) => entry.ratio > 0.86)
      .sort((left, right) => right.ratio - left.ratio)
      .slice(0, recoverySlots);
    overextended.forEach(({ limb }) => beginReachRecovery(limb, cat.feet[limb], a));

    Gait.LIMBS.forEach((limb) => {
      const foot = cat.feet[limb];
      const sample = Gait.sampleLimb(cat.gait, limb, cat.strideLength);
      if (!foot) return;

      if (foot.recoveryActive) {
        updateReachRecovery(limb, foot, dt, a);
        return;
      }

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
        foot.settleProgress = Math.min(1, foot.settleProgress + dt / 0.3);
        const settleEase = Gait.smootherstep(foot.settleProgress);
        foot.x = foot.settleStartX + (foot.settleTargetX - foot.settleStartX) * settleEase;
        foot.y = foot.settleStartY + (foot.settleTargetY - foot.settleStartY) * settleEase;
        foot.lift = foot.settleStartLift * (1 - settleEase) + Math.sin(Math.PI * foot.settleProgress) * 0.28;
        foot.phase = 0.82 + foot.settleProgress * 0.18;
        if (foot.settleProgress >= 1) {
          foot.settleActive = false;
          foot.wasPlanted = true;
          foot.planted = true;
          foot.phase = 0;
          foot.lift = 0;
          foot.angle = cat.heading;
        }
        return;
      }

      foot.settleActive = false;
      foot.wasPlanted = foot.planted;
      foot.planted = sample.planted;
      foot.phase = sample.phase;
      foot.swingProgress = sample.swingProgress;

      if (sample.planted) {
        foot.lift = 0;
        if (!foot.wasPlanted) {
          foot.x = foot.swingTargetX;
          foot.y = foot.swingTargetY;
          constrainFootReach(limb, foot, a);
          const touchdownAnchor = anchorWorld(limb);
          const touchdownAngle = Math.atan2(foot.y - touchdownAnchor.y, foot.x - touchdownAnchor.x);
          foot.angle = cat.heading + Gait.angleDelta(cat.heading, touchdownAngle) * 0.16;
          recordTouchdown(limb, foot, a, false);
        }
      } else {
        if (foot.wasPlanted) planPawSwing(limb, foot);
        const u = Gait.smootherstep(sample.swingProgress);
        const point = cubicPoint(
          { x: foot.swingStartX, y: foot.swingStartY },
          { x: foot.swingControl1X, y: foot.swingControl1Y },
          { x: foot.swingControl2X, y: foot.swingControl2Y },
          { x: foot.swingTargetX, y: foot.swingTargetY },
          u,
        );
        foot.x = point.x;
        foot.y = point.y;
        constrainFootReach(limb, foot, a);
        foot.lift = sample.lift;
        const swingAngle = Math.atan2(
          foot.swingTargetY - foot.swingStartY,
          foot.swingTargetX - foot.swingStartX,
        );
        foot.angle = cat.heading + Gait.angleDelta(cat.heading, swingAngle) * 0.16;
      }
    });
    while (prints.length && elapsed - prints[0].born > 5.2) prints.shift();
  }

  function updateTail(dt) {
    if (!cat.tail.length) initializeTail();
    const a = anatomy();
    const base = pointFromNode(
      cat.rig.pelvis,
      SKIN_TOPOLOGY.tailAnchorForward * a.scale,
      cat.bodySway * 0.9 * a.scale,
    );
    const pelvisHeading = cat.rig.pelvis.angle;
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
      point.x += velocityX - Math.sin(pelvisHeading) * wave * dt * dt;
      point.y += velocityY + Math.cos(pelvisHeading) * wave * dt * dt;
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

  function smoothOpenPath(context, points, continuePath) {
    if (!points.length) return;
    if (continuePath) context.lineTo(points[0].x, points[0].y);
    else context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length - 1; index += 1) {
      const point = points[index];
      const next = points[index + 1];
      context.quadraticCurveTo(point.x, point.y, (point.x + next.x) * 0.5, (point.y + next.y) * 0.5);
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      context.lineTo(last.x, last.y);
    }
  }

  function traceTailRibbon(context, points, scale, offsetX, offsetY) {
    const left = [];
    const right = [];
    const lastIndex = Math.max(1, points.length - 1);
    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const t = index / lastIndex;
      // Keep the base plush and finish at a small but visible radius. A cat's
      // tail is tapered, not needle-pointed.
      const radius = (
        (SKIN_TOPOLOGY.tailRootRadius - SKIN_TOPOLOGY.tailTipRadius) * Math.pow(1 - t, 0.6)
        + SKIN_TOPOLOGY.tailTipRadius
      ) * scale;
      const nx = -dy / distance * radius;
      const ny = dx / distance * radius;
      left.push({ x: point.x + nx + offsetX, y: point.y + ny + offsetY });
      right.push({ x: point.x - nx + offsetX, y: point.y - ny + offsetY });
    });
    context.beginPath();
    smoothOpenPath(context, left);
    if (points.length > 1) {
      const last = points[points.length - 1];
      const previous = points[points.length - 2];
      const distance = Math.max(0.001, Math.hypot(last.x - previous.x, last.y - previous.y));
      context.quadraticCurveTo(
        last.x + (last.x - previous.x) / distance * 0.85 * scale + offsetX,
        last.y + (last.y - previous.y) / distance * 0.85 * scale + offsetY,
        right[right.length - 1].x,
        right[right.length - 1].y,
      );
    }
    const reversed = right.slice().reverse();
    smoothOpenPath(context, reversed, true);
    // Leave the root open. fill() closes it implicitly, while stroke() now
    // follows only the two outer flanks and rounded tip, so no tail-root seam
    // is painted across the pelvis.
  }

  function tailRenderPoints(a) {
    if (!cat.tail.length) return [];
    const socket = pointFromNode(
      cat.rig.pelvis,
      SKIN_TOPOLOGY.tailSocketForward * a.scale,
      cat.bodySway * 0.9 * a.scale,
    );
    return [socket, ...cat.tail];
  }

  function legGeometry(limb, foot, a) {
    const config = LEG_CONFIG[limb];
    const anchor = anchorWorld(limb);
    const dx = foot.x - anchor.x;
    const dy = foot.y - anchor.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const bend = config.side * (config.fore ? 4.4 : -3.5) * a.scale;
    const joint = {
      x: (anchor.x + foot.x) * 0.5 - dy / distance * bend,
      y: (anchor.y + foot.y) * 0.5 + dx / distance * bend,
    };
    return {
      config,
      anchor,
      joint,
      upperControl: {
        x: anchor.x + (joint.x - anchor.x) * 0.54 - dy / distance * bend * 0.18,
        y: anchor.y + (joint.y - anchor.y) * 0.54 + dx / distance * bend * 0.18,
      },
      lowerControl: {
        x: joint.x + (foot.x - joint.x) * 0.57 + dy / distance * bend * 0.1,
        y: joint.y + (foot.y - joint.y) * 0.57 - dx / distance * bend * 0.1,
      },
    };
  }

  function traceLegPath(context, geometry, foot, offsetX, offsetY) {
    const ox = offsetX || 0;
    const oy = offsetY || 0;
    context.beginPath();
    context.moveTo(geometry.anchor.x + ox, geometry.anchor.y + oy);
    context.quadraticCurveTo(
      geometry.upperControl.x + ox,
      geometry.upperControl.y + oy,
      geometry.joint.x + ox,
      geometry.joint.y + oy,
    );
    context.quadraticCurveTo(
      geometry.lowerControl.x + ox,
      geometry.lowerControl.y + oy,
      foot.x + ox,
      foot.y + oy,
    );
  }

  function traceHeadSilhouette(context, a) {
    context.beginPath();
    context.moveTo(-SKIN_TOPOLOGY.headRearReach * a.scale, 0);
    context.bezierCurveTo(-16 * a.scale, -11 * a.scale, -9 * a.scale, -19 * a.scale, 1 * a.scale, -21 * a.scale);
    context.bezierCurveTo(12 * a.scale, -22 * a.scale, 20 * a.scale, -16 * a.scale, 22 * a.scale, -10 * a.scale);
    context.bezierCurveTo(26 * a.scale, -7 * a.scale, 28 * a.scale, -3 * a.scale, 27 * a.scale, 0);
    context.bezierCurveTo(28 * a.scale, 3 * a.scale, 26 * a.scale, 7 * a.scale, 22 * a.scale, 10 * a.scale);
    context.bezierCurveTo(20 * a.scale, 16 * a.scale, 12 * a.scale, 22 * a.scale, 1 * a.scale, 21 * a.scale);
    context.bezierCurveTo(
      -9 * a.scale,
      19 * a.scale,
      -16 * a.scale,
      11 * a.scale,
      -SKIN_TOPOLOGY.headRearReach * a.scale,
      0,
    );
    context.closePath();
  }

  function traceEarSilhouette(context, a, side) {
    const tipX = side < 0 ? -15.2 : -13.2;
    const tipY = side * (side < 0 ? 31 : 29.8) * a.scale;
    context.beginPath();
    context.moveTo(-11 * a.scale, side * 13 * a.scale);
    context.bezierCurveTo(-12 * a.scale, side * 19 * a.scale, tipX * a.scale, side * 27.5 * a.scale, tipX * a.scale, tipY);
    context.bezierCurveTo(-5 * a.scale, side * 28 * a.scale, 5 * a.scale, side * 23 * a.scale, 10 * a.scale, side * 17 * a.scale);
    context.bezierCurveTo(4 * a.scale, side * 14 * a.scale, -4 * a.scale, side * 13 * a.scale, -11 * a.scale, side * 13 * a.scale);
    context.closePath();
  }

  function drawCatShadow(c) {
    const a = anatomy();
    const offsetX = 2.8 * a.scale;
    const offsetY = 4.6 * a.scale;

    ctx.save();
    ctx.fillStyle = c.catShadow;
    ctx.strokeStyle = c.catShadow;
    ctx.globalAlpha = 0.62;
    ctx.filter = `blur(${4.2 * a.scale}px)`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const renderTail = tailRenderPoints(a);
    if (renderTail.length > 2) {
      traceTailRibbon(ctx, renderTail, a.scale, offsetX, offsetY);
      ctx.fill();
    }

    Gait.LIMBS.forEach((limb) => {
      const foot = cat.feet[limb];
      if (!foot) return;
      const geometry = legGeometry(limb, foot, a);
      const liftOffset = foot.lift * 5.5 * a.scale;
      ctx.lineWidth = (geometry.config.fore ? 15 : 18) * a.scale;
      traceLegPath(ctx, geometry, foot, offsetX, offsetY + liftOffset * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        foot.x + offsetX,
        foot.y + offsetY + liftOffset,
        8.4 * a.scale,
        5.2 * a.scale,
        cat.heading,
        0,
        Gait.TAU,
      );
      ctx.fill();
    });

    traceBodySilhouette(ctx, a, offsetX, offsetY);
    ctx.fill();

    ctx.save();
    ctx.translate(cat.rig.head.x + offsetX, cat.rig.head.y + offsetY);
    ctx.rotate(cat.rig.head.angle);
    [-1, 1].forEach((side) => {
      traceEarSilhouette(ctx, a, side);
      ctx.fill();
    });
    traceHeadSilhouette(ctx, a);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawTail(c) {
    const a = anatomy();
    if (cat.tail.length < 2) return;
    const renderTail = tailRenderPoints(a);

    ctx.save();
    traceTailRibbon(ctx, renderTail, a.scale, 0, 0);
    // Every visible fur component starts from the same base coat. Highlights
    // are layered inside the silhouette, so overlaps cannot reveal different
    // gradient coordinate systems as a pasted-on joint.
    ctx.fillStyle = c.fur;
    ctx.fill();
    ctx.strokeStyle = c.furDark;
    ctx.globalAlpha = 0.46;
    ctx.lineWidth = 0.85 * a.scale;
    ctx.stroke();

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = c.furLight;
    ctx.lineWidth = 2.8 * a.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    smoothOpenPath(ctx, renderTail.slice(0, -1));
    ctx.stroke();

    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = c.stripe;
    [3, 5, 7].forEach((index) => {
      if (!renderTail[index]) return;
      const previous = renderTail[Math.max(0, index - 1)];
      const next = renderTail[Math.min(renderTail.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const t = index / (renderTail.length - 1);
      const halfWidth = (6.4 - t * 3.8) * a.scale;
      const nx = -dy / distance * halfWidth;
      const ny = dx / distance * halfWidth;
      ctx.lineWidth = (2.5 - t * 0.75) * a.scale;
      ctx.beginPath();
      ctx.moveTo(renderTail[index].x + nx, renderTail[index].y + ny);
      ctx.quadraticCurveTo(
        renderTail[index].x + dx / distance * 0.8 * a.scale,
        renderTail[index].y + dy / distance * 0.8 * a.scale,
        renderTail[index].x - nx,
        renderTail[index].y - ny,
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawLegs(c) {
    const a = anatomy();
    Gait.LIMBS.forEach((limb) => {
      const foot = cat.feet[limb];
      if (!foot) return;
      const geometry = legGeometry(limb, foot, a);
      const outerWidth = (geometry.config.fore ? 10.8 : 13.2) * a.scale;
      const innerWidth = (geometry.config.fore ? 7.5 : 9.4) * a.scale;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = c.furDark;
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = outerWidth;
      traceLegPath(ctx, geometry, foot, 0, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.fur;
      ctx.lineWidth = innerWidth;
      traceLegPath(ctx, geometry, foot, 0, 0);
      ctx.stroke();

      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = c.furLight;
      ctx.lineWidth = 2 * a.scale;
      traceLegPath(ctx, geometry, foot, -0.8 * a.scale, -0.6 * a.scale);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(foot.x, foot.y);
      ctx.rotate(Number.isFinite(foot.angle) ? foot.angle : cat.heading);
      ctx.scale(1 - foot.lift * 0.1, 1 - foot.lift * 0.15);
      ctx.fillStyle = c.furDark;
      ctx.globalAlpha = 0.52;
      ctx.beginPath();
      ctx.moveTo(8.2 * a.scale, 0);
      ctx.bezierCurveTo(7.1 * a.scale, -4.4 * a.scale, 1.2 * a.scale, -5.6 * a.scale, -4.8 * a.scale, -3.7 * a.scale);
      ctx.bezierCurveTo(-8.1 * a.scale, -2.4 * a.scale, -8.4 * a.scale, 2.3 * a.scale, -4.8 * a.scale, 3.7 * a.scale);
      ctx.bezierCurveTo(1.4 * a.scale, 5.6 * a.scale, 7.2 * a.scale, 4.3 * a.scale, 8.2 * a.scale, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c.fur;
      ctx.globalAlpha = 0.98;
      ctx.beginPath();
      ctx.moveTo(6.7 * a.scale, 0);
      ctx.bezierCurveTo(5.8 * a.scale, -3.2 * a.scale, 1 * a.scale, -4.3 * a.scale, -4.5 * a.scale, -2.8 * a.scale);
      ctx.bezierCurveTo(-6.8 * a.scale, -1.6 * a.scale, -6.8 * a.scale, 1.6 * a.scale, -4.5 * a.scale, 2.8 * a.scale);
      ctx.bezierCurveTo(1 * a.scale, 4.3 * a.scale, 5.8 * a.scale, 3.2 * a.scale, 6.7 * a.scale, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = c.furLight;
      ctx.lineWidth = 0.85 * a.scale;
      [-2.15, 0, 2.15].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(3.9 * a.scale, offset * a.scale);
        ctx.quadraticCurveTo(5.4 * a.scale, offset * a.scale * 1.06, 6.6 * a.scale, offset * 0.72 * a.scale);
        ctx.stroke();
      });
      ctx.restore();
    });
  }

  function bodyStations(a, offsetX, offsetY) {
    const ox = offsetX || 0;
    const oy = offsetY || 0;
    const narrow = cat.skinNarrow;
    const define = (node, forward, width) => {
      const point = pointFromNode(node, forward * a.scale, 0);
      return {
        x: point.x + ox,
        y: point.y + oy,
        angle: node.angle,
        width: width * a.scale * narrow,
      };
    };
    const stations = [
      define(cat.rig.pelvis, -27, 9.5),
      define(cat.rig.pelvis, -17, 22.5),
      define(cat.rig.pelvis, 1, 28),
      define(cat.rig.pelvis, 15, 24.5),
      define(cat.rig.waist, 0, 19.5),
      define(cat.rig.shoulders, -13, 23),
      define(cat.rig.shoulders, 1, 27),
      define(cat.rig.shoulders, 13, 20),
      define(cat.rig.neck, 3, 12.8),
    ];
    const bridgeT = SKIN_TOPOLOGY.headBridgeT;
    const bridgeDx = cat.rig.head.x - cat.rig.neck.x;
    const bridgeDy = cat.rig.head.y - cat.rig.neck.y;
    stations.push({
      x: cat.rig.neck.x + bridgeDx * bridgeT + ox,
      y: cat.rig.neck.y + bridgeDy * bridgeT + oy,
      angle: Math.atan2(bridgeDy, bridgeDx),
      width: 11 * a.scale * narrow,
    });
    return stations;
  }

  function bodyContours(a, offsetX, offsetY) {
    const stations = bodyStations(a, offsetX, offsetY);
    // Derive the skin normal from the continuous centerline rather than from
    // each bone's own angle. The bones can articulate beneath a G1-like coat
    // envelope without leaving geometric elbows at the joints.
    stations.forEach((station, index) => {
      const previous = stations[Math.max(0, index - 1)];
      const next = stations[Math.min(stations.length - 1, index + 1)];
      station.angle = Math.atan2(next.y - previous.y, next.x - previous.x);
    });
    const left = stations.map((station) => ({
      x: station.x - Math.sin(station.angle) * station.width,
      y: station.y + Math.cos(station.angle) * station.width,
    }));
    const right = stations.map((station) => ({
      x: station.x + Math.sin(station.angle) * station.width,
      y: station.y - Math.cos(station.angle) * station.width,
    }));
    return { stations, left, right, front: stations[stations.length - 1], rear: stations[0] };
  }

  function bodyFrontCapControl(contours, a) {
    return {
      x: contours.front.x + Math.cos(contours.front.angle) * 3 * a.scale,
      y: contours.front.y + Math.sin(contours.front.angle) * 3 * a.scale,
    };
  }

  function traceBodySilhouette(context, a, offsetX, offsetY) {
    const contours = bodyContours(a, offsetX, offsetY);
    const { left, right, front, rear } = contours;
    const frontControl = bodyFrontCapControl(contours, a);

    context.beginPath();
    smoothOpenPath(context, left);
    context.quadraticCurveTo(
      frontControl.x,
      frontControl.y,
      right[right.length - 1].x,
      right[right.length - 1].y,
    );
    smoothOpenPath(context, right.slice().reverse(), true);
    context.quadraticCurveTo(
      rear.x - Math.cos(rear.angle) * 3.5 * a.scale,
      rear.y - Math.sin(rear.angle) * 3.5 * a.scale,
      left[0].x,
      left[0].y,
    );
    context.closePath();
    return contours;
  }

  function strokeBodyFlanks(context, contours) {
    context.beginPath();
    smoothOpenPath(context, contours.left);
    context.stroke();
    context.beginPath();
    smoothOpenPath(context, contours.right);
    context.stroke();
  }

  function skinTopologySnapshot() {
    const a = anatomy();
    const contours = bodyContours(a, 0, 0);
    const renderTail = tailRenderPoints(a);
    const headCap = [
      contours.left[contours.left.length - 1],
      bodyFrontCapControl(contours, a),
      contours.right[contours.right.length - 1],
    ];
    // An ellipse is convex: if both endpoints and the control point of the
    // quadratic neck cap stay inside this conservative skull socket, the
    // entire cap stays hidden inside the painted head at every joint angle.
    const headSocketMaxNorm = Math.max(...headCap.map((point) => {
      const dx = point.x - cat.rig.head.x;
      const dy = point.y - cat.rig.head.y;
      const local = rotatePoint(dx, dy, -cat.rig.head.angle);
      const normalizedX = (
        local.x / a.scale - SKIN_TOPOLOGY.headSocketCenterX
      ) / SKIN_TOPOLOGY.headSocketRadiusX;
      const normalizedY = local.y / a.scale / SKIN_TOPOLOGY.headSocketRadiusY;
      return normalizedX * normalizedX + normalizedY * normalizedY;
    }));

    const rearInner = contours.stations[0];
    const rearOuter = contours.stations[1];
    const rearDx = rearOuter.x - rearInner.x;
    const rearDy = rearOuter.y - rearInner.y;
    const rearLengthSq = Math.max(0.001, rearDx * rearDx + rearDy * rearDy);
    const socket = renderTail[0] || { x: rearInner.x, y: rearInner.y };
    const socketT = Gait.clamp(
      ((socket.x - rearInner.x) * rearDx + (socket.y - rearInner.y) * rearDy) / rearLengthSq,
      0,
      1,
    );
    const rearCenter = {
      x: rearInner.x + rearDx * socketT,
      y: rearInner.y + rearDy * socketT,
    };
    const rearWidth = rearInner.width + (rearOuter.width - rearInner.width) * socketT;
    const socketLateral = Math.hypot(socket.x - rearCenter.x, socket.y - rearCenter.y);
    const tailRootClearance = rearWidth - socketLateral - SKIN_TOPOLOGY.tailRootRadius * a.scale;
    return {
      headSocketMargin: 1 - headSocketMaxNorm,
      tailRootClearance,
    };
  }

  function drawNodeEllipse(node, forward, lateral, radiusX, radiusY, rotation, a) {
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(node.angle);
    ctx.beginPath();
    ctx.ellipse(
      forward * a.scale,
      lateral * a.scale,
      radiusX * a.scale,
      radiusY * a.scale,
      rotation || 0,
      0,
      Gait.TAU,
    );
    ctx.fill();
    ctx.restore();
  }

  function drawFlankStripe(node, stripe, a) {
    const side = stripe.side;
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(node.angle);
    ctx.beginPath();
    ctx.moveTo(stripe.x * a.scale, side * stripe.edge * a.scale);
    ctx.bezierCurveTo(
      (stripe.x + stripe.drift * 0.25) * a.scale,
      side * (stripe.edge - 3.5) * a.scale,
      (stripe.x + stripe.drift * 0.78) * a.scale,
      side * (stripe.inner + 2.5) * a.scale,
      (stripe.x + stripe.drift) * a.scale,
      side * stripe.inner * a.scale,
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawBody(c) {
    const a = anatomy();

    const contours = traceBodySilhouette(ctx, a, 0, 0);
    ctx.fillStyle = c.fur;
    ctx.fill();
    ctx.strokeStyle = c.furDark;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 0.85 * a.scale;
    strokeBodyFlanks(ctx, contours);
    ctx.globalAlpha = 1;

    ctx.save();
    traceBodySilhouette(ctx, a, 0, 0);
    ctx.clip();

    // Soft volumes reveal pelvis, waist and shoulder masses without drawing a
    // literal spine or mirrored ribs over the animal.
    ctx.fillStyle = c.furLight;
    ctx.globalAlpha = 0.15;
    ctx.filter = `blur(${4.8 * a.scale}px)`;
    drawNodeEllipse(cat.rig.pelvis, -1, -3, 29, 12, -0.06, a);
    drawNodeEllipse(cat.rig.waist, 1, -2, 23, 8.5, 0.03, a);
    drawNodeEllipse(cat.rig.shoulders, 0, -3, 28, 11, 0.08, a);
    ctx.filter = 'none';

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = c.furLight;
    [
      [cat.rig.pelvis, -6, -15, 17, 8, -0.18],
      [cat.rig.pelvis, 4, 14, 15, 7, 0.16],
      [cat.rig.shoulders, 1, -15, 18, 7.5, 0.17],
      [cat.rig.shoulders, -3, 14, 16, 7, -0.15],
    ].forEach((shape) => drawNodeEllipse(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5], a));

    ctx.strokeStyle = c.stripe;
    ctx.globalAlpha = 0.68;
    ctx.lineWidth = 3 * a.scale;
    ctx.lineCap = 'round';
    [
      [cat.rig.pelvis, { x: -13, side: -1, edge: 25, inner: 11, drift: 7 }],
      [cat.rig.pelvis, { x: 5, side: -1, edge: 27, inner: 12, drift: -5 }],
      [cat.rig.pelvis, { x: -4, side: 1, edge: 27, inner: 12, drift: 8 }],
      [cat.rig.pelvis, { x: 13, side: 1, edge: 24, inner: 11, drift: -4 }],
      [cat.rig.waist, { x: -3, side: -1, edge: 19, inner: 9.5, drift: 6 }],
      [cat.rig.waist, { x: 6, side: 1, edge: 19, inner: 9, drift: -5 }],
      [cat.rig.shoulders, { x: -7, side: -1, edge: 25, inner: 12, drift: 6 }],
      [cat.rig.shoulders, { x: 8, side: -1, edge: 23, inner: 11, drift: -4 }],
      [cat.rig.shoulders, { x: -1, side: 1, edge: 26, inner: 12, drift: 7 }],
    ].forEach(([node, stripe]) => drawFlankStripe(node, stripe, a));

    // A few irregular flank marks keep the coat organic and deliberately
    // break the bilateral, skeleton-like pattern of the MVP.
    ctx.fillStyle = c.stripe;
    ctx.globalAlpha = 0.45;
    drawNodeEllipse(cat.rig.pelvis, -9, 17, 3.7, 1.8, 0.2, a);
    drawNodeEllipse(cat.rig.waist, 2, -13, 3.2, 1.5, -0.25, a);
    drawNodeEllipse(cat.rig.shoulders, 5, 17, 3.4, 1.6, 0.18, a);

    ctx.restore();

    drawHead(c, a);
  }

  function drawHead(c, a) {
    ctx.save();
    ctx.translate(cat.rig.head.x, cat.rig.head.y);
    ctx.rotate(cat.rig.head.angle);

    [-1, 1].forEach((side) => {
      ctx.fillStyle = c.furDark;
      traceEarSilhouette(ctx, a, side);
      ctx.fill();

      ctx.fillStyle = c.earInner;
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.moveTo(-9 * a.scale, side * 17 * a.scale);
      ctx.bezierCurveTo(-11 * a.scale, side * 21 * a.scale, -13 * a.scale, side * 26 * a.scale, -12 * a.scale, side * 27 * a.scale);
      ctx.bezierCurveTo(-5 * a.scale, side * 25 * a.scale, 1 * a.scale, side * 21 * a.scale, 5 * a.scale, side * 18 * a.scale);
      ctx.bezierCurveTo(0, side * 17 * a.scale, -5 * a.scale, side * 16 * a.scale, -9 * a.scale, side * 17 * a.scale);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = c.fur;
    traceHeadSilhouette(ctx, a);
    ctx.fill();
    ctx.strokeStyle = c.furDark;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = 0.85 * a.scale;
    ctx.beginPath();
    ctx.moveTo(-1 * a.scale, -21 * a.scale);
    ctx.bezierCurveTo(12 * a.scale, -22 * a.scale, 20 * a.scale, -16 * a.scale, 22 * a.scale, -10 * a.scale);
    ctx.bezierCurveTo(26 * a.scale, -7 * a.scale, 28 * a.scale, -3 * a.scale, 27 * a.scale, 0);
    ctx.bezierCurveTo(28 * a.scale, 3 * a.scale, 26 * a.scale, 7 * a.scale, 22 * a.scale, 10 * a.scale);
    ctx.bezierCurveTo(20 * a.scale, 16 * a.scale, 12 * a.scale, 22 * a.scale, 1 * a.scale, 21 * a.scale);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = c.stripe;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2.5 * a.scale;
    ctx.beginPath();
    ctx.moveTo(-13 * a.scale, 0);
    ctx.bezierCurveTo(-7 * a.scale, -1 * a.scale, -4 * a.scale, -1 * a.scale, 0, 0);
    ctx.stroke();
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(-10 * a.scale, side * 5 * a.scale);
      ctx.bezierCurveTo(-5 * a.scale, side * 5.5 * a.scale, -2 * a.scale, side * 8.8 * a.scale, 2 * a.scale, side * 9.2 * a.scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7 * a.scale, side * 12 * a.scale);
      ctx.quadraticCurveTo(-1 * a.scale, side * 14.5 * a.scale, 4 * a.scale, side * 14.2 * a.scale);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = c.cream;
    ctx.globalAlpha = 0.82;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(9 * a.scale, side * 2 * a.scale);
      ctx.bezierCurveTo(10 * a.scale, side * 9 * a.scale, 18 * a.scale, side * 12 * a.scale, 23 * a.scale, side * 7 * a.scale);
      ctx.bezierCurveTo(27 * a.scale, side * 3 * a.scale, 25 * a.scale, side * 0.8 * a.scale, 21 * a.scale, side * 0.7 * a.scale);
      ctx.bezierCurveTo(16 * a.scale, side * 0.4 * a.scale, 12 * a.scale, side * 0.6 * a.scale, 9 * a.scale, side * 2 * a.scale);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const gazeX = Math.cos(cat.eyeYaw) * 1.8 * a.scale;
    const gazeY = Math.sin(cat.eyeYaw) * 2.4 * a.scale;
    const eyeOpen = cat.state === 'stalk' ? 0.66 : cat.state === 'chase' ? 0.8 : cat.state === 'observe' ? 1.08 : 1;
    [-8, 8].forEach((side) => {
      const sign = Math.sign(side);
      ctx.fillStyle = c.eye;
      ctx.beginPath();
      ctx.moveTo(-0.2 * a.scale, side * a.scale);
      ctx.bezierCurveTo(2.6 * a.scale, (side - sign * 3.5 * eyeOpen) * a.scale, 8.8 * a.scale, (side - sign * 3.2 * eyeOpen) * a.scale, 12.3 * a.scale, side * a.scale);
      ctx.bezierCurveTo(8.9 * a.scale, (side + sign * 3.2 * eyeOpen) * a.scale, 2.5 * a.scale, (side + sign * 3.4 * eyeOpen) * a.scale, -0.2 * a.scale, side * a.scale);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.furDark;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 0.8 * a.scale;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.pupil;
      ctx.beginPath();
      ctx.ellipse(6.2 * a.scale + gazeX, side * a.scale + gazeY * eyeOpen, 1.15 * a.scale, 2.7 * eyeOpen * a.scale, 0, 0, Gait.TAU);
      ctx.fill();
      ctx.fillStyle = c.cream;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(7.1 * a.scale + gazeX, (side - sign * 0.8) * a.scale + gazeY * eyeOpen, 0.7 * a.scale, 0, Gait.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = c.mouseEar;
    ctx.beginPath();
    ctx.moveTo(25.5 * a.scale, 0);
    ctx.bezierCurveTo(23.7 * a.scale, -3.4 * a.scale, 19.7 * a.scale, -3.2 * a.scale, 19 * a.scale, -0.6 * a.scale);
    ctx.bezierCurveTo(18.8 * a.scale, 1.7 * a.scale, 23.2 * a.scale, 3.4 * a.scale, 25.5 * a.scale, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = c.furDark;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = 0.8 * a.scale;
    ctx.beginPath();
    ctx.moveTo(20.2 * a.scale, 0);
    ctx.quadraticCurveTo(18.5 * a.scale, 1.8 * a.scale, 16.5 * a.scale, 2.4 * a.scale);
    ctx.moveTo(20.2 * a.scale, 0);
    ctx.quadraticCurveTo(18.5 * a.scale, -1.8 * a.scale, 16.5 * a.scale, -2.4 * a.scale);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = c.whisker;
    ctx.lineWidth = 0.7 * a.scale;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.moveTo((18 - index * 0.7) * a.scale, side * (4.5 + index * 2.1) * a.scale);
        ctx.bezierCurveTo(
          27 * a.scale,
          side * (6.5 + index * 3) * a.scale,
          34 * a.scale,
          side * (7 + index * 5) * a.scale,
          (39 - index * 1.2) * a.scale,
          side * (6.5 + index * 6.4) * a.scale,
        );
        ctx.stroke();
      }

      ctx.fillStyle = c.furDark;
      ctx.globalAlpha = 0.45;
      [5.2, 7.7, 10.1].forEach((offset, index) => {
        ctx.beginPath();
        ctx.arc((17.8 - index * 0.65) * a.scale, side * offset * a.scale, 0.65 * a.scale, 0, Gait.TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
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
    drawCatShadow(c);
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
      cat: {
        x: cat.x,
        y: cat.y,
        heading: cat.heading,
        speed: cat.speed,
        acceleration: cat.acceleration,
        steerOmega: cat.steerOmega,
      },
      rig: Object.fromEntries(['pelvis', 'waist', 'shoulders', 'neck', 'head'].map((name) => [name, {
        x: cat.rig[name].x,
        y: cat.rig[name].y,
        angle: cat.rig[name].angle,
        visualRadius: cat.rig[name].visualRadius,
      }])),
      rigCurvature: cat.rig.curvature,
      rigScale: anatomy().scale,
      turnVelocity: cat.rig.turnVelocity,
      skin: Object.assign(skinTopologySnapshot(), { narrow: cat.skinNarrow }),
      support: Object.assign({}, cat.support),
      touchdowns: cat.touchdowns.map((touchdown) => Object.assign({}, touchdown)),
      mouse: { x: prey.x, y: prey.y, speed: prey.speed, active: prey.active },
      phases: Object.fromEntries(Gait.LIMBS.map((limb) => [limb, cat.feet[limb] ? cat.feet[limb].phase : null])),
      feet: Object.fromEntries(Gait.LIMBS.map((limb) => [limb, cat.feet[limb]
        ? {
            x: cat.feet[limb].x,
            y: cat.feet[limb].y,
            angle: cat.feet[limb].angle,
            lift: cat.feet[limb].lift,
            planted: cat.feet[limb].planted,
            swingProgress: cat.feet[limb].swingProgress,
            recoveryActive: cat.feet[limb].recoveryActive,
            registerError: cat.feet[limb].registerError,
            reach: legReach(limb, cat.feet[limb]).distance,
            reachLimit: legReachLimit(limb, anatomy()),
          }
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
