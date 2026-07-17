/*
 * Cat & Mouse — coupled feline gait controller.
 *
 * One master clock drives four phase-shifted limb controllers. Slow movement
 * uses a lateral-sequence four-beat walk (RH → RF → LH → LF); a fast pursuit
 * blends into a diagonal trot. The pure functions in this file are shared by
 * the browser animation and the Node verification gate.
 */
(function attachCatGait(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CatGait = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCatGait() {
  'use strict';

  const TAU = Math.PI * 2;
  const LIMBS = Object.freeze(['rightHind', 'rightFore', 'leftHind', 'leftFore']);

  const PROFILES = Object.freeze({
    still: Object.freeze({
      name: 'still',
      dutyFactor: 0.72,
      cadenceBase: 0,
      cadenceGain: 0,
      liftScale: 0,
      lateralArc: 0,
      offsets: Object.freeze({ rightHind: 0, rightFore: 0.25, leftHind: 0.5, leftFore: 0.75 }),
    }),
    prowl: Object.freeze({
      name: 'prowl',
      dutyFactor: 0.65,
      cadenceBase: 0.58,
      cadenceGain: 0.0062,
      liftScale: 0.72,
      lateralArc: 0.035,
      offsets: Object.freeze({ rightHind: 0, rightFore: 0.23, leftHind: 0.5, leftFore: 0.73 }),
    }),
    stalk: Object.freeze({
      name: 'stalk',
      dutyFactor: 0.75,
      cadenceBase: 0.52,
      cadenceGain: 0.005,
      liftScale: 0.48,
      lateralArc: 0.024,
      offsets: Object.freeze({ rightHind: 0, rightFore: 0.25, leftHind: 0.5, leftFore: 0.75 }),
    }),
    chase: Object.freeze({
      name: 'chase',
      dutyFactor: 0.5,
      cadenceBase: 1.28,
      cadenceGain: 0.0065,
      liftScale: 1,
      lateralArc: 0.045,
      offsets: Object.freeze({ rightHind: 0, rightFore: 0.5, leftHind: 0.5, leftFore: 0 }),
    }),
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fract(value) {
    return ((value % 1) + 1) % 1;
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function shortestPhaseDelta(from, to) {
    let delta = fract(to) - fract(from);
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;
    return delta;
  }

  function angleDelta(from, to) {
    let delta = (to - from) % TAU;
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    return delta;
  }

  function profileForBehavior(behavior) {
    if (behavior === 'chase') return 'chase';
    if (behavior === 'stalk') return 'stalk';
    if (behavior === 'prowl') return 'prowl';
    return 'still';
  }

  function createController(initialBehavior) {
    const profileName = profileForBehavior(initialBehavior || 'prowl');
    const profile = PROFILES[profileName];
    const legPhases = {};
    const dutyFactors = {};
    LIMBS.forEach((limb) => {
      legPhases[limb] = fract(-profile.offsets[limb]);
      dutyFactors[limb] = profile.dutyFactor;
    });
    return {
      masterPhase: 0,
      cadence: 0,
      profileName,
      dutyFactor: profile.dutyFactor,
      liftScale: profile.liftScale,
      lateralArc: profile.lateralArc,
      offsets: Object.assign({}, profile.offsets),
      legPhases,
      dutyFactors,
      cycle: 0,
    };
  }

  function updateController(controller, options) {
    const dt = clamp(Number(options.dt) || 0, 0, 0.1);
    const speed = Math.max(0, Number(options.speed) || 0);
    const reducedMotion = Boolean(options.reducedMotion);
    const desiredName = profileForBehavior(options.behavior);
    const desired = PROFILES[desiredName];
    const transition = 1 - Math.exp(-dt * 7.5);

    controller.profileName = desiredName;
    controller.liftScale += (desired.liftScale - controller.liftScale) * transition;
    controller.lateralArc += (desired.lateralArc - controller.lateralArc) * transition;

    let targetCadence = desired.cadenceBase + speed * desired.cadenceGain;
    if (speed < 3 || desiredName === 'still') targetCadence = 0;
    if (reducedMotion) targetCadence = Math.min(targetCadence, 1.15);
    targetCadence = clamp(targetCadence, 0, 3.1);
    controller.cadence += (targetCadence - controller.cadence) * (1 - Math.exp(-dt * 5.5));

    const previous = controller.masterPhase;
    const baseAdvance = controller.cadence * dt;
    controller.masterPhase = fract(controller.masterPhase + baseAdvance);
    if (controller.cadence > 0 && controller.masterPhase < previous) controller.cycle += 1;

    // Coupled phase oscillators: each limb converges toward the target gait by
    // speeding up or slowing down, never by running its local phase backward.
    // Per-limb duty factors change only at touchdown, so a profile transition
    // cannot manufacture a contact/liftoff event halfway through a step.
    LIMBS.forEach((limb) => {
      const currentPhase = controller.legPhases[limb];
      const targetPhase = fract(controller.masterPhase - desired.offsets[limb]);
      const phaseError = shortestPhaseDelta(currentPhase, targetPhase);
      const rawCorrection = phaseError * (1 - Math.exp(-dt * 4.2));
      const correction = clamp(rawCorrection, -baseAdvance * 0.72, baseAdvance * 1.15);
      const advance = Math.max(0, baseAdvance + correction);
      const nextPhase = fract(currentPhase + advance);
      const touchedDown = advance > 0 && nextPhase < currentPhase;
      controller.legPhases[limb] = nextPhase;
      if (touchedDown) controller.dutyFactors[limb] = desired.dutyFactor;
      controller.offsets[limb] = fract(controller.masterPhase - nextPhase);
    });
    controller.dutyFactor = LIMBS.reduce((sum, limb) => sum + controller.dutyFactors[limb], 0) / LIMBS.length;
    return controller;
  }

  function sampleLimb(controller, limb, strideLength) {
    if (!LIMBS.includes(limb)) throw new Error(`Unknown limb: ${limb}`);
    const duty = clamp(controller.dutyFactors ? controller.dutyFactors[limb] : controller.dutyFactor, 0.35, 0.82);
    const stride = Math.max(0, Number(strideLength) || 0);
    const phase = controller.legPhases
      ? fract(controller.legPhases[limb])
      : fract(controller.masterPhase - controller.offsets[limb]);
    const planted = phase < duty;
    let longitudinal;
    let lift = 0;
    let lateral = 0;
    let swingProgress = 0;

    if (planted) {
      const u = phase / duty;
      longitudinal = stride * (0.5 - u);
    } else {
      swingProgress = (phase - duty) / Math.max(0.001, 1 - duty);
      const eased = smoothstep(swingProgress);
      longitudinal = stride * (-0.5 + eased);
      lift = Math.sin(Math.PI * swingProgress) * controller.liftScale;
      lateral = Math.sin(Math.PI * swingProgress) * controller.lateralArc * stride;
    }

    return { phase, planted, longitudinal, lift, lateral, swingProgress };
  }

  function chooseBehavior(input) {
    if (!input.targetActive) return 'prowl';
    if (input.justAppeared) return 'observe';

    const current = input.current || 'observe';
    const age = Math.max(0, Number(input.stateAge) || 0);
    const distance = Math.max(0, Number(input.distance) || 0);
    const targetSpeed = Math.max(0, Number(input.targetSpeed) || 0);
    const reducedMotion = Boolean(input.reducedMotion);

    if (current === 'observe' && age < 0.72) return 'observe';
    if (distance < 92 && targetSpeed < 72) return 'watch';
    if (reducedMotion) return 'stalk';

    const enterChase = targetSpeed > 145 && distance > 45;
    const keepChasing = current === 'chase' && targetSpeed > 82 && distance > 42;
    if (enterChase || keepChasing) return 'chase';
    return 'stalk';
  }

  function targetSpeedForBehavior(behavior, distance, targetSpeed, reducedMotion) {
    const dist = Math.max(0, Number(distance) || 0);
    const preySpeed = Math.max(0, Number(targetSpeed) || 0);
    let speed = 0;

    if (behavior === 'prowl') speed = 24;
    if (behavior === 'stalk') speed = clamp(dist * 0.19, 26, 62);
    if (behavior === 'chase') speed = clamp(112 + dist * 0.22 + preySpeed * 0.18, 118, 248);
    if (reducedMotion) speed = Math.min(speed, 54);
    return speed;
  }

  return Object.freeze({
    TAU,
    LIMBS,
    PROFILES,
    clamp,
    fract,
    smoothstep,
    angleDelta,
    profileForBehavior,
    createController,
    updateController,
    sampleLimb,
    chooseBehavior,
    targetSpeedForBehavior,
  });
});
