/* Cat & Mouse — top-down canvas interaction and procedural feline rig. */
(function startCatAndMouse() {
  'use strict';

  const Gait = window.CatGait;
  const I18n = window.CatMouseI18n;
  const canvas = document.getElementById('world');
  const errorCard = document.getElementById('canvas-error');
  const stateLabel = document.getElementById('behavior-label');
  const pauseButton = document.getElementById('pause-toggle');
  const themeButton = document.getElementById('theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
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

  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const viewport = { width: 0, height: 0, dpr: 1 };
  const prints = [];
  let reducedMotion = reduceQuery.matches;
  let paused = false;
  let lastFrame = performance.now();
  let elapsed = 0;
  let rafId = 0;
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
      eye: '#b5ad58',
      eyeRing: 'rgba(82, 48, 27, 0.72)',
      eyeGlint: 'rgba(255, 245, 214, 0.82)',
      nose: '#a75f57',
      earShade: 'rgba(143, 77, 58, 0.34)',
      pupil: '#241c17',
      mouse: '#736b64',
      mouseLight: '#a39a90',
      mouseEar: '#cf9d96',
      mouseTail: '#9c756f',
      print: 'rgba(116, 75, 43, 0.15)',
      cream: '#f0e4cf',
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
      eye: '#c8bf68',
      eyeRing: 'rgba(61, 34, 22, 0.82)',
      eyeGlint: 'rgba(255, 244, 211, 0.86)',
      nose: '#bd756d',
      earShade: 'rgba(126, 66, 53, 0.42)',
      pupil: '#17130f',
      mouse: '#aaa29a',
      mouseLight: '#d0c7bd',
      mouseEar: '#d9a49e',
      mouseTail: '#bd8f88',
      print: 'rgba(224, 176, 126, 0.11)',
      cream: '#e8dcc4',
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
    ears: { left: 0, right: 0 },
    earPerk: { left: 0.74, right: 0.74 },
    gait: Gait.createController('prowl'),
    strideLength: 0,
    feet: {},
    tail: [],
    wanderGoal: { x: 0, y: 0 },
    nextWanderAt: 0,
    restUntil: null,
    bodySway: 0,
    skinNarrow: 1,
    wiggle: 0,
    poseSpread: 0,
    poseStretch: 0,
    idleYaw: 0,
    leap: { phase: null, t: 0, crouchDur: 0.7, wiggleHz: 3, launchX: 0, launchY: 0, landX: 0, landY: 0, lastLandAt: -10, nearSince: null },
    capture: {
      active: false,
      since: -10,
      restAt: Infinity,
      pointerX: 0,
      pointerY: 0,
      renderX: 0,
      renderY: 0,
    },
    idle: {
      mode: null,
      visualMode: null,
      lastMode: null,
      captured: false,
      poseBlend: 0,
      poseWeights: {},
      poseSide: 1,
      transition: {
        active: false,
        from: {},
        fromChannels: {},
        to: null,
        fromSide: 1,
        toSide: 1,
        t: 0,
        dur: 1,
        progress: 1,
      },
      poseClock: 0,
      side: 1,
      t: 0,
      dur: 0,
      nextAt: 8,
      restSince: null,
      sleepDepth: 0,
      breath: 0,
      twitch: 0,
      twitchActive: false,
      twitchT: 0,
      twitchDur: 0.5,
      twitchSide: 1,
      twitchKind: 'ear',
      twitchNextAt: Infinity,
      twitchCount: 0,
    },
    startle: { active: false, t: 0, dur: 0.35, dirX: 0, dirY: 0 },
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
    headRearReach: 21,
    headSocketCenterX: 2.5,
    headSocketRadiusX: 22.5,
    headSocketRadiusY: 20.5,
    tailSocketForward: -19,
    tailAnchorForward: -28,
    tailRootRadius: 9.5,
    tailTipRadius: 1.5,
  });

  // The ears are landmarks in one continuous skull contour. Their broad roots
  // stay welded to the crown while only the tips swivel, avoiding the detached
  // tabs produced by rotating two separately painted ear shapes.
  const EAR_GEOMETRY = Object.freeze({
    rearBaseForward: 3.0,
    frontBaseForward: 15.5,
    rearBaseOutward: 18.0,
    frontBaseOutward: 14.5,
    rootForward: 8.5,
    rootOutward: 16.5,
    tipForward: 11.5,
    tipOutward: 6.0,
    tipRound: 1.35,
    maxSwivel: 0.09,
  });

  // Pounce distances are measured in the same unscaled design units as the
  // articulated rig. The fore-paw midpoint sits 32 units ahead at the shoulder
  // station plus another 12 at touchdown, so the body must stop 44 units behind
  // the target instead of covering it with the waist.
  const POUNCE_GEOMETRY = Object.freeze({
    triggerMin: 60,
    triggerMax: 175,
    crouchAbort: 245,
    aimLeadSeconds: 0.12,
    forePawForward: 44,
    maxBodyTravel: 150,
    captureRadius: 30,
  });

  const EAR_PERK_BY_STATE = Object.freeze({
    prowl: 0.74,
    observe: 1,
    watch: 0.92,
    stalk: 0.96,
    chase: 0.86,
    crouch: 1,
    pounce: 0.9,
    land: 0.82,
    pin: 0.78,
    sit: 0.8,
    loaf: 0.86,
    sideLie: 0.72,
    roll: 0.68,
    curl: 0.74,
    groom: 0.7,
    stretch: 0.72,
  });

  // 尾语表（设计评审）：每状态 {力度, 频率, 只动尾尖, 卷向体侧}。蓄势=尾尖高频打点、扑击=舵、蹲坐=环卷。
  const TAIL_BY_STATE = Object.freeze({
    watch: { strength: 92, rate: 2.25, tip: false, wrap: 0 },
    observe: { strength: 92, rate: 2.25, tip: false, wrap: 0 },
    chase: { strength: 18, rate: 0.75, tip: false, wrap: 0 },
    crouch: { strength: 120, rate: 3.4, tip: true, wrap: 0 },
    pounce: { strength: 8, rate: 0.4, tip: false, wrap: 0 },
    land: { strength: 30, rate: 1.0, tip: false, wrap: 0 },
    pin: { strength: 14, rate: 0.6, tip: false, wrap: 0 },
    sit: { strength: 46, rate: 0.7, tip: false, wrap: 1 },
    loaf: { strength: 14, rate: 0.42, tip: false, wrap: 0.55 },   // 面包卧尾巴贴身环卷
    sideLie: { strength: 18, rate: 0.48, tip: false, wrap: 0.2 },
    roll: { strength: 24, rate: 0.7, tip: false, wrap: 0 },
    curl: { strength: 10, rate: 0.34, tip: false, wrap: 0.85 },   // 环卷姿尾巴抱住身体（月牙合拢）
    groom: { strength: 40, rate: 0.9, tip: false, wrap: 0.4 },
    stretch: { strength: 20, rate: 0.5, tip: false, wrap: 0 },
    stalk: { strength: 42, rate: 1.15, tip: false, wrap: 0 },
    prowl: { strength: 42, rate: 1.15, tip: false, wrap: 0 },
  });
  const REST_POSES = Object.freeze(['sit', 'loaf', 'sideLie', 'roll', 'curl']);
  const IDLE_MODES = Object.freeze(['look', ...REST_POSES, 'groom', 'stretch']);
  const POSE_STATES = Object.freeze(['crouch', 'pounce', 'land', 'pin', ...REST_POSES, 'groom', 'stretch']);
  const POSE_BLEND_MODES = Object.freeze([...REST_POSES, 'groom', 'stretch']);
  const POSE_CHANNEL_TIMING = Object.freeze({
    body: Object.freeze([0, 0.78]),
    spine: Object.freeze([0.04, 0.9]),
    paws: Object.freeze([0.16, 1]),
    tail: Object.freeze([0.24, 1]),
    details: Object.freeze([0.08, 0.92]),
  });
  const IDLE_DURATION_RANGES = Object.freeze({
    look: Object.freeze([2.2, 3.4]),
    sit: Object.freeze([6, 10]),
    loaf: Object.freeze([9, 15]),
    sideLie: Object.freeze([8, 13]),
    roll: Object.freeze([4, 7]),
    curl: Object.freeze([12, 20]),
    groom: Object.freeze([7, 11]),
    stretch: Object.freeze([4, 6]),
  });
  const CAPTURE_REST_WEIGHTS = Object.freeze([
    Object.freeze(['sit', 0.2]),
    Object.freeze(['loaf', 0.25]),
    Object.freeze(['sideLie', 0.18]),
    Object.freeze(['roll', 0.12]),
    Object.freeze(['curl', 0.25]),
  ]);
  const CAPTURE_RELEASE_DISTANCE = 18;

  function ensurePoseWeights() {
    POSE_BLEND_MODES.forEach((mode) => {
      if (!Number.isFinite(cat.idle.poseWeights[mode])) cat.idle.poseWeights[mode] = 0;
    });
  }

  function rawPoseWeight(mode) {
    ensurePoseWeights();
    return cat.idle.poseWeights[mode] || 0;
  }

  function poseWeightsSnapshot() {
    ensurePoseWeights();
    return Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, rawPoseWeight(mode)]));
  }

  function dominantPoseMode(weights) {
    let bestMode = null;
    let bestWeight = 0;
    POSE_BLEND_MODES.forEach((mode) => {
      const weight = weights ? weights[mode] || 0 : rawPoseWeight(mode);
      if (weight > bestWeight) {
        bestMode = mode;
        bestWeight = weight;
      }
    });
    return bestMode;
  }

  function poseTransitionDuration(toMode, fromWeights) {
    if (reducedMotion) return 0.46;
    const fromMode = dominantPoseMode(fromWeights);
    const entering = !fromMode;
    const leaving = !toMode;
    const baseByMode = {
      sit: 1.2,
      loaf: 1.4,
      sideLie: 1.55,
      roll: 1.05,
      curl: 1.65,
      groom: 0.92,
      stretch: 1.0,
    };
    const base = leaving ? 1.05 : (baseByMode[toMode] || 1.1) + (entering ? 0 : 0.18);
    return base * (0.92 + poseHash(18) * 0.16);
  }

  function beginPoseTransition(toMode, duration) {
    const I = cat.idle;
    const fromChannels = Object.fromEntries(Object.keys(POSE_CHANNEL_TIMING).map((channel) => [
      channel,
      Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, poseChannelWeight(mode, channel)])),
    ]));
    const from = fromChannels.body;
    const total = Object.values(from).reduce((sum, weight) => sum + weight, 0);
    if ((!toMode && total < 0.001)
      || (toMode && from[toMode] > 0.999 && total > 0.999 && Math.abs(I.poseSide - I.side) < 0.001)) {
      I.transition.active = false;
      I.transition.from = {};
      I.transition.fromChannels = {};
      I.transition.to = toMode || null;
      I.poseSide = I.side;
      I.transition.t = 0;
      I.transition.dur = 0;
      I.transition.progress = 1;
      POSE_BLEND_MODES.forEach((mode) => { I.poseWeights[mode] = mode === toMode ? 1 : 0; });
      I.visualMode = toMode || null;
      I.poseBlend = toMode ? 1 : 0;
      return;
    }
    I.transition.active = true;
    I.transition.from = from;
    I.transition.fromChannels = fromChannels;
    I.transition.to = toMode || null;
    I.transition.fromSide = I.poseSide;
    I.transition.toSide = I.side;
    I.transition.t = 0;
    I.transition.dur = Math.max(0.2, duration || poseTransitionDuration(toMode, from));
    I.transition.progress = 0;
    I.visualMode = toMode || dominantPoseMode(from);
  }

  function poseChannelWeight(mode, channel) {
    const I = cat.idle;
    if (!I.transition.active) return rawPoseWeight(mode);
    const timing = POSE_CHANNEL_TIMING[channel] || POSE_CHANNEL_TIMING.body;
    const progress = Gait.clamp((I.transition.progress - timing[0]) / Math.max(0.001, timing[1] - timing[0]), 0, 1);
    const amount = Gait.smootherstep(progress);
    const from = I.transition.fromChannels[channel]?.[mode] ?? I.transition.from[mode] ?? 0;
    const to = I.transition.to === mode ? 1 : 0;
    return from + (to - from) * amount;
  }

  function updatePoseTransition(dt) {
    const I = cat.idle;
    ensurePoseWeights();
    if (I.transition.active) {
      I.transition.t = Math.min(I.transition.dur, I.transition.t + dt);
      I.transition.progress = Gait.clamp(I.transition.t / Math.max(0.001, I.transition.dur), 0, 1);
      const bodyTiming = POSE_CHANNEL_TIMING.body;
      const bodyProgress = Gait.clamp(
        (I.transition.progress - bodyTiming[0]) / (bodyTiming[1] - bodyTiming[0]),
        0,
        1,
      );
      const amount = Gait.smootherstep(bodyProgress);
      POSE_BLEND_MODES.forEach((mode) => {
        const from = I.transition.fromChannels.body?.[mode] ?? I.transition.from[mode] ?? 0;
        const to = I.transition.to === mode ? 1 : 0;
        I.poseWeights[mode] = from + (to - from) * amount;
      });
      I.poseSide = I.transition.fromSide
        + (I.transition.toSide - I.transition.fromSide) * Gait.smootherstep(I.transition.progress);
      if (I.transition.progress >= 1) {
        const target = I.transition.to;
        I.transition.active = false;
        I.transition.from = {};
        I.transition.fromChannels = {};
        POSE_BLEND_MODES.forEach((mode) => { I.poseWeights[mode] = mode === target ? 1 : 0; });
        I.poseSide = I.transition.toSide;
        I.visualMode = target || null;
      }
    }
    I.poseBlend = Gait.clamp(
      POSE_BLEND_MODES.reduce((sum, mode) => sum + poseChannelWeight(mode, 'body'), 0),
      0,
      1,
    );
  }

  function restPoseWeight(mode) {
    return poseChannelWeight(mode, 'body');
  }

  function restPoseSide() {
    return Gait.clamp(cat.idle.poseSide, -1, 1);
  }

  function restRollWave() {
    return Math.sin(cat.idle.poseClock * 2.7) * restPoseWeight('roll');
  }

  function poseTransitionSway() {
    const T = cat.idle.transition;
    if (!T.active || !T.to || T.progress >= 0.52) return 0;
    const prep = Math.sin(Math.PI * Gait.clamp(T.progress / 0.52, 0, 1));
    const side = restPoseSide();
    if (T.to === 'sideLie' || T.to === 'roll' || T.to === 'curl') return side * 2.4 * prep;
    if (T.to === 'groom') return -side * 2.1 * prep;
    if (T.to === 'sit' || T.to === 'loaf') return side * 0.7 * prep;
    return side * 0.35 * prep;
  }

  // 后躯皮毛的姿态侧移（设计单位）：bodyStations 的臀部站位与尾根锚点必须同源使用，
  // 否则 curl/sideLie 加深时尾根会脱出骨盆皮毛包络（门禁 tailRootClearance 抓的就是这个）。
  function restRearLateral() {
    return restPoseSide() * (restPoseWeight('sideLie') * 4.8 + restPoseWeight('curl') * 3.6)
      + restRollWave() * 2.8;
  }

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

  function quadraticPoint(p0, p1, p2, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
      y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
    };
  }

  function earFlickPulse(time, phase) {
    const envelope = Math.pow(Math.max(0, Math.sin(time * 0.73 + phase)), 9);
    return Math.sin(time * 8.1 + phase * 2.7) * envelope;
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
    const weightTransfer = poseTransitionSway();
    const rearSway = (
      cat.support.hindBias * 2.35 + cat.bodySway * 0.42 + cat.wiggle + weightTransfer
    ) * a.scale;
    const frontSway = (
      cat.support.foreBias * 1.55 - cat.bodySway * 0.28 - weightTransfer * 0.55
    ) * a.scale;
    // 姿态形变（owner"动作要完整"）：坐/面包卧从头顶看是"收拢"——骨节前后距明显缩短
    // （sit 梨形：后躯着地、肩拉近臀；loaf 收成面包体）；stretch 相反，前躯/颈/头拉长前探。
    const sitW = restPoseWeight('sit');
    const loafW = restPoseWeight('loaf');
    const curlW = restPoseWeight('curl');
    const compress = 1 - (sitW * 0.3 + loafW * 0.34 + curlW * 0.1);
    const frontLen = 1 + cat.poseStretch * 0.2;
    const neckLen = (1 - sitW * 0.2 - loafW * 0.3) * (1 + cat.poseStretch * 0.5);
    const headLen = (1 - loafW * 0.16) * (1 + cat.poseStretch * 0.35);

    rig.waist.x = cat.x;
    rig.waist.y = cat.y;

    const pelvisAxis = mixAngle(rig.waist.angle, rig.pelvis.angle, 0.58);
    const pelvisOffset = rotatePoint(-31 * compress * a.scale, rearSway, pelvisAxis);
    rig.pelvis.x = rig.waist.x + pelvisOffset.x;
    rig.pelvis.y = rig.waist.y + pelvisOffset.y;

    const shoulderAxis = mixAngle(rig.waist.angle, rig.shoulders.angle, 0.56);
    const shoulderOffset = rotatePoint(32 * compress * frontLen * a.scale, frontSway, shoulderAxis);
    rig.shoulders.x = rig.waist.x + shoulderOffset.x;
    rig.shoulders.y = rig.waist.y + shoulderOffset.y;

    const neckAxis = mixAngle(rig.shoulders.angle, rig.neck.angle, 0.55);
    const neckOffset = rotatePoint(18 * neckLen * a.scale, 0, neckAxis);
    rig.neck.x = rig.shoulders.x + neckOffset.x;
    rig.neck.y = rig.shoulders.y + neckOffset.y;

    const headAxis = mixAngle(rig.neck.angle, rig.head.angle, 0.52);
    const headOffset = rotatePoint(15 * headLen * a.scale, 0, headAxis);
    rig.head.x = rig.neck.x + headOffset.x;
    rig.head.y = rig.neck.y + headOffset.y;

    rig.pelvis.visualRadius = 31 * a.scale;
    rig.waist.visualRadius = 23 * a.scale;
    rig.shoulders.visualRadius = 30 * a.scale;
    rig.neck.visualRadius = 17 * a.scale;
    // Includes the ear tips, not just the painted skull.
    rig.head.visualRadius = 46 * a.scale;
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
    const restSide = restPoseSide();
    const lie = poseChannelWeight('sideLie', 'spine');
    const curl = poseChannelWeight('curl', 'spine');
    const groomW = poseChannelWeight('groom', 'spine');
    const rollWave = restRollWave();
    const dreamNod = dreamTwitchAmount('ear') * 0.024;

    // Gaze leads only the head and neck. The torso follows filtered locomotion
    // turn velocity: shoulders anticipate a corner slightly while the pelvis
    // counter-lags, with tiny gait-phase counter-rotation between the girdles.
    const headTarget = cat.heading + cat.headYaw
      + restSide * (lie * 0.06 + curl * 0.55 + groomW * 0.2)
      + rollWave * 0.05 + dreamNod * restSide;
    rig.head.angle = angleExpLerp(rig.head.angle, headTarget, prey.active ? 15 : 6.8, dt);

    const headOffset = Gait.clamp(Gait.angleDelta(cat.heading, rig.head.angle), -0.7, 0.7);
    const neckTarget = cat.heading + headOffset * 0.58 + shoulderLead * 0.35
      + restSide * (lie * 0.1 + curl * 0.5 + groomW * 0.16)
      + rollWave * 0.04 - dreamNod * restSide * 0.28;
    rig.neck.angle = angleExpLerp(rig.neck.angle, neckTarget, prey.active ? 10.5 : 5.4, dt);

    const shoulderTarget = cat.heading + shoulderLead + forePhaseTwist - cat.bodySway * 0.012
      + restSide * (lie * 0.08 + curl * 0.34 + groomW * 0.1) + rollWave * 0.035;
    rig.shoulders.angle = angleExpLerp(rig.shoulders.angle, shoulderTarget, 7.4, dt);

    const waistTarget = cat.heading - pelvisLag * 0.28 + cat.bodySway * 0.01
      - restSide * (lie * 0.03 + curl * 0.18) - rollWave * 0.018;
    rig.waist.angle = angleExpLerp(rig.waist.angle, waistTarget, 5.2, dt);

    const pelvisTarget = cat.heading - pelvisLag + hindPhaseTwist + cat.bodySway * 0.014
      - restSide * (lie * 0.08 + curl * 0.42) - rollWave * 0.035;
    rig.pelvis.angle = angleExpLerp(rig.pelvis.angle, pelvisTarget, 3.15, dt);

    // Hard anatomical stops are applied every frame, after the soft filters.
    // They preserve visible articulation without permitting a broken neck or
    // an eel-like accumulation of small turns down the whole spine.
    // 行走限位防"鳗鱼化"；环卷/侧卧/理毛的蜷曲是真实猫姿 → 随姿态权重解锁弯度
    //（curl 全量时脊柱总弯 ~2.4rad，头贴近尾根的"羊角面包"）。
    const bendFree = curl * 0.85 + lie * 0.3 + groomW * 0.3;
    rig.waist.angle = constrainAngle(rig.pelvis.angle, rig.waist.angle, 0.12 + bendFree * 0.5);
    rig.shoulders.angle = constrainAngle(rig.waist.angle, rig.shoulders.angle, 0.18 + bendFree * 0.5);
    rig.neck.angle = constrainAngle(rig.shoulders.angle, rig.neck.angle, 0.30 + bendFree * 0.45);
    rig.head.angle = constrainAngle(rig.neck.angle, rig.head.angle, 0.42 + bendFree * 0.4);
    rig.head.angle = constrainAngle(rig.pelvis.angle, rig.head.angle, 0.84 + bendFree * 1.6);
    rig.head.angle = constrainAngle(rig.neck.angle, rig.head.angle, 0.42 + bendFree * 0.4);
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
    // 转弯收窄足迹线：真猫转向时爪子收拢在身体投影线内、绝不向外撇开（外撇是"机器人转弯"的头号破绽）。
    const turnNarrow = 1 - Gait.clamp(Math.abs(cat.rig.turnVelocity) * 0.16, 0, 0.3);
    const track = (cat.state === 'stalk'
      ? (config.fore ? 7 : 6.3)
      : cat.state === 'chase'
        ? (config.fore ? 12 : 11)
        : (config.fore ? 9 : 8)) * turnNarrow;
    const localX = anchor.x + (config.fore ? 13.5 : -9.5) * a.scale + sample.longitudinal;
    // Swinging paws arc inward toward the centerline. The root remains at the
    // shoulder/hip, but the visible paw track stays narrow beneath the body.
    const localY = config.side * track * a.scale - config.side * sample.lateral;
    const forward = Math.max(0, futureSeconds || 0) * cat.speed;
    // 曲线预测：落点沿"未来朝向"投出（按当前转向角速度外推），不再沿直线外推——
    // 转弯中的直线外推正是内侧腿交叉/外侧腿甩开的根源。futureSeconds=0（静置安放）时零影响。
    const futureTurn = Gait.clamp(cat.steerOmega * Math.max(0, futureSeconds || 0) * 0.75, -0.5, 0.5);
    const offset = rotatePoint(localX + forward, localY, parent.angle + futureTurn);
    return { x: parent.x + offset.x, y: parent.y + offset.y };
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
      const scaleX = viewport.width / Math.max(1, oldWidth);
      const scaleY = viewport.height / Math.max(1, oldHeight);
      cat.x *= scaleX;
      cat.y *= scaleY;
      prey.x = Gait.clamp(prey.x * scaleX, 0, viewport.width);
      prey.y = Gait.clamp(prey.y * scaleY, 0, viewport.height);
      cat.wanderGoal.x *= scaleX;
      cat.wanderGoal.y *= scaleY;
      if (cat.capture.active) {
        cat.capture.pointerX *= scaleX;
        cat.capture.pointerY *= scaleY;
        cat.capture.renderX *= scaleX;
        cat.capture.renderY *= scaleY;
      }
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
    if (cat.capture.active) {
      const escapeDistance = Math.hypot(
        nextX - cat.capture.pointerX,
        nextY - cat.capture.pointerY,
      );
      if (escapeDistance > CAPTURE_RELEASE_DISTANCE * anatomy().scale) cancelCapture();
    }
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
    if (!wasActive) {
      prey.appearedAt = elapsed;
      const startleDx = cat.x - nextX;
      const startleDy = cat.y - nextY;
      const startleDist = Math.hypot(startleDx, startleDy);
      if (!reducedMotion && startleDist > 0.001 && startleDist < 90 * anatomy().scale) {
        cat.startle.active = true;   // 贴脸乍现 → 后跳半步 + 双耳后贴（observe 的叠加层）
        cat.startle.t = 0;
        cat.startle.dirX = startleDx / startleDist;
        cat.startle.dirY = startleDy / startleDist;
      }
    }
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
    cancelCapture();
    if (paused) draw();
  }

  function stateKey(state) {
    return `state${state.charAt(0).toUpperCase()}${state.slice(1)}`;
  }

  function setBehavior(next, quietLabel) {
    if (cat.state === next) return;
    cat.state = next;
    cat.stateSince = elapsed;
    document.body.dataset.behavior = next;
    if (!quietLabel) refreshDynamicUi();   // 扑击链 crouch→pounce→land→pin 只播报入链与出链（防 aria-live 连读）
  }

  // 视口内运动边界（含转头/耳尖的整头半径），原 updateCat 内联式抽出供扑击落点与受惊后跳共用。
  function locomotionMargin(a) {
    return Math.max(12, Math.min(
      116 * a.scale,
      viewport.width * 0.5 - 12,
      viewport.height * 0.5 - 12,
    ));
  }

  // 确定性杂凑（沿用本文件 sine-hash 风格，不引入 Math.random）：扑击时长/闲态选择的每次微变来源。
  function poseHash(salt) {
    const v = Math.sin((elapsed + salt) * 12.9898 + cat.x * 0.0173 + cat.y * 0.0131) * 43758.5453;
    return v - Math.floor(v);
  }

  // ---------- 扑击链（app 侧自持状态机：蓄势→扑击→扑落→按住；gait.js 与 chooseBehavior 零改动） ----------
  function beginCrouch() {
    cat.leap.phase = 'crouch';
    cat.leap.t = 0;
    cat.leap.crouchDur = 0.55 + poseHash(1) * 0.35;      // 0.55–0.9s ≈ 摆臀 1.5–3 个周期（真猫蓄势节律）
    cat.leap.wiggleHz = 2.7 + poseHash(2) * 0.8;
    cat.leap.nearSince = null;
    setBehavior('crouch');
  }

  function beginPounce() {
    const a = anatomy();
    const aimX = prey.x + prey.vx * POUNCE_GEOMETRY.aimLeadSeconds;
    const aimY = prey.y + prey.vy * POUNCE_GEOMETRY.aimLeadSeconds;
    const dx = aimX - cat.x;
    const dy = aimY - cat.y;
    const dist = Math.max(0.001, Math.hypot(dx, dy));
    const heading = Math.hypot(dx, dy) > 0.001 ? Math.atan2(dy, dx) : cat.heading;
    const bodyTravel = Gait.clamp(
      dist - POUNCE_GEOMETRY.forePawForward * a.scale,
      0,
      POUNCE_GEOMETRY.maxBodyTravel * a.scale,
    );
    const margin = locomotionMargin(a);
    cat.leap.launchX = cat.x;
    cat.leap.launchY = cat.y;
    cat.leap.landX = Gait.clamp(cat.x + Math.cos(heading) * bodyTravel, margin, viewport.width - margin);
    cat.leap.landY = Gait.clamp(cat.y + Math.sin(heading) * bodyTravel, margin, viewport.height - margin);
    cat.heading = heading;
    cat.steerOmega = 0;
    cat.wiggle = 0;
    cat.leap.phase = 'pounce';
    cat.leap.t = 0;
    setBehavior('pounce', true);
  }

  function plantLandingFeet(a) {
    Gait.LIMBS.forEach((limb) => {
      const config = LEG_CONFIG[limb];
      const foot = cat.feet[limb];
      if (!foot) return;
      const parent = config.fore ? cat.rig.shoulders : cat.rig.pelvis;
      const point = pointFromNode(parent, (config.fore ? 12 : -2) * a.scale, config.side * (config.fore ? 14 : 11) * a.scale);
      const bounded = pointWithinLegReach(limb, point.x, point.y, a);
      foot.x = bounded.x;
      foot.y = bounded.y;
      foot.planted = true;
      foot.wasPlanted = true;
      foot.lift = 0;
      foot.phase = 0;
      foot.swingProgress = 0;
      foot.recoveryActive = false;
      foot.settleActive = false;
      foot.angle = cat.heading;
      cat.gait.legPhases[limb] = 0;
      cat.gait.dutyFactors[limb] = cat.gait.dutyFactor;
      recordTouchdown(limb, foot, a, true);
    });
  }

  function landingForePawMidpoint(a) {
    const right = cat.feet.rightFore;
    const left = cat.feet.leftFore;
    if (right && left) {
      return { x: (right.x + left.x) * 0.5, y: (right.y + left.y) * 0.5 };
    }
    return pointFromNode(cat.rig.shoulders, 12 * a.scale, 0);
  }

  function beginCapture() {
    const C = cat.capture;
    C.active = true;
    C.since = elapsed;
    C.restAt = elapsed + 3.5 + poseHash(13) * 3;
    C.pointerX = prey.x;
    C.pointerY = prey.y;
    C.renderX = prey.x;
    C.renderY = prey.y;
    prey.vx = 0;
    prey.vy = 0;
    prey.speed = 0;
  }

  function resumeCapturePin() {
    if (!cat.capture.active) return;
    cat.capture.restAt = elapsed + 3.5 + poseHash(14) * 3;
    cat.leap.phase = 'pin';
    cat.leap.t = 0;
    setBehavior('pin');
  }

  function beginCapturedRest() {
    if (!cat.capture.active) return;
    const choices = reducedMotion
      ? CAPTURE_REST_WEIGHTS.filter(([mode]) => mode !== 'roll')
      : CAPTURE_REST_WEIGHTS;
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    const roll = poseHash(15) * total;
    let acc = 0;
    let pick = choices[choices.length - 1][0];
    for (const [mode, weight] of choices) {
      acc += weight;
      if (roll <= acc) { pick = mode; break; }
    }
    if (pick === cat.idle.lastMode) {
      const index = choices.findIndex(([mode]) => mode === pick);
      pick = choices[(index + 1) % choices.length][0];
    }
    cat.idle.side = poseHash(16) < 0.5 ? -1 : 1;
    cat.capture.restAt = Infinity;
    cat.leap.phase = null;
    cat.leap.lastLandAt = elapsed;
    cat.leap.nearSince = null;
    beginIdle(pick, true);
  }

  function cancelCapture() {
    const C = cat.capture;
    if (!C.active) return;
    C.active = false;
    C.restAt = Infinity;
    if (cat.idle.captured) {
      cat.idle.captured = false;
      if (cat.idle.mode) endIdle(true);
    }
    if (cat.leap.phase === 'pin') finishLeap();
    else if (!cat.leap.phase) setBehavior(prey.active ? 'observe' : 'prowl');
  }

  function finishLeap() {
    cat.leap.phase = null;
    cat.leap.lastLandAt = elapsed;
    cat.leap.nearSince = null;
    cat.wiggle = 0;
    setBehavior(prey.active ? 'observe' : 'prowl');
  }

  function updateLeap(dt) {
    const a = anatomy();
    const L = cat.leap;
    const dist = Math.hypot(prey.x - cat.x, prey.y - cat.y);
    if (!L.phase) {
      if (reducedMotion || !prey.active) { L.nearSince = null; return; }
      // 追逐收口：贴身即扑（按住收尾）——比原先"减速滑停在旁边"更像猫
      if (cat.state === 'chase' && elapsed - cat.stateSince >= 0.3 && dist < 34 * a.scale) {
        beginPounce();
        return;
      }
      const inWindow = (cat.state === 'stalk' || cat.state === 'watch')
        && prey.speed < 60 * a.scale
        && dist >= POUNCE_GEOMETRY.triggerMin * a.scale
        && dist <= POUNCE_GEOMETRY.triggerMax * a.scale
        && elapsed - L.lastLandAt > 1.5;
      if (inWindow) {
        if (L.nearSince == null) L.nearSince = elapsed;
        if (elapsed - L.nearSince >= 0.4) beginCrouch();
      } else {
        L.nearSince = null;
      }
      return;
    }
    L.t += dt;
    if (L.phase === 'crouch') {
      if (!prey.active || dist > POUNCE_GEOMETRY.crouchAbort * a.scale) {   // 目标消失/远离 → 顺势放弃
        L.phase = null; cat.wiggle = 0; L.nearSince = null;
        setBehavior(prey.active ? 'stalk' : 'prowl');
        return;
      }
      const half = L.crouchDur * 0.5;
      cat.wiggle = L.t > half
        ? Math.sin(elapsed * L.wiggleHz * Gait.TAU) * 2.8 * Gait.clamp((L.t - half) / 0.15, 0, 1)
        : 0;
      if (L.t >= L.crouchDur) beginPounce();
    } else if (L.phase === 'pounce') {
      if (L.t >= 0.3) {
        L.phase = 'land';
        L.t = 0;
        setBehavior('land', true);
        plantLandingFeet(a);
      }
    } else if (L.phase === 'land') {
      if (L.t >= 0.22) {
        const capture = landingForePawMidpoint(a);
        const captureDistance = Math.hypot(prey.x - capture.x, prey.y - capture.y);
        if (prey.active && captureDistance < POUNCE_GEOMETRY.captureRadius * a.scale) {
          beginCapture();
          L.phase = 'pin';
          L.t = 0;
          setBehavior('pin', true);
        } else {
          finishLeap();
        }
      }
    } else if (L.phase === 'pin') {
      if (!cat.capture.active) finishLeap();
      else if (!prey.active) cancelCapture();
      else if (elapsed >= cat.capture.restAt) beginCapturedRest();
    }
  }

  // ---------- 闲态编排（走-停-看-坐-卧-滚-蜷的标点节奏；巡游不再是匀速漂移） ----------
  // 姿态链（真猫的休息是"组曲"：坐下→理毛→再坐一会 / 面包卧→蜷成环）：结束时 35% 概率
  // 顺势接一个相邻姿态而不是起身走人——节奏因此"多变而连贯"。被打断（prey/扑击）时走 interrupt 分支不接续。
  const POSE_CHAIN = Object.freeze({
    sit: ['groom', 'loaf'], groom: ['sit'], loaf: ['curl', 'sideLie'], sideLie: ['roll', 'curl'],
    roll: ['sideLie'], curl: ['sideLie'], stretch: ['sit'],
  });

  function idleDuration(mode) {
    const range = IDLE_DURATION_RANGES[mode] || IDLE_DURATION_RANGES.look;
    return range[0] + (range[1] - range[0]) * poseHash(8);
  }

  function sleepingPoseWeight() {
    return Gait.clamp(
      poseChannelWeight('loaf', 'body') * 0.82
        + poseChannelWeight('sideLie', 'body')
        + poseChannelWeight('curl', 'body')
        + poseChannelWeight('sit', 'body') * 0.12,
      0,
      1,
    );
  }

  function scheduleDreamTwitch() {
    const I = cat.idle;
    const salt = 31 + I.twitchCount * 7;
    I.twitchNextAt = I.poseClock + 5.4 + poseHash(salt) * 7.8;
  }

  function dreamTwitchAmount(kind, side) {
    const I = cat.idle;
    if (!I.twitchActive || I.twitchKind !== kind) return 0;
    if (Number.isFinite(side) && Math.sign(side) !== I.twitchSide) return 0;
    return I.twitch * I.sleepDepth;
  }

  function updateSleepMotion(dt) {
    const I = cat.idle;
    const sleepyWeight = sleepingPoseWeight();
    const sleepyMode = ['loaf', 'sideLie', 'curl'].includes(I.mode);
    const settledEnough = !I.transition.active || I.transition.progress > 0.58;
    const alreadyAsleep = I.sleepDepth > 0.24 && sleepyWeight > 0.42;
    const sleepTarget = sleepyMode && settledEnough && (I.t > 2.15 || alreadyAsleep)
      ? sleepyWeight
      : 0;
    I.sleepDepth = expLerp(I.sleepDepth, sleepTarget, sleepTarget > I.sleepDepth ? 0.72 : 2.8, dt);

    // Cats inhale a little faster than they exhale. The slow asymmetric wave
    // is deliberately separate from action clocks, so chaining two rest poses
    // never resets the chest in the middle of a breath.
    const phase = (I.poseClock * 0.31) % 1;
    const lung = phase < 0.4
      ? Gait.smootherstep(phase / 0.4)
      : 1 - Gait.smootherstep((phase - 0.4) / 0.6);
    const restingBreath = sleepyWeight * 0.1;
    const breathDepth = restingBreath + I.sleepDepth * (1 - restingBreath);
    I.breath = (lung * 2 - 1) * breathDepth * (reducedMotion ? 0.45 : 1);

    if (reducedMotion || I.sleepDepth < 0.58) {
      I.twitch = 0;
      I.twitchActive = false;
      I.twitchT = 0;
      I.twitchNextAt = Infinity;
      return;
    }
    if (!Number.isFinite(I.twitchNextAt)) scheduleDreamTwitch();
    if (!I.twitchActive && I.poseClock >= I.twitchNextAt) {
      const salt = 47 + I.twitchCount * 11;
      const kindPick = poseHash(salt + 2);
      I.twitchKind = kindPick < 0.52 ? 'ear' : kindPick < 0.82 ? 'paw' : 'tail';
      I.twitchSide = poseHash(salt + 3) < 0.5 ? -1 : 1;
      I.twitchDur = 0.34 + poseHash(salt + 4) * 0.32;
      I.twitchT = 0;
      I.twitchActive = true;
      I.twitchCount += 1;
    }
    if (!I.twitchActive) {
      I.twitch = 0;
      return;
    }
    I.twitchT = Math.min(I.twitchDur, I.twitchT + dt);
    const u = Gait.clamp(I.twitchT / Math.max(0.001, I.twitchDur), 0, 1);
    const envelope = Math.sin(Math.PI * u) ** 2;
    I.twitch = Math.sin(u * Math.PI * 3.25) * envelope;
    if (u >= 1) {
      I.twitch = 0;
      I.twitchActive = false;
      scheduleDreamTwitch();
    }
  }

  function endIdle(interrupted) {
    const I = cat.idle;
    const finished = I.mode;
    const wasCaptured = I.captured && cat.capture.active;
    if (I.mode) I.lastMode = I.mode;
    I.mode = null;
    I.captured = false;
    I.restSince = null;
    const chainOptions = finished && POSE_CHAIN[finished]
      ? POSE_CHAIN[finished].filter((mode) => !wasCaptured || REST_POSES.includes(mode))
      : [];
    if (!interrupted && finished !== 'look' && !reducedMotion
      && chainOptions.length && poseHash(11) < 0.35) {
      const options = chainOptions;
      beginIdle(options[(poseHash(12) * options.length) | 0], wasCaptured);
      return;
    }
    if (finished && finished !== 'look') beginPoseTransition(null);
    if (!interrupted && wasCaptured) {
      resumeCapturePin();
      return;
    }
    if (finished && finished !== 'look') setBehavior('prowl');
    I.nextAt = elapsed + 4 + poseHash(9) * 3;
  }

  function beginIdle(forcedPick, captured) {
    if (forcedPick) {
      const I = cat.idle;
      I.mode = forcedPick;
      I.captured = Boolean(captured);
      I.t = 0;
      I.dur = idleDuration(forcedPick);
      beginPoseTransition(forcedPick);
      setBehavior(forcedPick);
      return;
    }
    beginIdleFresh();
  }

  function beginIdleFresh() {
    const I = cat.idle;
    const h = poseHash(7);
    const pool = reducedMotion
      ? [['look', 0.28], ['sit', 0.2], ['loaf', 0.25], ['sideLie', 0.12], ['curl', 0.15]]
      : [
        ['look', 0.16], ['sit', 0.13], ['loaf', 0.17], ['sideLie', 0.14],
        ['roll', 0.11], ['curl', 0.15], ['groom', 0.08], ['stretch', 0.06],
      ];
    let acc = 0;
    let pick = 'look';
    for (const [mode, w] of pool) { acc += w; if (h <= acc) { pick = mode; break; } }
    if (pick === I.lastMode) {
      const nextIndex = (IDLE_MODES.indexOf(pick) + 1) % IDLE_MODES.length;
      pick = IDLE_MODES[nextIndex];
      if (reducedMotion && (pick === 'roll' || pick === 'groom' || pick === 'stretch')) pick = 'loaf';
    }
    I.mode = pick;
    I.captured = false;
    I.side = poseHash(10) < 0.5 ? -1 : 1;
    I.t = 0;
    I.dur = idleDuration(pick);
    beginPoseTransition(pick === 'look' ? null : pick);
    if (pick !== 'look') setBehavior(pick);
  }

  function updateIdle(dt) {
    const a = anatomy();
    const I = cat.idle;
    I.poseClock += dt;
    updatePoseTransition(dt);
    updateSleepMotion(dt);
    const holdingCapture = I.captured && cat.capture.active;
    if ((prey.active && !holdingCapture) || cat.leap.phase) {
      if (I.mode) endIdle(true);
      I.restSince = null;
      cat.idleYaw = expLerp(cat.idleYaw, 0, 6, dt);
      return;
    }
    if (I.mode) {
      I.t += dt;
      if (I.mode === 'look') cat.idleYaw = Math.sin(I.t * 1.6) * 0.5;             // 环视：头扫视，身体不动
      else if (I.mode === 'groom') cat.idleYaw = I.side * (0.46 + Math.sin(I.t * 4.4 + 0.9) * 0.2);   // 理毛：头俯向理毛侧、随洗爪同频点动（滞后 0.9rad=舔在爪抬起后）
      else if (I.mode === 'sideLie') cat.idleYaw = I.side * (0.42 + Math.sin(I.t * 1.2) * 0.04);
      else if (I.mode === 'roll') cat.idleYaw = Math.sin(I.t * 2.7) * 0.3;
      else if (I.mode === 'curl') cat.idleYaw = I.side * 0.68;
      else if (I.mode === 'loaf') cat.idleYaw = Math.sin(I.t * 0.72) * 0.12;
      else cat.idleYaw = expLerp(cat.idleYaw, 0, 6, dt);
      if (I.t >= I.dur) endIdle();
      return;
    }
    cat.idleYaw = expLerp(cat.idleYaw, 0, 6, dt);
    if (cat.speed < 4 * a.scale && elapsed > 3) {
      if (I.restSince == null) I.restSince = elapsed;
      if (elapsed - I.restSince >= 1.0 && elapsed >= I.nextAt) beginIdle();
    } else {
      I.restSince = null;
    }
  }

  // ---------- 受惊后跳（突然贴脸出现的目标；observe 上的叠加层，不新增状态） ----------
  function updateStartle(dt) {
    const S = cat.startle;
    if (!S.active) return;
    S.t += dt;
    if (S.t >= S.dur) { S.active = false; return; }
    const a = anatomy();
    const fade = 1 - S.t / S.dur;
    const margin = locomotionMargin(a);
    cat.x = Gait.clamp(cat.x + S.dirX * 80 * a.scale * dt * fade, margin, viewport.width - margin);
    cat.y = Gait.clamp(cat.y + S.dirY * 80 * a.scale * dt * fade, margin, viewport.height - margin);
  }

  function updateBehavior() {
    if (cat.capture.active) return;                 // 按住/带鼠休息由捕获状态机自持，目标仍 active 不应重新触发追逐
    if (cat.leap.phase) return;                    // 扑击链自持（updateLeap 推进与收尾）
    if (cat.idle.mode && cat.idle.mode !== 'look') {
      if (prey.active) endIdle(true);              // 新目标立即打断闲态
      else return;                                 // sit/groom/stretch 自持
    }
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
    updateStartle(dt);
    updateLeap(dt);
    updateIdle(dt);
    updateBehavior();
    const visibleMouse = renderedMousePosition();
    let goalX = visibleMouse.x;
    let goalY = visibleMouse.y;
    let goalDistance = Math.hypot(goalX - cat.x, goalY - cat.y);

    if (!prey.active) {
      const wanderDistance = Math.hypot(cat.wanderGoal.x - cat.x, cat.wanderGoal.y - cat.y);
      if (wanderDistance < 54) {
        cat.speed = expLerp(cat.speed, 0, 2.8, dt);
        // 到点驻足（猫的移动是"走-停-看-再走"的标点节奏，不是匀速漂移）；驻足窗恰好给闲态编排留出土壤
        if (cat.restUntil == null) cat.restUntil = elapsed + 1.9 + poseHash(4) * 3.2;
        if (elapsed >= cat.restUntil && !cat.idle.mode) {
          cat.restUntil = null;
          chooseWanderGoal(true);
        }
      } else {
        cat.restUntil = null;   // 出了驻足圈（过冲/切向穿过）→ 作废计时，防陈旧 restUntil 吞掉下一次驻足
        if (elapsed >= cat.nextWanderAt) {
          if (poseHash(5) < 0.45) {
            // 半路驻足：目标常在抵达前就被计时器换掉 → 猫"永远在路上"。45% 概率就地停下看看
            // （目标=当前位置 → 驻足/闲态接管），才是"走-停-看-再走"的真节奏。
            cat.wanderGoal.x = cat.x;
            cat.wanderGoal.y = cat.y;
            cat.nextWanderAt = elapsed + 2.4;
          } else {
            chooseWanderGoal(true);
          }
        }
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
    const lookAngle = prey.active ? Math.atan2(visibleMouse.y - cat.y, visibleMouse.x - cat.x) : targetAngle;
    const lookRelative = Gait.angleDelta(cat.heading, lookAngle);
    const targetHeadYaw = Gait.clamp(lookRelative + cat.idleYaw, -0.76, 0.76);
    cat.headYaw = expLerp(cat.headYaw, targetHeadYaw, prey.active ? 10 : 3.6, dt);

    // The pinnae begin forward, then finish the gaze after the skull takes most
    // of the turn. Their narrow swivel stop keeps even a hard side glance from
    // rotating the neutral forward-pointing silhouette back into side fins.
    const residualLook = Gait.clamp(lookRelative - cat.headYaw * 0.72, -0.46, 0.46);
    const earAim = residualLook * 0.54;
    const sleepQuiet = 1 - cat.idle.sleepDepth * 0.88;
    const flickWeight = reducedMotion ? 0 : (prey.active ? 0.45 : 1) * sleepQuiet;
    const leftFlick = earFlickPulse(elapsed, 0.85) * 0.055 * flickWeight
      + dreamTwitchAmount('ear', -1) * 0.082;
    const rightFlick = earFlickPulse(elapsed, 3.65) * 0.055 * flickWeight
      + dreamTwitchAmount('ear', 1) * 0.082;
    const leftEarTarget = Gait.clamp(
      earAim * (earAim < 0 ? 1.08 : 0.8) + leftFlick - 0.02,
      -EAR_GEOMETRY.maxSwivel,
      EAR_GEOMETRY.maxSwivel,
    );
    const rightEarTarget = Gait.clamp(
      earAim * (earAim > 0 ? 1.08 : 0.8) + rightFlick + 0.014,
      -EAR_GEOMETRY.maxSwivel,
      EAR_GEOMETRY.maxSwivel,
    );
    const earRate = prey.active ? 13 : 5.2;
    cat.ears.left = angleExpLerp(cat.ears.left, leftEarTarget, earRate, dt);
    cat.ears.right = angleExpLerp(cat.ears.right, rightEarTarget, earRate, dt);

    const a = anatomy();
    const basePerk = EAR_PERK_BY_STATE[cat.state] || 0.8;
    const leftPerkTarget = Gait.clamp(
      basePerk - cat.idle.sleepDepth * 0.075
        + (earAim < -0.035 ? 0.04 : -0.01) + Math.abs(leftFlick) * 0.45,
      0.66,
      1,
    );
    const rightPerkTarget = Gait.clamp(
      basePerk - cat.idle.sleepDepth * 0.075
        + (earAim > 0.035 ? 0.04 : -0.01) + Math.abs(rightFlick) * 0.45,
      0.66,
      1,
    );
    const perkLeft = cat.startle.active ? 0.66 : leftPerkTarget;    // 受惊：双耳后贴（earPerk 门禁下限恰为 0.66）
    const perkRight = cat.startle.active ? 0.66 : rightPerkTarget;
    cat.earPerk.left = expLerp(cat.earPerk.left, perkLeft, cat.startle.active ? 14 : prey.active ? 9 : 4.2, dt);
    cat.earPerk.right = expLerp(cat.earPerk.right, perkRight, cat.startle.active ? 14 : prey.active ? 9 : 4.2, dt);

    let desiredSpeed = Gait.targetSpeedForBehavior(
      cat.state,
      goalDistance / a.scale,
      prey.speed / a.scale,
      reducedMotion,
    ) * a.scale;
    if (cat.state === 'prowl') desiredSpeed *= Gait.clamp(goalDistance / 82, 0, 1);
    const poseTransitioning = cat.idle.poseBlend > 0.08;
    if (cat.state === 'watch' || cat.state === 'observe' || cat.idle.mode
      || poseTransitioning || POSE_STATES.indexOf(cat.state) >= 0) desiredSpeed = 0;
    if (prey.active && goalDistance < 58 * a.scale
      && !(cat.state === 'chase' && elapsed - cat.stateSince >= 0.3)) {
      // 贴近减速只留给非追逐态——已建立的追逐是"全速压上直到扑住"（否则永远进不了 34 捕获圈，只会绕圈盘旋）
      desiredSpeed *= Gait.clamp((goalDistance - 28 * a.scale) / (30 * a.scale), 0, 1);
    }

    const turnError = Gait.angleDelta(cat.heading, targetAngle);
    const holdingRestPose = Boolean((cat.idle.mode && cat.idle.mode !== 'look') || poseTransitioning);
    const bodyMayTurn = !holdingRestPose && (cat.state !== 'watch' || Math.abs(turnError) > 0.46);
    const steerLimits = {
      prowl: [0.9, 2.5], observe: [0.72, 2.2], watch: [0.58, 1.9], stalk: [1.2, 3.5], chase: [2.4, 7],
      crouch: [1.4, 4], pounce: [0.4, 3], land: [0.7, 3], pin: [0.7, 2.5],
      sit: [0.6, 1.8], loaf: [0.35, 1.2], sideLie: [0.3, 1], roll: [0.35, 1.1], curl: [0.3, 1],
      groom: [0.5, 1.6], stretch: [0.4, 1.4],
    };
    const [omegaMax, alphaMax] = steerLimits[cat.state] || [1.1, 3];
    const desiredOmega = bodyMayTurn ? Gait.clamp(turnError * 2.35, -omegaMax, omegaMax) : 0;
    cat.steerOmega = approach(cat.steerOmega, desiredOmega, alphaMax * dt);
    cat.heading += cat.steerOmega * dt;

    const turnSlowdown = 1 - 0.45 * Gait.smoothstep((Math.abs(turnError) - 0.25) / 0.9);
    desiredSpeed *= turnSlowdown;
    const accelerationLimits = {
      prowl: [44, 66], observe: [36, 70], watch: [36, 70], stalk: [64, 92], chase: [220, 295],
      crouch: [40, 120], pounce: [60, 90], land: [80, 260], pin: [60, 200],
      sit: [36, 90], loaf: [28, 82], sideLie: [24, 76], roll: [30, 88], curl: [24, 72],
      groom: [30, 80], stretch: [30, 70],
    };
    const [accelerate, decelerate] = accelerationLimits[cat.state] || [60, 90];
    const previousSpeed = cat.speed;
    const speedLimit = (desiredSpeed >= cat.speed ? accelerate : decelerate) * a.scale;
    cat.speed = approach(cat.speed, desiredSpeed, speedLimit * dt);
    cat.acceleration = (cat.speed - previousSpeed) / Math.max(0.001, dt);
    cat.x += Math.cos(cat.heading) * cat.speed * dt;
    cat.y += Math.sin(cat.heading) * cat.speed * dt;

    // The former body-only margin allowed a turned head and ears to
    // cross the viewport edge on compact screens. This radius encloses the
    // entire leading anatomy at every heading while remaining viable on very
    // small canvases.
    const margin = locomotionMargin(a);
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

    if (cat.leap.phase === 'pounce') {
      // 扑击是"蓄力-释放"的一次性弹道，不是稳态运动：0.3s 脚本化位移诚实建模腾空，
      // cat.speed 保持衰减 → 加速度/速度门禁全程成立（设计评审裁定）。
      const u = Gait.smootherstep(Gait.clamp(cat.leap.t / 0.3, 0, 1));
      cat.x = Gait.clamp(cat.leap.launchX + (cat.leap.landX - cat.leap.launchX) * u, margin, viewport.width - margin);
      cat.y = Gait.clamp(cat.leap.launchY + (cat.leap.landY - cat.leap.launchY) * u, margin, viewport.height - margin);
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
    cat.skinNarrow = expLerp(cat.skinNarrow, cat.state === 'stalk' ? 0.96 : (cat.state === 'crouch' || cat.state === 'land') ? 0.95 : 1, 6.2, dt);
    const spreadTarget = Gait.clamp(
      restPoseWeight('sit') + restPoseWeight('loaf') * 0.72
        + restPoseWeight('roll') * 0.9 + restPoseWeight('curl') * 0.48,
      0,
      1,
    );
    cat.poseSpread = expLerp(cat.poseSpread, spreadTarget, 4, dt);
    // stretch 三段包络：探出（0.55s smoothstep）→ 保持 → 收回（尾段 0.5s）——单调 0/1 只有"贴出去"没有动作过程
    const stretchWeight = poseChannelWeight('stretch', 'body');
    const stretchEnv = cat.idle.mode === 'stretch'
      ? Gait.smoothstep(cat.idle.t / 0.55) * Gait.smoothstep((cat.idle.dur - cat.idle.t) / 0.5)
      : (stretchWeight > 0.001 ? 1 : 0);
    cat.poseStretch = expLerp(cat.poseStretch, stretchWeight * stretchEnv, 4.5, dt);
    updateSupportPose(dt);

    updateRig(dt);
    updateFeet(dt);
    updateCapturedMouse(dt);
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

    // 落点侧向纪律（owner 反馈：转弯时爪不左右外撇）：把目标投回父节点的未来体框，
    // 侧向坐标钳在本侧 [2, 铰位+7] 设计单位内 —— 无论直线外推残差还是 register 融合，
    // 都不允许把落点推到身体投影线以外或越过中线。
    {
      const parentNode = config.fore ? cat.rig.shoulders : cat.rig.pelvis;
      const futureAngle = parentNode.angle + Gait.clamp(cat.steerOmega * lookahead * 0.75, -0.5, 0.5);
      const rel = rotatePoint(targetX - parentNode.x, targetY - parentNode.y, -futureAngle);
      const anchorLat = Math.abs(localAnchor(limb).y);
      const lat = Gait.clamp(rel.y * config.side, 2 * a.scale, anchorLat + 7 * a.scale);
      const fixed = rotatePoint(rel.x, config.side * lat, futureAngle);
      targetX = parentNode.x + fixed.x;
      targetY = parentNode.y + fixed.y;
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

  function posePawTargetForMode(limb, a, mode) {
    const config = LEG_CONFIG[limb];
    const parent = config.fore ? cat.rig.shoulders : cat.rig.pelvis;
    const side = restPoseSide();
    const sameSide = config.side === side;
    let forward = config.fore ? 10 : -5;
    let lateral = config.side * (config.fore ? 9 : 15);
    let lift = 0;
    let angle = cat.heading;

    if (mode === 'sit') {
      forward = config.fore ? 14 : -5;
      lateral = config.side * (config.fore ? 8 : 27);
    } else if (mode === 'loaf') {
      forward = config.fore ? 1 : 6;
      lateral = config.side * (config.fore ? 7 : 10);
    } else if (mode === 'sideLie') {
      forward = config.fore ? (sameSide ? 7 : 15) : (sameSide ? -8 : 2);
      lateral = side * (sameSide ? 35 : 25);
      lift = sameSide ? 0.05 : 0.11;
      angle = cat.heading + side * 0.14;
    } else if (mode === 'roll') {
      const phase = cat.idle.poseClock * 3.4
        + (config.fore ? 0 : Math.PI) + (config.side > 0 ? 0 : Math.PI * 0.5);
      forward = config.fore ? 4 : -2;
      lateral = config.side * (config.fore ? 25 : 27);
      lift = 0.66 + Math.sin(phase) * 0.16;
      angle = cat.heading + config.side * 0.2;
    } else if (mode === 'curl') {
      forward = config.fore ? 7 : 5;
      lateral = side * (sameSide ? 12 : 5);
      angle = cat.heading + side * 0.22;
    } else if (mode === 'groom') {
      // 洗爪循环（理毛的签名动作）：理毛侧前爪抬向下巴、周期性举-收，头随爪点动（updateIdle 同频）；
      // 其余三爪稳定支撑。
      if (config.fore && sameSide) {
        const cyc = Math.sin(cat.idle.poseClock * 4.4);
        forward = 15 + cyc * 2.5;
        lateral = side * (5.5 + cyc * 1.5);
        lift = 0.3 + Math.max(0, cyc) * 0.32;
        angle = cat.heading + side * 0.3;
      } else {
        forward = config.fore ? 12 : -4;
        lateral = config.side * (config.fore ? 9 : 16);
      }
    } else if (mode === 'stretch') {
      // 前伸展（醒来的招牌）：前爪远探前方、后爪蹬在原位——三段包络（探出-保持-收回）由 poseStretch 驱动。
      if (config.fore) {
        forward = 12 + cat.poseStretch * 17;
        lateral = config.side * 6.5;
      } else {
        forward = -7;
        lateral = config.side * 14;
      }
    }

    const dream = dreamTwitchAmount('paw', config.side);
    if (dream) {
      forward += dream * (config.fore ? 1.7 : 0.9);
      lateral += config.side * Math.abs(dream) * 0.8;
      lift += Math.abs(dream) * (config.fore ? 0.085 : 0.055);
      angle += config.side * dream * 0.035;
    }

    const point = pointFromNode(parent, forward * a.scale, lateral * a.scale);
    const bounded = pointWithinLegReach(limb, point.x, point.y, a);
    return { x: bounded.x, y: bounded.y, lift, angle };
  }

  function restPosePawTarget(limb, a) {
    const weighted = POSE_BLEND_MODES.map((mode) => {
      const weight = poseChannelWeight(mode, 'paws');
      return weight > 0.0001 ? { mode, weight, target: posePawTargetForMode(limb, a, mode) } : null;
    }).filter(Boolean);
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0.001) return null;
    const result = weighted.reduce((target, item) => {
      target.x += item.target.x * item.weight;
      target.y += item.target.y * item.weight;
      target.lift += item.target.lift * item.weight;
      target.angleDelta += Gait.angleDelta(cat.heading, item.target.angle) * item.weight;
      return target;
    }, { x: 0, y: 0, lift: 0, angleDelta: 0 });
    return {
      x: result.x / total,
      y: result.y / total,
      lift: result.lift / total,
      angle: cat.heading + result.angleDelta / total,
      weight: Gait.clamp(total, 0, 1),
    };
  }

  function renderedFoot(limb, a) {
    const foot = cat.feet[limb];
    if (!foot) return null;
    const target = restPosePawTarget(limb, a);
    if (!target) return foot;
    const weight = target.weight;
    return Object.assign({}, foot, {
      x: foot.x + (target.x - foot.x) * weight,
      y: foot.y + (target.y - foot.y) * weight,
      lift: foot.lift + (target.lift - foot.lift) * weight,
      angle: mixAngle(foot.angle, target.angle, weight),
      planted: target.lift * weight < 0.12 && foot.planted,
    });
  }

  function capturedMouseTarget(a) {
    const right = renderedFoot('rightFore', a);
    const left = renderedFoot('leftFore', a);
    if (right && left) return { x: (right.x + left.x) * 0.5, y: (right.y + left.y) * 0.5 };
    return landingForePawMidpoint(a);
  }

  function updateCapturedMouse(dt) {
    if (!cat.capture.active) return;
    const target = capturedMouseTarget(anatomy());
    const rate = cat.idle.captured ? 4.2 : 11;
    cat.capture.renderX = expLerp(cat.capture.renderX, target.x, rate, dt);
    cat.capture.renderY = expLerp(cat.capture.renderY, target.y, rate, dt);
  }

  function renderedMousePosition() {
    return cat.capture.active
      ? { x: cat.capture.renderX, y: cat.capture.renderY }
      : { x: prey.x, y: prey.y };
  }

  function restLimbLayer(limb) {
    const lyingSide = restPoseSide() < 0 ? -1 : 1;
    if (poseChannelWeight('roll', 'paws') > 0.04) return 'over';
    if (poseChannelWeight('sideLie', 'paws') > 0.04 && LEG_CONFIG[limb].side !== lyingSide) return 'over';
    return 'under';
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
    if (cat.leap.phase === 'pounce') {   // 腾空收足：四爪拢向体心（空中相；落地由 plantLandingFeet 一次性布置）
      const u = Gait.clamp(cat.leap.t / 0.3, 0, 1);
      Gait.LIMBS.forEach((limb) => {
        const foot = cat.feet[limb];
        if (!foot) return;
        const anchor = anchorWorld(limb);
        foot.x = anchor.x + (cat.x - anchor.x) * 0.4;
        foot.y = anchor.y + (cat.y - anchor.y) * 0.4;
        foot.planted = false;
        foot.wasPlanted = false;
        foot.lift = 0.9;
        foot.phase = 0.9;
        foot.swingProgress = u;
        foot.recoveryActive = false;
        foot.settleActive = false;
        foot.angle = cat.heading;
      });
      while (prints.length && elapsed - prints[0].born > 5.2) prints.shift();
      return;
    }
    if (cat.startle.active) {   // 受惊后跳：前爪短收、后爪落桩支撑（some(planted) 门禁恒真——若后爪恰在摆动相则就地落桩）
      ['rightHind', 'leftHind'].forEach((limb) => {
        const foot = cat.feet[limb];
        if (!foot || foot.planted) return;
        foot.planted = true;
        foot.wasPlanted = true;
        foot.lift = 0;
        foot.phase = 0;
        foot.swingProgress = 0;
        foot.recoveryActive = false;
        foot.settleActive = false;
        cat.gait.legPhases[limb] = 0;
        cat.gait.dutyFactors[limb] = cat.gait.dutyFactor;
      });
      ['rightFore', 'leftFore'].forEach((limb) => {
        const foot = cat.feet[limb];
        if (!foot) return;
        const anchor = anchorWorld(limb);
        foot.x = anchor.x + (cat.x - anchor.x) * 0.3;
        foot.y = anchor.y + (cat.y - anchor.y) * 0.3;
        foot.planted = false;
        foot.wasPlanted = false;
        foot.lift = 0.6;
        foot.phase = 0.9;
        foot.swingProgress = Gait.clamp(cat.startle.t / cat.startle.dur, 0, 1);
        foot.recoveryActive = false;
        foot.settleActive = false;
      });
    }
    const settling = cat.speed < 2.5 * a.scale && cat.gait.cadence < 0.12;
    const airborne = Gait.LIMBS.filter((limb) => {
      const foot = cat.feet[limb];
      if (!foot) return false;
      // 按爪的"实况支撑态"计数，不看步态样本——样本与实况会背离（受惊短收、settle 途中冻结的
      // 摆动爪：样本说落地、实爪悬空），凭样本计数会超发恢复槽 → 多爪同时离地（门禁抓过的真实回归）。
      return !(foot.planted && !foot.recoveryActive && !foot.settleActive);
    }).length;
    // Begin unloading before the anatomical stop is visible. 恢复槽保留两爪支撑余量：
    // 步态随时可能自然抬起下一只爪（选槽时无法预知），余量 1 会被这只爪抢走最后支撑
    //（门禁抓过的真实回归）；侧序步态的真猫本就任何时刻 ≥2 爪着地。
    const recoverySlots = Math.max(0, 2 - airborne);
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
      // 转弯提前碎步（owner 反馈）：原地转体时步频≈0，落桩爪会被身体旋转扫向伸展极限——
      // 真猫用连续小碎步跟着转。慢速行进转弯也按角速度提前挪步；chase 快步态本就两爪腾空、
      // 再降阈会与步态摆动抢走最后支撑（门禁抓过），保持 0.86。
      .filter((entry) => entry.ratio > (
        cat.state === 'chase'
          ? 0.86
          : (cat.speed < 10 * a.scale && Math.abs(cat.rig.turnVelocity) > 0.55)
            ? 0.64
            : 0.86 - Gait.clamp(Math.abs(cat.rig.turnVelocity) * 0.08, 0, 0.14)
      ))
      .sort((left, right) => right.ratio - left.ratio)
      .slice(0, recoverySlots);
    overextended.forEach(({ limb }) => beginReachRecovery(limb, cat.feet[limb], a));

    Gait.LIMBS.forEach((limb) => {
      if (cat.startle.active && LEG_CONFIG[limb].fore) return;   // 受惊窗口内前爪由上方短收接管
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
          // 静置时身体的微动（头颈摆动/支撑摆/姿态标量）会慢慢把原地的爪子拉向伸展极限 —— 像真猫一样挪个小步
          // 重新安放（settle 过程中爪子处于非 planted 抬起态 → 不违反"落地爪零滑移"门禁）。
          const settleSupport = Gait.LIMBS.filter((other) => {
            const f = cat.feet[other];
            return f && f.planted && !f.settleActive && !f.recoveryActive;
          }).length;
          // 挪步也要守支撑（转弯放宽触发后，同帧多爪齐挪会四脚离地）：≥3 爪在地才准起一只
          if (settleSupport >= 3
            && legReach(limb, foot).distance > legReachLimit(limb, a) * (Math.abs(cat.rig.turnVelocity) > 0.35 ? 0.7 : 0.96)) {
            const restPoint = expectedPawWorld(limb, { longitudinal: 0, lateral: 0 }, 0);
            foot.settleActive = true;
            foot.settleProgress = 0;
            foot.settleStartX = foot.x;
            foot.settleStartY = foot.y;
            foot.settleStartLift = foot.lift;
            foot.settleTargetX = restPoint.x;
            foot.settleTargetY = restPoint.y;
          } else {
            foot.lift = 0;
            return;
          }
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
        constrainFootReach(limb, foot, a);
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
        // 紧急贴限：急转贴身追逐时恢复槽可能占满，落桩爪被身体拉过展限 → 沿伸展圆做亚像素滑移
        // （真猫急转本就会拧爪微滑；慢速场景永不触发，落地零滑移不变量在那些场景原样成立）。
        if (legReach(limb, foot).distance > legReachLimit(limb, a)) constrainFootReach(limb, foot, a);
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
      (cat.bodySway * 0.9 + cat.wiggle * 0.6 + restRearLateral()) * a.scale,
    );
    const pelvisHeading = cat.rig.pelvis.angle;
    const tailCfg = TAIL_BY_STATE[cat.state] || TAIL_BY_STATE.prowl;
    const flickStrength = tailCfg.strength;
    const flickRate = tailCfg.rate;
    const restTailWeights = Object.fromEntries(REST_POSES.map((mode) => [mode, poseChannelWeight(mode, 'tail')]));
    const restTailWeight = Gait.clamp(
      Object.values(restTailWeights).reduce((sum, weight) => sum + weight, 0),
      0,
      1,
    );
    const wrapDirection = restTailWeight > 0.001 ? restPoseSide() : 1;

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
      const linWeight = index / (cat.tail.length - 1);
      const weight = tailCfg.tip ? Math.pow(linWeight, 3) : linWeight;   // 尾尖模式：蓄势时只有末段高频打点
      const wave = Math.sin(elapsed * flickRate * Gait.TAU - index * 0.42) * flickStrength * weight
        + tailCfg.wrap * wrapDirection * 46 * linWeight
        + dreamTwitchAmount('tail') * 18 * Math.pow(linWeight, 2.4);   // 梦中只抽动尾尖，根部保持沉稳
      point.x += velocityX - Math.sin(pelvisHeading) * wave * dt * dt;
      point.y += velocityY + Math.cos(pelvisHeading) * wave * dt * dt;
    }

    if (restTailWeight > 0.001) {
      const arcByMode = { sit: 1.35, loaf: 1.72, sideLie: 1.02, roll: 0.5, curl: 2.45 };
      const arc = REST_POSES.reduce((sum, mode) => (
        sum + (arcByMode[mode] + (mode === 'roll' ? restRollWave() * 0.26 : 0)) * restTailWeights[mode]
      ), 0) / restTailWeight;
      const target = [{ x: base.x, y: base.y }];
      for (let index = 1; index < cat.tail.length; index += 1) {
        const t = index / Math.max(1, cat.tail.length - 1);
        const tangent = pelvisHeading + Math.PI + restPoseSide() * arc * t;
        const previous = target[index - 1];
        target.push({
          x: previous.x + Math.cos(tangent) * a.tailSegment,
          y: previous.y + Math.sin(tangent) * a.tailSegment,
        });
      }
      const settle = (1 - Math.exp(-dt * 8.5)) * restTailWeight;
      for (let index = 1; index < cat.tail.length; index += 1) {
        cat.tail[index].x += (target[index].x - cat.tail[index].x) * settle;
        cat.tail[index].y += (target[index].y - cat.tail[index].y) * settle;
      }
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
    // Deferred scripts can run before the canvas has a laid-out size: a 1×1
    // viewport makes width/height negative here, arcTo throws on the negative
    // radius, and the whole init IIFE dies before the raf loop starts (the page
    // then shows a single static frame painted later by the ResizeObserver).
    const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
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
    if (width <= 8 || height <= 8) return;   // 布局未就绪的退化尺寸：本帧不画地毯（防负几何）
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
        (SKIN_TOPOLOGY.tailRootRadius - SKIN_TOPOLOGY.tailTipRadius) * Math.pow(1 - t, 0.5)
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
      (cat.bodySway * 0.9 + cat.wiggle * 0.6 + restRearLateral()) * a.scale,
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
      foot,
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

  function legRenderPoints(geometry) {
    const points = [];
    for (let index = 0; index <= 4; index += 1) {
      points.push(quadraticPoint(
        geometry.anchor,
        geometry.upperControl,
        geometry.joint,
        index / 4,
      ));
    }
    for (let index = 1; index <= 5; index += 1) {
      points.push(quadraticPoint(
        geometry.joint,
        geometry.lowerControl,
        geometry.foot,
        index / 5,
      ));
    }
    return points;
  }

  function traceVariableRibbon(context, points, radii, offsetX, offsetY) {
    const ox = offsetX || 0;
    const oy = offsetY || 0;
    const left = [];
    const right = [];
    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const radius = radii[index];
      const nx = -dy / distance * radius;
      const ny = dx / distance * radius;
      left.push({ x: point.x + nx + ox, y: point.y + ny + oy });
      right.push({ x: point.x - nx + ox, y: point.y - ny + oy });
    });

    context.beginPath();
    smoothOpenPath(context, left);
    const last = points[points.length - 1];
    const beforeLast = points[points.length - 2];
    const endDistance = Math.max(0.001, Math.hypot(last.x - beforeLast.x, last.y - beforeLast.y));
    context.quadraticCurveTo(
      last.x + (last.x - beforeLast.x) / endDistance * radii[radii.length - 1] * 0.34 + ox,
      last.y + (last.y - beforeLast.y) / endDistance * radii[radii.length - 1] * 0.34 + oy,
      right[right.length - 1].x,
      right[right.length - 1].y,
    );
    smoothOpenPath(context, right.slice().reverse(), true);
    const first = points[0];
    const second = points[1];
    const startDistance = Math.max(0.001, Math.hypot(second.x - first.x, second.y - first.y));
    context.quadraticCurveTo(
      first.x - (second.x - first.x) / startDistance * radii[0] * 0.28 + ox,
      first.y - (second.y - first.y) / startDistance * radii[0] * 0.28 + oy,
      left[0].x,
      left[0].y,
    );
    context.closePath();
  }

  function legRibbon(geometry, foot, a) {
    const points = legRenderPoints(geometry);
    const baseRadius = (geometry.config.fore ? 6.35 : 7.35) * a.scale;
    const ankleRadius = (geometry.config.fore ? 4.15 : 4.85) * a.scale;
    const radii = points.map((point, index) => {
      const t = index / Math.max(1, points.length - 1);
      const jointVolume = Math.sin(Math.PI * t) * (geometry.config.fore ? 0.38 : 0.58) * a.scale;
      const liftTaper = 1 - foot.lift * t * 0.08;
      return (baseRadius + (ankleRadius - baseRadius) * Math.pow(t, 0.78) + jointVolume) * liftTaper;
    });
    return { points, radii };
  }

  function traceLegSilhouette(context, geometry, foot, a, offsetX, offsetY) {
    const ribbon = legRibbon(geometry, foot, a);
    traceVariableRibbon(context, ribbon.points, ribbon.radii, offsetX, offsetY);
  }

  // 腿的可见描边只走两条侧缘（同躯干 strokeBodyFlanks 的处理）：脚踝端不画封口弧，
  // 侧缘线自然流进爪轮廓 → 腿与爪不再是"两个几何体叠放"。
  function strokeLegFlanks(context, geometry, foot, a) {
    const ribbon = legRibbon(geometry, foot, a);
    const left = [];
    const right = [];
    ribbon.points.forEach((point, index) => {
      const previous = ribbon.points[Math.max(0, index - 1)];
      const next = ribbon.points[Math.min(ribbon.points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const radius = ribbon.radii[index];
      left.push({ x: point.x - dy / distance * radius, y: point.y + dx / distance * radius });
      right.push({ x: point.x + dy / distance * radius, y: point.y - dx / distance * radius });
    });
    context.beginPath();
    smoothOpenPath(context, left);
    context.stroke();
    context.beginPath();
    smoothOpenPath(context, right);
    context.stroke();
  }

  function tracePawSilhouette(context, a, config) {
    const front = (config.fore ? 9.0 : 9.6) * a.scale;
    const rear = (config.fore ? -7.0 : -7.7) * a.scale;
    const half = (config.fore ? 5.1 : 5.7) * a.scale;
    context.beginPath();
    context.moveTo(rear, -half * 0.62);
    context.bezierCurveTo(-2.6 * a.scale, -half, 2.4 * a.scale, -half * 1.04, front * 0.62, -half * 0.7);
    context.bezierCurveTo(front * 0.88, -half * 0.54, front, -half * 0.24, front, 0);
    context.bezierCurveTo(front, half * 0.24, front * 0.88, half * 0.54, front * 0.62, half * 0.7);
    context.bezierCurveTo(2.4 * a.scale, half * 1.04, -2.6 * a.scale, half, rear, half * 0.62);
    context.bezierCurveTo(rear - 1.35 * a.scale, half * 0.34, rear - 1.35 * a.scale, -half * 0.34, rear, -half * 0.62);
    context.closePath();
  }

  function strokePawOutline(context, a, config) {
    const front = (config.fore ? 9.0 : 9.6) * a.scale;
    const rear = (config.fore ? -7.0 : -7.7) * a.scale;
    const half = (config.fore ? 5.1 : 5.7) * a.scale;
    context.beginPath();
    context.moveTo(rear, -half * 0.62);
    context.bezierCurveTo(-2.6 * a.scale, -half, 2.4 * a.scale, -half * 1.04, front * 0.62, -half * 0.7);
    context.bezierCurveTo(front * 0.88, -half * 0.54, front, -half * 0.24, front, 0);
    context.bezierCurveTo(front, half * 0.24, front * 0.88, half * 0.54, front * 0.62, half * 0.7);
    context.bezierCurveTo(2.4 * a.scale, half * 1.04, -2.6 * a.scale, half, rear, half * 0.62);
  }

  function strokePawToes(context, a, config) {
    const front = (config.fore ? 9.0 : 9.6) * a.scale;
    const spread = (config.fore ? 1.7 : 1.9) * a.scale;
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.moveTo(front * 0.55, side * spread);
      context.quadraticCurveTo(front * 0.73, side * spread * 0.72, front * 0.88, side * spread * 0.44);
      context.stroke();
    });
  }

  function earAngle(side) {
    return side < 0 ? cat.ears.left : cat.ears.right;
  }

  function earPerk(side) {
    return side < 0 ? cat.earPerk.left : cat.earPerk.right;
  }

  function pointToward(from, toward, distance) {
    const dx = toward.x - from.x;
    const dy = toward.y - from.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const amount = Math.min(1, distance / length);
    return { x: from.x + dx * amount, y: from.y + dy * amount };
  }

  function earLandmarks(side) {
    const perk = earPerk(side);
    const isLeft = side < 0;
    const lengthBias = isLeft ? 0.985 : 1.015;
    const widthBias = isLeft ? 1.02 : 0.98;
    const rearBase = {
      x: EAR_GEOMETRY.rearBaseForward + (isLeft ? -0.2 : 0.2),
      y: side * (EAR_GEOMETRY.rearBaseOutward + (isLeft ? 0.2 : -0.15)),
    };
    const frontBase = {
      x: EAR_GEOMETRY.frontBaseForward + (isLeft ? -0.1 : 0.15),
      y: side * (EAR_GEOMETRY.frontBaseOutward + (isLeft ? 0.15 : -0.15)),
    };
    const root = {
      x: EAR_GEOMETRY.rootForward + (isLeft ? -0.15 : 0.15),
      y: side * (EAR_GEOMETRY.rootOutward + (isLeft ? 0.2 : -0.15)),
    };
    const neutralTip = {
      x: EAR_GEOMETRY.tipForward * (0.96 + perk * 0.04) * lengthBias,
      y: side * EAR_GEOMETRY.tipOutward * (0.91 + perk * 0.09) * widthBias,
    };
    const rotatedTip = rotatePoint(neutralTip.x, neutralTip.y, earAngle(side));
    const tip = { x: root.x + rotatedTip.x, y: root.y + rotatedTip.y };
    return {
      rearBase,
      frontBase,
      root,
      tip,
      rearShoulder: pointToward(tip, rearBase, EAR_GEOMETRY.tipRound),
      frontShoulder: pointToward(tip, frontBase, EAR_GEOMETRY.tipRound),
    };
  }

  function traceEarCrown(context, a, ear, reverse = false) {
    const firstShoulder = reverse ? ear.frontShoulder : ear.rearShoulder;
    const secondShoulder = reverse ? ear.rearShoulder : ear.frontShoulder;
    const firstBase = reverse ? ear.frontBase : ear.rearBase;
    const endBase = reverse ? ear.rearBase : ear.frontBase;
    const side = Math.sign(ear.tip.y) || 1;
    const firstBend = reverse ? -side * 0.45 : side * 0.65;
    const secondBend = reverse ? side * 0.65 : -side * 0.45;
    context.quadraticCurveTo(
      (firstShoulder.x + firstBase.x) * 0.5 * a.scale,
      ((firstShoulder.y + firstBase.y) * 0.5 + firstBend) * a.scale,
      firstShoulder.x * a.scale,
      firstShoulder.y * a.scale,
    );
    context.quadraticCurveTo(
      ear.tip.x * a.scale,
      ear.tip.y * a.scale,
      secondShoulder.x * a.scale,
      secondShoulder.y * a.scale,
    );
    context.quadraticCurveTo(
      (secondShoulder.x + endBase.x) * 0.5 * a.scale,
      ((secondShoulder.y + endBase.y) * 0.5 + secondBend) * a.scale,
      endBase.x * a.scale,
      endBase.y * a.scale,
    );
  }

  function traceHeadSilhouette(context, a) {
    const leftEar = earLandmarks(-1);
    const rightEar = earLandmarks(1);
    context.beginPath();
    context.moveTo(-SKIN_TOPOLOGY.headRearReach * a.scale, 0);
    context.bezierCurveTo(-20.5 * a.scale, -11.8 * a.scale, -13.5 * a.scale, -16.4 * a.scale, leftEar.rearBase.x * a.scale, leftEar.rearBase.y * a.scale);
    traceEarCrown(context, a, leftEar);
    context.bezierCurveTo(18.2 * a.scale, -15.4 * a.scale, 21.6 * a.scale, -13.7 * a.scale, 23.2 * a.scale, -11.1 * a.scale);
    context.bezierCurveTo(26.8 * a.scale, -10 * a.scale, 29.4 * a.scale, -7.2 * a.scale, 30.1 * a.scale, -3.3 * a.scale);
    context.quadraticCurveTo(31.5 * a.scale, 0, 30.1 * a.scale, 3.3 * a.scale);
    context.bezierCurveTo(29.4 * a.scale, 7.2 * a.scale, 26.8 * a.scale, 10 * a.scale, 23.2 * a.scale, 11.1 * a.scale);
    context.bezierCurveTo(21.6 * a.scale, 13.7 * a.scale, 18.2 * a.scale, 15.4 * a.scale, rightEar.frontBase.x * a.scale, rightEar.frontBase.y * a.scale);
    traceEarCrown(context, a, rightEar, true);
    context.bezierCurveTo(-13.5 * a.scale, 16.4 * a.scale, -20.5 * a.scale, 11.8 * a.scale, -SKIN_TOPOLOGY.headRearReach * a.scale, 0);
    context.closePath();
  }

  function traceHeadCrown(context, a) {
    const leftEar = earLandmarks(-1);
    const rightEar = earLandmarks(1);
    context.beginPath();
    context.moveTo(leftEar.rearBase.x * a.scale, leftEar.rearBase.y * a.scale);
    traceEarCrown(context, a, leftEar);
    context.bezierCurveTo(18.2 * a.scale, -15.4 * a.scale, 21.6 * a.scale, -13.7 * a.scale, 23.2 * a.scale, -11.1 * a.scale);
    context.bezierCurveTo(26.8 * a.scale, -10 * a.scale, 29.4 * a.scale, -7.2 * a.scale, 30.1 * a.scale, -3.3 * a.scale);
    context.quadraticCurveTo(31.5 * a.scale, 0, 30.1 * a.scale, 3.3 * a.scale);
    context.bezierCurveTo(29.4 * a.scale, 7.2 * a.scale, 26.8 * a.scale, 10 * a.scale, 23.2 * a.scale, 11.1 * a.scale);
    context.bezierCurveTo(21.6 * a.scale, 13.7 * a.scale, 18.2 * a.scale, 15.4 * a.scale, rightEar.frontBase.x * a.scale, rightEar.frontBase.y * a.scale);
    traceEarCrown(context, a, rightEar, true);
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
      const foot = renderedFoot(limb, a);
      if (!foot) return;
      const geometry = legGeometry(limb, foot, a);
      const liftOffset = foot.lift * 5.5 * a.scale;
      traceLegSilhouette(ctx, geometry, foot, a, offsetX, offsetY + liftOffset * 0.35);
      ctx.fill();
      ctx.save();
      ctx.translate(foot.x + offsetX, foot.y + offsetY + liftOffset);
      ctx.rotate(Number.isFinite(foot.angle) ? foot.angle : cat.heading);
      ctx.scale(1 - foot.lift * 0.08, 1 - foot.lift * 0.12);
      tracePawSilhouette(ctx, a, geometry.config);
      ctx.fill();
      ctx.restore();
    });

    traceBodySilhouette(ctx, a, offsetX, offsetY);
    ctx.fill();

    ctx.save();
    ctx.translate(cat.rig.head.x + offsetX, cat.rig.head.y + offsetY);
    ctx.rotate(cat.rig.head.angle);
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

    // 深色尾尖（虎斑签名）：clip 到尾带轮廓内，在末端画一块深色 → 只染出尾尖
    ctx.save();
    traceTailRibbon(ctx, renderTail, a.scale, 0, 0);
    ctx.clip();
    const tipCenter = renderTail[renderTail.length - 1];
    ctx.fillStyle = c.furDark;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(tipCenter.x, tipCenter.y, a.tailSegment * 1.55, 0, Gait.TAU);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = 0.8;
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
      ctx.lineWidth = (2.9 - t * 0.75) * a.scale;
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

  function drawLegs(c, layer) {
    const a = anatomy();
    Gait.LIMBS.forEach((limb) => {
      if (restLimbLayer(limb) !== layer) return;
      const foot = renderedFoot(limb, a);
      if (!foot) return;
      const geometry = legGeometry(limb, foot, a);

      ctx.save();
      ctx.lineJoin = 'round';
      ctx.fillStyle = c.fur;
      ctx.strokeStyle = c.furDark;
      ctx.lineWidth = 0.82 * a.scale;
      traceLegSilhouette(ctx, geometry, foot, a, 0, 0);
      ctx.fill();
      ctx.globalAlpha = 0.46;
      strokeLegFlanks(ctx, geometry, foot, a);
      ctx.restore();

      ctx.save();
      ctx.translate(foot.x, foot.y);
      ctx.rotate(Number.isFinite(foot.angle) ? foot.angle : cat.heading);
      ctx.scale(1 - foot.lift * 0.08, 1 - foot.lift * 0.12);
      ctx.fillStyle = c.fur;   // 爪先铺底毛：与腿同一块皮毛 → 单一连续肢体
      ctx.strokeStyle = c.furDark;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.82 * a.scale;
      tracePawSilhouette(ctx, a, geometry.config);
      ctx.fill();
      ctx.save();
      ctx.scale(0.84, 0.84);
      ctx.fillStyle = c.cream;   // 奶油"袜子"缩进爪缘内 → 读作皮毛上的斑纹而非另一块几何
      tracePawSilhouette(ctx, a, geometry.config);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.46;
      strokePawOutline(ctx, a, geometry.config);
      ctx.stroke();
      ctx.globalAlpha = 0.24;
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.72 * a.scale;
      strokePawToes(ctx, a, geometry.config);
      ctx.restore();
    });
  }

  function bodyStations(a, offsetX, offsetY) {
    const ox = offsetX || 0;
    const oy = offsetY || 0;
    const narrow = cat.skinNarrow;
    const define = (node, forward, width, lateral) => {
      const point = pointFromNode(node, forward * a.scale, (lateral || 0) * a.scale);
      return {
        x: point.x + ox,
        y: point.y + oy,
        angle: node.angle,
        width: width * a.scale * narrow,
      };
    };
    const sit = restPoseWeight('sit');
    const loaf = restPoseWeight('loaf');
    const lie = restPoseWeight('sideLie');
    const roll = restPoseWeight('roll');
    const curl = restPoseWeight('curl');
    const side = restPoseSide();
    const rock = restRollWave();
    const breath = cat.idle.breath * (loaf * 0.02 + lie * 0.014 + curl * 0.018 + sit * 0.009);
    const dream = reducedMotion ? 0 : cat.idle.twitch * cat.idle.sleepDepth;
    const spread = 1 + 0.22 * cat.poseSpread + sit * 0.12 + loaf * 0.08
      + roll * 0.06 + curl * 0.04 + breath + dream * 0.0025;   // sit：着地后躯从头顶看明显加宽（梨形底座）
    const shift = 4 * cat.poseSpread - 6 * cat.poseStretch + sit * 6 + loaf * 8 + roll * 2.5 + curl * 5;
    const rearLateral = restRearLateral() + dream * side * 0.18;
    const waistLateral = side * (lie * 3.4 + curl * 2.8) + rock * 1.4 + dream * side * 0.34;
    const shoulderLateral = side * (lie * 1.4 + curl * 1.8) - rock * 1.2 - dream * side * 0.22;
    const stations = [
      define(cat.rig.pelvis, -27 + shift, 13 * spread, rearLateral),
      define(cat.rig.pelvis, -17 + shift, 27 * spread, rearLateral),
      define(cat.rig.pelvis, 1 + shift * 0.5, 32 * spread, rearLateral * 0.72),
      define(cat.rig.pelvis, 15, 26 * (1 + roll * 0.08), rearLateral * 0.42),
      define(cat.rig.waist, 0, 21 * (1 + lie * 0.08 + roll * 0.14), waistLateral),
      define(cat.rig.shoulders, -13, 24 * (1 + roll * 0.08), shoulderLateral),
      define(cat.rig.shoulders, 1, 28 * (1 + loaf * 0.05 + roll * 0.1), shoulderLateral * 0.72),
      define(cat.rig.shoulders, 13, 20.5, shoulderLateral * 0.28),
      define(cat.rig.neck, 3, 13.5),
    ];
    const bridgeT = SKIN_TOPOLOGY.headBridgeT;
    const bridgeDx = cat.rig.head.x - cat.rig.neck.x;
    const bridgeDy = cat.rig.head.y - cat.rig.neck.y;
    stations.push({
      x: cat.rig.neck.x + bridgeDx * bridgeT + ox,
      y: cat.rig.neck.y + bridgeDy * bridgeT + oy,
      angle: Math.atan2(bridgeDy, bridgeDx),
      width: 12 * a.scale * narrow,
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
      x: contours.front.x + Math.cos(contours.front.angle) * 4 * a.scale,
      y: contours.front.y + Math.sin(contours.front.angle) * 4 * a.scale,
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
      rear.x - Math.cos(rear.angle) * 6 * a.scale,
      rear.y - Math.sin(rear.angle) * 6 * a.scale,
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

  function poseEnvelopeSnapshot() {
    const a = anatomy();
    const contours = bodyContours(a, 0, 0);
    const points = [...contours.left, ...contours.right];
    const headRadius = cat.rig.head.visualRadius;
    points.push(
      { x: cat.rig.head.x - headRadius, y: cat.rig.head.y - headRadius },
      { x: cat.rig.head.x + headRadius, y: cat.rig.head.y + headRadius },
    );
    tailRenderPoints(a).forEach((point) => {
      points.push(
        { x: point.x - SKIN_TOPOLOGY.tailRootRadius * a.scale, y: point.y - SKIN_TOPOLOGY.tailRootRadius * a.scale },
        { x: point.x + SKIN_TOPOLOGY.tailRootRadius * a.scale, y: point.y + SKIN_TOPOLOGY.tailRootRadius * a.scale },
      );
    });
    Gait.LIMBS.forEach((limb) => {
      const foot = renderedFoot(limb, a);
      if (!foot) return;
      points.push(
        { x: foot.x - 11 * a.scale, y: foot.y - 11 * a.scale },
        { x: foot.x + 11 * a.scale, y: foot.y + 11 * a.scale },
      );
    });
    return {
      left: Math.min(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.y)),
      right: Math.max(...points.map((point) => point.x)),
      bottom: Math.max(...points.map((point) => point.y)),
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

  // 脊背主纹：沿关节化脊柱 stations 中线描一条深色 mackerel 主干 —— stations 逐帧派生自 rig，
  // 身体怎么弯纹就怎么弯。定义在未扫描区（drawBody 源码区禁止出现 ctx.stroke）。
  function drawDorsalStripe(c, contours, a) {
    ctx.strokeStyle = c.stripe;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3.4 * a.scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    smoothOpenPath(ctx, contours.stations.slice(2, contours.stations.length - 1));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 耳背暗斑：真虎斑俯视时耳背是深色的（是背面绒毛，不是门禁防的粉色内耳芯）。软平涂、低对比。
  function paintEarBacks(c, a) {
    ctx.fillStyle = c.earShade;
    ctx.strokeStyle = c.furDark;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.7 * a.scale;
    [-1, 1].forEach((side) => {
      const ear = earLandmarks(side);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const insetRear = pointToward(ear.rearBase, ear.tip, 3.2);
      const insetFront = pointToward(ear.frontBase, ear.tip, 3.2);
      const insetTip = pointToward(ear.tip, ear.root, 3.8);
      ctx.moveTo(insetRear.x * a.scale, insetRear.y * a.scale);
      ctx.quadraticCurveTo(
        ear.root.x * a.scale,
        ear.root.y * a.scale,
        insetTip.x * a.scale,
        insetTip.y * a.scale,
      );
      ctx.quadraticCurveTo(
        (insetTip.x + insetFront.x) * 0.5 * a.scale,
        (insetTip.y + insetFront.y) * 0.5 * a.scale,
        insetFront.x * a.scale,
        insetFront.y * a.scale,
      );
      ctx.closePath();
      ctx.fill();

      // A single soft cartilage fold gives the pinna thickness without
      // turning it back into a detached pink triangle.
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(insetRear.x * a.scale, insetRear.y * a.scale);
      ctx.quadraticCurveTo(
        ear.root.x * a.scale,
        ear.root.y * a.scale,
        insetTip.x * a.scale,
        insetTip.y * a.scale,
      );
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // 俯视胡须：从正上方看胡须确实突出于头轮廓之外（猫的招牌）。头局部坐标系内绘制，随头转。
  const WHISKER_ROWS = Object.freeze([
    Object.freeze([20, 5.1, 36, 14.5]),
    Object.freeze([21.5, 6.7, 38, 20]),
    Object.freeze([20.2, 8.2, 35, 25]),
  ]);
  function drawWhiskers(c, a) {
    ctx.strokeStyle = c.whisker;
    ctx.globalAlpha = 0.5;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.7 * a.scale;
    const spread = 1 + 0.1 * ((cat.earPerk.left + cat.earPerk.right) * 0.5)
      + cat.idle.breath * 0.025;
    [-1, 1].forEach((side) => {
      WHISKER_ROWS.forEach(([x0, y0, x1, y1]) => {
        ctx.beginPath();
        ctx.moveTo(x0 * a.scale, side * y0 * a.scale);
        ctx.quadraticCurveTo(
          (x0 + x1) * 0.55 * a.scale,
          side * (y0 + y1) * 0.48 * a.scale * spread,
          x1 * a.scale,
          side * y1 * a.scale * spread,
        );
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;
  }

  function blinkClosure(side) {
    if (reducedMotion || cat.idle.sleepDepth > 0.72) return 0;
    const phase = elapsed + (side < 0 ? 0 : 0.055);
    const primary = Math.max(0, Math.sin(phase * 0.57 + 1.4)) ** 34;
    const secondary = Math.max(0, Math.sin(phase * 0.83 + 4.1)) ** 48;
    return Gait.clamp(primary + secondary, 0, 1);
  }

  function eyeOpenness(side) {
    const alert = prey.active ? 0.96 : (cat.state === 'prowl' ? 0.76 : 0.82);
    const drowsy = 1 - cat.idle.sleepDepth * 0.96;
    const dreamSqueeze = Math.abs(dreamTwitchAmount('ear', side)) * 0.24;
    return Gait.clamp(alert * drowsy * (1 - blinkClosure(side)) - dreamSqueeze, 0.035, 1);
  }

  function traceEye(context, a, side, openness) {
    const y = (value) => side * value * a.scale;
    const x = (value) => value * a.scale;
    context.beginPath();
    context.moveTo(x(10.4), y(8.45));
    context.bezierCurveTo(
      x(13.1), y(9.45 + openness * 0.72),
      x(17.6), y(9.05 + openness * 0.5),
      x(20.35), y(6.75),
    );
    context.bezierCurveTo(
      x(17.35), y(6.55 - openness * 0.48),
      x(13.25), y(6.75 - openness * 0.36),
      x(10.4), y(8.45),
    );
    context.closePath();
  }

  function drawEye(c, a, side) {
    const openness = eyeOpenness(side);
    traceEye(ctx, a, side, openness);
    ctx.fillStyle = c.eye;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.strokeStyle = c.eyeRing;
    ctx.lineWidth = 1.05 * a.scale;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.88;
    ctx.stroke();

    if (openness > 0.16) {
      const centerX = 16.45 * a.scale;
      const centerY = side * 7.85 * a.scale;
      const halfHeight = (0.75 + openness * 0.95) * a.scale;
      ctx.fillStyle = c.pupil;
      ctx.globalAlpha = 0.94;
      ctx.beginPath();
      ctx.moveTo(centerX - 0.62 * a.scale, centerY);
      ctx.bezierCurveTo(
        centerX - 0.42 * a.scale, centerY - halfHeight,
        centerX + 0.42 * a.scale, centerY - halfHeight,
        centerX + 0.62 * a.scale, centerY,
      );
      ctx.bezierCurveTo(
        centerX + 0.42 * a.scale, centerY + halfHeight,
        centerX - 0.42 * a.scale, centerY + halfHeight,
        centerX - 0.62 * a.scale, centerY,
      );
      ctx.fill();
      ctx.fillStyle = c.eyeGlint;
      ctx.globalAlpha = openness * 0.82;
      ctx.beginPath();
      ctx.arc(centerX + 0.65 * a.scale, centerY - side * 0.7 * a.scale, 0.52 * a.scale, 0, Gait.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function traceMuzzlePlane(context, a, side) {
    const y = (value) => side * value * a.scale;
    const x = (value) => value * a.scale;
    context.beginPath();
    context.moveTo(x(18.1), y(4.25));
    context.bezierCurveTo(x(22), y(3.1), x(27.8), y(2.55), x(29.1), y(0.55));
    context.bezierCurveTo(x(27.3), y(5.85), x(23), y(8.55), x(18.5), y(8.25));
    context.bezierCurveTo(x(17.15), y(7.2), x(17.05), y(5.25), x(18.1), y(4.25));
    context.closePath();
  }

  function drawHeadPlanes(c, a) {
    ctx.save();
    traceHeadSilhouette(ctx, a);
    ctx.clip();

    // Forehead dome, temples and paired muzzle pads overlap softly. They are
    // anatomical planes rather than independent circles, so the head reads as
    // one volume even when the eyes are closed.
    ctx.fillStyle = c.furLight;
    ctx.globalAlpha = 0.16;
    ctx.filter = `blur(${2.8 * a.scale}px)`;
    ctx.beginPath();
    ctx.moveTo(-13 * a.scale, 0);
    ctx.bezierCurveTo(-7 * a.scale, -12 * a.scale, 13 * a.scale, -13 * a.scale, 20 * a.scale, -5 * a.scale);
    ctx.bezierCurveTo(24 * a.scale, 0, 20 * a.scale, 5 * a.scale, 13 * a.scale, 8 * a.scale);
    ctx.bezierCurveTo(2 * a.scale, 12 * a.scale, -9 * a.scale, 8 * a.scale, -13 * a.scale, 0);
    ctx.fill();
    ctx.filter = 'none';

    [-1, 1].forEach((side) => {
      ctx.fillStyle = c.cream;
      ctx.globalAlpha = 0.18;
      traceMuzzlePlane(ctx, a, side);
      ctx.fill();

      ctx.fillStyle = c.furDark;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.moveTo(3 * a.scale, side * 14.7 * a.scale);
      ctx.bezierCurveTo(
        10 * a.scale, side * 13.5 * a.scale,
        18 * a.scale, side * 12.5 * a.scale,
        23.5 * a.scale, side * 10.2 * a.scale,
      );
      ctx.bezierCurveTo(
        19 * a.scale, side * 11.2 * a.scale,
        11 * a.scale, side * 12.1 * a.scale,
        3 * a.scale, side * 14.7 * a.scale,
      );
      ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawMuzzleFeatures(c, a) {
    ctx.fillStyle = c.nose;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(30.2 * a.scale, 0);
    ctx.bezierCurveTo(29.4 * a.scale, -1.85 * a.scale, 27.1 * a.scale, -1.65 * a.scale, 26.9 * a.scale, -0.35 * a.scale);
    ctx.bezierCurveTo(27.4 * a.scale, 1.6 * a.scale, 29.35 * a.scale, 1.85 * a.scale, 30.2 * a.scale, 0);
    ctx.fill();

    ctx.strokeStyle = c.furDark;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.72 * a.scale;
    ctx.globalAlpha = 0.46;
    ctx.beginPath();
    ctx.moveTo(27.35 * a.scale, 0);
    ctx.bezierCurveTo(26.5 * a.scale, 0, 26.15 * a.scale, 0, 25.65 * a.scale, 0);
    ctx.moveTo(25.8 * a.scale, 0);
    ctx.quadraticCurveTo(25.05 * a.scale, -1.3 * a.scale, 23.7 * a.scale, -1.55 * a.scale);
    ctx.moveTo(25.8 * a.scale, 0);
    ctx.quadraticCurveTo(25.05 * a.scale, 1.3 * a.scale, 23.7 * a.scale, 1.55 * a.scale);
    ctx.stroke();

    ctx.fillStyle = c.furDark;
    ctx.globalAlpha = 0.34;
    [-1, 1].forEach((side) => {
      [[21.2, 5.05], [22.6, 6.15], [20.7, 7.2]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * a.scale, side * y * a.scale, 0.45 * a.scale, 0, Gait.TAU);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
  }

  function drawFacialFur(c, a) {
    ctx.strokeStyle = c.furDark;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.62 * a.scale;
    ctx.globalAlpha = 0.3;
    [-1, 1].forEach((side) => {
      [[-13.5, 9.1, -16.2, 10.7], [-8.5, 12.6, -10.2, 14.5], [22.8, 9.8, 25.1, 11.2]].forEach((tuft) => {
        ctx.beginPath();
        ctx.moveTo(tuft[0] * a.scale, side * tuft[1] * a.scale);
        ctx.quadraticCurveTo(
          (tuft[0] + tuft[2]) * 0.5 * a.scale,
          side * (tuft[1] + tuft[3]) * 0.5 * a.scale,
          tuft[2] * a.scale,
          side * tuft[3] * a.scale,
        );
        ctx.stroke();
      });
    });
    ctx.globalAlpha = 1;
  }

  function traceSoftFurPatch(context, a, length, halfWidth) {
    const rear = -length * 0.52 * a.scale;
    const front = length * 0.48 * a.scale;
    const half = halfWidth * a.scale;
    context.beginPath();
    context.moveTo(rear, -half * 0.3);
    context.bezierCurveTo(rear * 0.72, -half, front * 0.28, -half * 1.08, front, -half * 0.34);
    context.bezierCurveTo(front * 1.05, half * 0.18, front * 0.42, half * 0.88, rear * 0.12, half);
    context.bezierCurveTo(rear * 0.72, half * 0.88, rear * 1.08, half * 0.28, rear, -half * 0.3);
    context.closePath();
  }

  function drawRestPoseDetails(c, a) {
    const loaf = poseChannelWeight('loaf', 'details');
    const lie = poseChannelWeight('sideLie', 'details');
    const roll = poseChannelWeight('roll', 'details');
    const curl = poseChannelWeight('curl', 'details');
    const side = restPoseSide();

    if (loaf > 0.001) {
      // 两枚低对比前爪尖从胸口下露出一点，身体仍覆盖脚踝，读作“香箱”而不是四根短腿。
      ctx.fillStyle = c.cream;
      ctx.globalAlpha = 0.34 * loaf;
      drawNodeEllipse(cat.rig.shoulders, 12, -5.2, 7.2, 3.2, -0.08, a);
      drawNodeEllipse(cat.rig.shoulders, 12, 5.2, 7.2, 3.2, 0.08, a);
    }

    if (lie > 0.001) {
      ctx.save();
      const flank = pointFromNode(cat.rig.waist, -2 * a.scale, -side * 11 * a.scale);
      ctx.translate(flank.x, flank.y);
      ctx.rotate(cat.rig.waist.angle + side * 0.1);
      ctx.fillStyle = c.furLight;
      ctx.globalAlpha = 0.34 * lie;
      traceSoftFurPatch(ctx, a, 42, 9.5);
      ctx.fill();
      ctx.restore();
    }

    if (roll > 0.001) {
      // 打滚时露出的腹毛是一块不规则软斑，不使用规则椭圆；四只抬起的爪由 over-limb 图层覆盖其上。
      ctx.save();
      ctx.translate(cat.rig.waist.x, cat.rig.waist.y);
      ctx.rotate(cat.rig.waist.angle + restRollWave() * 0.06);
      ctx.fillStyle = c.cream;
      ctx.globalAlpha = 0.64 * roll;
      traceSoftFurPatch(ctx, a, 55, 16);
      ctx.fill();
      ctx.fillStyle = c.furLight;
      ctx.globalAlpha = 0.32 * roll;
      traceSoftFurPatch(ctx, a, 31, 8.5);
      ctx.fill();
      ctx.restore();
    }

    if (curl > 0.001) {
      // 内侧浅毛沿弯曲的脊柱形成月牙，强化头朝腹侧收拢的“蜷卧”读法。
      const pelvis = pointFromNode(cat.rig.pelvis, 4 * a.scale, side * 13 * a.scale);
      const waist = pointFromNode(cat.rig.waist, 2 * a.scale, side * 10 * a.scale);
      const shoulder = pointFromNode(cat.rig.shoulders, -2 * a.scale, side * 9 * a.scale);
      ctx.strokeStyle = c.cream;
      ctx.globalAlpha = 0.25 * curl;
      ctx.lineWidth = 7 * a.scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pelvis.x, pelvis.y);
      ctx.quadraticCurveTo(waist.x, waist.y, shoulder.x, shoulder.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawBody(c) {
    const a = anatomy();
    const breathVolume = 1 + cat.idle.breath * 0.024;

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
    drawNodeEllipse(cat.rig.pelvis, -1, -3, 29, 12 * breathVolume, -0.06, a);
    drawNodeEllipse(cat.rig.waist, 1, -2, 23, 8.5 * breathVolume, 0.03, a);
    drawNodeEllipse(cat.rig.shoulders, 0, -3, 28, 11 * breathVolume, 0.08, a);
    ctx.filter = 'none';

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = c.furLight;
    [
      [cat.rig.pelvis, -6, -15, 17, 8, -0.18],
      [cat.rig.pelvis, 4, 14, 15, 7, 0.16],
      [cat.rig.shoulders, 1, -15, 18, 7.5, 0.17],
      [cat.rig.shoulders, -3, 14, 16, 7, -0.15],
    ].forEach((shape) => drawNodeEllipse(shape[0], shape[1], shape[2], shape[3], shape[4], shape[5], a));

    // 肩胛骨：摆动侧前肢的肩胛随 foot.lift 交替隆起（俯视潜行的招牌律动；静止时 lift=0 自然安静）
    ctx.globalAlpha = 0.18;
    drawNodeEllipse(cat.rig.shoulders, 2, -8, 8 + (cat.feet.leftFore ? cat.feet.leftFore.lift : 0) * 2.5, 5.5, -0.1, a);
    drawNodeEllipse(cat.rig.shoulders, 2, 8, 8 + (cat.feet.rightFore ? cat.feet.rightFore.lift : 0) * 2.5, 5.5, 0.1, a);

    // 奶油胸楔（颈下浅色——虎斑常见的浅胸口，从上方看是颈前一小片）
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c.cream;
    drawNodeEllipse(cat.rig.neck, 2, 0, 9, 6, 0, a);

    drawDorsalStripe(c, contours, a);

    // Mackerel 肋纹：全部一致后弯（drift 同号）、内端拉近脊柱 → 读作从脊背向两侧放射的虎斑肋条，
    // 不再是随机短划（悦耳……悦目 pass：设计评审确认这是"薯感"主因之一）。
    ctx.strokeStyle = c.stripe;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2.8 * a.scale;
    ctx.lineCap = 'round';
    [
      [cat.rig.pelvis, { x: -13, side: -1, edge: 28, inner: 8, drift: 7 }],
      [cat.rig.pelvis, { x: 5, side: -1, edge: 30, inner: 9, drift: 6 }],
      [cat.rig.pelvis, { x: -4, side: 1, edge: 30, inner: 9, drift: 7 }],
      [cat.rig.pelvis, { x: 13, side: 1, edge: 26, inner: 8, drift: 5 }],
      [cat.rig.waist, { x: -3, side: -1, edge: 20, inner: 7, drift: 6 }],
      [cat.rig.waist, { x: 6, side: 1, edge: 20, inner: 7, drift: 5 }],
      [cat.rig.shoulders, { x: -7, side: -1, edge: 26, inner: 9, drift: 6 }],
      [cat.rig.shoulders, { x: 8, side: -1, edge: 24, inner: 8, drift: 5 }],
      [cat.rig.shoulders, { x: -1, side: 1, edge: 27, inner: 9, drift: 6 }],
      [cat.rig.shoulders, { x: 12, side: 1, edge: 22, inner: 8, drift: 4 }],
    ].forEach(([node, stripe]) => drawFlankStripe(node, stripe, a));

    drawRestPoseDetails(c, a);

    ctx.restore();

    drawHead(c, a);
  }

  function drawTopDownFace(c, a) {
    // 俯视仍能看到眉弓、窄眼裂与口鼻楔面。细节沿头骨曲率铺开，避免把正面表情贴成一张面具。
    ctx.strokeStyle = c.stripe;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.75 * a.scale;
    ctx.globalAlpha = 0.66;
    ctx.beginPath();
    ctx.moveTo(-1.5 * a.scale, 0);
    ctx.bezierCurveTo(2.5 * a.scale, -0.4 * a.scale, 6.5 * a.scale, -0.25 * a.scale, 10.5 * a.scale, 0);
    ctx.moveTo(1.2 * a.scale, -7.5 * a.scale);
    ctx.bezierCurveTo(5 * a.scale, -6.9 * a.scale, 7.5 * a.scale, -4.1 * a.scale, 10.6 * a.scale, -2.5 * a.scale);
    ctx.moveTo(1.2 * a.scale, 7.5 * a.scale);
    ctx.bezierCurveTo(5 * a.scale, 6.9 * a.scale, 7.5 * a.scale, 4.1 * a.scale, 10.6 * a.scale, 2.5 * a.scale);
    ctx.stroke();

    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(7.5 * a.scale, side * 12.1 * a.scale);
      ctx.bezierCurveTo(
        11 * a.scale,
        side * 11.6 * a.scale,
        14.4 * a.scale,
        side * 10.5 * a.scale,
        17.6 * a.scale,
        side * 9.35 * a.scale,
      );
      ctx.stroke();
    });

    drawEye(c, a, -1);
    drawEye(c, a, 1);
    drawMuzzleFeatures(c, a);
    ctx.globalAlpha = 1;
  }

  function drawHead(c, a) {
    ctx.save();
    ctx.translate(cat.rig.head.x, cat.rig.head.y);
    ctx.rotate(cat.rig.head.angle);

    ctx.fillStyle = c.fur;
    traceHeadSilhouette(ctx, a);
    ctx.fill();
    drawHeadPlanes(c, a);
    paintEarBacks(c, a);

    ctx.strokeStyle = c.furDark;
    ctx.globalAlpha = 0.52;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.85 * a.scale;
    traceHeadCrown(ctx, a);
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawTopDownFace(c, a);
    drawFacialFur(c, a);
    drawWhiskers(c, a);
    ctx.restore();
  }

  // 老鼠是否被猫的身体遮住：身体/头部（含耳冠）用 isPointInPath 精确测（路径在变换后空间构建，
  // 而测试点参数不受当前变换影响 → 需乘 dpr）；尾巴按逐节半径距离测；爪按圆域测。
  function mouseHiddenUnderCat(mouse) {
    const a = anatomy();
    const px = mouse.x * viewport.dpr;
    const py = mouse.y * viewport.dpr;
    traceBodySilhouette(ctx, a, 0, 0);
    let hidden = ctx.isPointInPath(px, py);
    if (!hidden) {
      ctx.save();
      ctx.translate(cat.rig.head.x, cat.rig.head.y);
      ctx.rotate(cat.rig.head.angle);
      traceHeadSilhouette(ctx, a);
      hidden = ctx.isPointInPath(px, py);
      ctx.restore();
    }
    if (!hidden) {
      const renderTail = tailRenderPoints(a);
      const lastIndex = Math.max(1, renderTail.length - 1);
      for (let index = 0; index < renderTail.length; index += 1) {
        const t = index / lastIndex;
        const radius = (
          (SKIN_TOPOLOGY.tailRootRadius - SKIN_TOPOLOGY.tailTipRadius) * Math.pow(1 - t, 0.5)
          + SKIN_TOPOLOGY.tailTipRadius
        ) * a.scale + 2;
        const dx = mouse.x - renderTail[index].x;
        const dy = mouse.y - renderTail[index].y;
        if (dx * dx + dy * dy < radius * radius) { hidden = true; break; }
      }
    }
    if (!hidden) {
      for (const limb of Gait.LIMBS) {
        const foot = renderedFoot(limb, a);
        if (!foot) continue;
        const dx = mouse.x - foot.x;
        const dy = mouse.y - foot.y;
        if (dx * dx + dy * dy < (11 * a.scale) * (11 * a.scale)) { hidden = true; break; }
      }
    }
    ctx.beginPath();
    return hidden;
  }

  function drawMouse(c) {
    if (!prey.active) return;
    const mouse = renderedMousePosition();
    const scale = Gait.clamp(Math.min(viewport.width, viewport.height) / 800, 0.78, 1.05);
    const speedStretch = Gait.clamp(prey.speed / 700, 0, 0.14);
    const hidden = mouseHiddenUnderCat(mouse);
    if (hidden) {
      // 被猫身遮住：改画轮廓线稿（"在猫身下"的正确读法），不再实心叠在猫背上
      ctx.save();
      ctx.translate(mouse.x, mouse.y);
      ctx.rotate(prey.angle);
      ctx.strokeStyle = c.mouse;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.6 * scale;
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
      ctx.beginPath();
      ctx.ellipse(-7 * scale, 0, 17 * scale, 10 * scale, 0, 0, Gait.TAU);
      ctx.stroke();
      [-6, 6].forEach((side) => {
        ctx.beginPath();
        ctx.arc(-1 * scale, side * scale, 4.5 * scale, 0, Gait.TAU);
        ctx.stroke();
      });
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
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
      ctx.arc(mouse.x, mouse.y, 18 + arrivalAge * 27, 0, Gait.TAU);
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
    drawLegs(c, 'under');
    drawTail(c);   // 尾巴悬空于地面之上 → 压在贴地的爪子上方（图层序修正）
    drawBody(c);
    drawLegs(c, 'over');   // 侧躺的上侧腿与打滚时抬起的四爪必须覆盖躯干，才能读出体位层次
    drawMouse(c);
  }

  function refreshDynamicUi() {
    if (stateLabel) stateLabel.textContent = paused ? I18n.t('paused') : I18n.t(stateKey(cat.state));
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
  }

  function setPaused(next) {
    paused = Boolean(next);
    document.body.classList.toggle('paused', paused);
    lastFrame = performance.now();
    refreshDynamicUi();
    draw();
    if (!paused && !rafId) rafId = requestAnimationFrame(frame);
  }

  function previewIdlePose(mode, side) {
    if (REST_POSES.indexOf(mode) < 0 && mode !== 'groom' && mode !== 'stretch') throw new Error(`Unknown rest pose: ${mode}`);
    releasePrey();
    const I = cat.idle;
    I.mode = mode;
    I.captured = false;
    I.side = Number(side) < 0 ? -1 : 1;
    I.t = 0;
    I.dur = 3600;
    I.restSince = null;
    beginPoseTransition(mode);
    cat.speed = 0;
    cat.steerOmega = 0;
    cat.wanderGoal.x = cat.x;
    cat.wanderGoal.y = cat.y;
    setBehavior(mode);
    if (paused) draw();
  }

  function clearIdlePose() {
    if (cat.idle.mode) endIdle(true);   // 预览 API 必须确定性退出（interrupted → 不走 35% 姿态链）
    if (paused) draw();
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
      ears: Object.assign({}, cat.ears),
      earPerk: Object.assign({}, cat.earPerk),
      earGeometry: Object.assign({}, EAR_GEOMETRY),
      pounceGeometry: Object.assign({}, POUNCE_GEOMETRY),
      earLandmarks: {
        left: earLandmarks(-1),
        right: earLandmarks(1),
      },
      skin: Object.assign(skinTopologySnapshot(), { narrow: cat.skinNarrow }),
      poseEnvelope: poseEnvelopeSnapshot(),
      support: Object.assign({}, cat.support),
      touchdowns: cat.touchdowns.map((touchdown) => Object.assign({}, touchdown)),
      mouse: {
        x: prey.x,
        y: prey.y,
        speed: prey.speed,
        active: prey.active,
        rendered: renderedMousePosition(),
      },
      capture: {
        active: cat.capture.active,
        since: cat.capture.since,
        restAt: cat.capture.restAt,
        pointerX: cat.capture.pointerX,
        pointerY: cat.capture.pointerY,
      },
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
      renderFeet: Object.fromEntries(Gait.LIMBS.map((limb) => {
        const foot = renderedFoot(limb, anatomy());
        return [limb, foot
          ? {
              x: foot.x,
              y: foot.y,
              angle: foot.angle,
              lift: foot.lift,
              planted: foot.planted,
              reach: legReach(limb, foot).distance,
              reachLimit: legReachLimit(limb, anatomy()),
              layer: restLimbLayer(limb),
            }
          : null];
      })),
      tailPoints: tailRenderPoints(anatomy()).map((point) => ({ x: point.x, y: point.y })),
      tailTip: cat.tail.length
        ? { x: cat.tail[cat.tail.length - 1].x, y: cat.tail[cat.tail.length - 1].y }
        : null,
      leapPhase: cat.leap.phase,
      idleMode: cat.idle.mode,
      idlePose: {
        visualMode: cat.idle.visualMode,
        blend: cat.idle.poseBlend,
        weights: Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, poseChannelWeight(mode, 'body')])),
        spineWeights: Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, poseChannelWeight(mode, 'spine')])),
        pawWeights: Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, poseChannelWeight(mode, 'paws')])),
        tailWeights: Object.fromEntries(POSE_BLEND_MODES.map((mode) => [mode, poseChannelWeight(mode, 'tail')])),
        side: restPoseSide(),
        rollWave: restRollWave(),
        stretch: cat.poseStretch,
        captured: cat.idle.captured,
        poseClock: cat.idle.poseClock,
        sleepDepth: cat.idle.sleepDepth,
        breath: cat.idle.breath,
        transitionSway: poseTransitionSway(),
        transition: {
          active: cat.idle.transition.active,
          to: cat.idle.transition.to,
          progress: cat.idle.transition.progress,
          duration: cat.idle.transition.dur,
        },
        twitch: {
          active: cat.idle.twitchActive,
          value: cat.idle.twitch,
          side: cat.idle.twitchSide,
          kind: cat.idle.twitchKind,
          count: cat.idle.twitchCount,
        },
      },
      face: {
        leftEyeOpen: eyeOpenness(-1),
        rightEyeOpen: eyeOpenness(1),
      },
      paused,
      reducedMotion,
      viewport: Object.assign({}, viewport),
    }),
    moveMouse: (x, y) => setPreyPosition(Number(x), Number(y), performance.now(), 'test'),
    releaseMouse: releasePrey,
    previewIdlePose,
    clearIdlePose,
    setPaused,
    setTheme: (mode) => applyTheme(mode === 'dark', true),
    setLanguage: I18n.setLanguage,
  });
})();
