#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const Gait = require(path.join(here, '..', 'assets', 'js', 'gait.js'));

function phaseDistance(a, b) {
  const raw = Math.abs(a - b) % 1;
  return Math.min(raw, 1 - raw);
}

function simulate(rate) {
  const controller = Gait.createController('stalk');
  const dt = 1 / rate;
  for (let index = 0; index < rate * 4; index += 1) {
    Gait.updateController(controller, { dt, speed: 58, behavior: 'stalk', reducedMotion: false });
  }
  return controller;
}

assert.deepEqual(Gait.LIMBS, ['rightHind', 'rightFore', 'leftHind', 'leftFore']);
assert.deepEqual(Gait.PROFILES.stalk.offsets, {
  rightHind: 0,
  rightFore: 0.25,
  leftHind: 0.5,
  leftFore: 0.75,
});
assert.ok(Gait.PROFILES.stalk.dutyFactor >= 0.7 && Gait.PROFILES.stalk.dutyFactor <= 0.78);
assert.ok(Gait.PROFILES.prowl.dutyFactor >= 0.58 && Gait.PROFILES.prowl.dutyFactor <= 0.65);
assert.ok(Gait.PROFILES.prowl.cycleStride >= 76 && Gait.PROFILES.prowl.cycleStride <= 84);
assert.ok(Gait.PROFILES.stalk.cycleStride >= 74 && Gait.PROFILES.stalk.cycleStride <= 84);
assert.ok(Gait.PROFILES.chase.cycleStride >= 100 && Gait.PROFILES.chase.cycleStride <= 116);
assert.equal(Gait.PROFILES.chase.offsets.rightHind, Gait.PROFILES.chase.offsets.leftFore);
assert.equal(Gait.PROFILES.chase.offsets.rightFore, Gait.PROFILES.chase.offsets.leftHind);
assert.equal(phaseDistance(Gait.PROFILES.chase.offsets.rightHind, Gait.PROFILES.chase.offsets.rightFore), 0.5);

const touchdownProbe = Gait.createController('stalk');
touchdownProbe.dutyFactor = Gait.PROFILES.stalk.dutyFactor;
touchdownProbe.offsets = { ...Gait.PROFILES.stalk.offsets };
Gait.LIMBS.forEach((limb) => {
  touchdownProbe.legPhases[limb] = 0;
  const sample = Gait.sampleLimb(touchdownProbe, limb, 40);
  assert.ok(phaseDistance(sample.phase, 0) < 1e-10, `${limb} must touch down at its declared offset`);
  assert.equal(sample.planted, true);
  assert.ok(Math.abs(sample.longitudinal - 20) < 1e-9);
});

touchdownProbe.legPhases.rightHind = Gait.PROFILES.stalk.dutyFactor - 1e-7;
const stanceEnd = Gait.sampleLimb(touchdownProbe, 'rightHind', 40);
touchdownProbe.legPhases.rightHind = Gait.PROFILES.stalk.dutyFactor + 1e-7;
const swingStart = Gait.sampleLimb(touchdownProbe, 'rightHind', 40);
touchdownProbe.legPhases.rightHind = 1 - 1e-7;
const swingEnd = Gait.sampleLimb(touchdownProbe, 'rightHind', 40);
touchdownProbe.legPhases.rightHind = 0;
const nextTouchdown = Gait.sampleLimb(touchdownProbe, 'rightHind', 40);
assert.ok(Math.abs(stanceEnd.longitudinal - swingStart.longitudinal) < 0.001, 'stance → swing must be continuous');
assert.ok(Math.abs(swingEnd.longitudinal - nextTouchdown.longitudinal) < 0.001, 'swing → touchdown must be continuous');

assert.equal(Gait.smootherstep(0), 0);
assert.equal(Gait.smootherstep(1), 1);
assert.ok(Gait.smootherstep(0.25) < Gait.smoothstep(0.25), 'swing must ease gently away from the planted paw');
assert.ok(Gait.smootherstep(0.75) > Gait.smoothstep(0.75), 'swing must ease gently into touchdown');

function settleCadence(behavior, speed, reducedMotion = false) {
  const controller = Gait.createController(behavior);
  for (let index = 0; index < 600; index += 1) {
    Gait.updateController(controller, { dt: 1 / 60, speed, behavior, reducedMotion });
  }
  return controller.cadence;
}

assert.ok(Math.abs(settleCadence('prowl', 24) - 24 / Gait.PROFILES.prowl.cycleStride) < 1e-6);
assert.ok(Math.abs(settleCadence('stalk', 58) - 58 / Gait.PROFILES.stalk.cycleStride) < 1e-6);
assert.ok(Math.abs(settleCadence('chase', 216) - 216 / Gait.PROFILES.chase.cycleStride) < 1e-6);
assert.ok(settleCadence('chase', 248, true) <= 1.15 + 1e-6, 'reduced motion must cap cadence');

const liftProbe = Gait.createController('stalk');
liftProbe.liftScale = Gait.PROFILES.stalk.liftScale;
liftProbe.dutyFactors.rightHind = Gait.PROFILES.stalk.dutyFactor;
const swingSpan = 1 - Gait.PROFILES.stalk.dutyFactor;
liftProbe.legPhases.rightHind = Gait.PROFILES.stalk.dutyFactor + swingSpan * 0.4;
const earlyLift = Gait.sampleLimb(liftProbe, 'rightHind', 40).lift;
liftProbe.legPhases.rightHind = Gait.PROFILES.stalk.dutyFactor + swingSpan * 0.6;
const lateLift = Gait.sampleLimb(liftProbe, 'rightHind', 40).lift;
assert.ok(earlyLift > lateLift, 'careful paw lift must peak before the middle of swing');

assert.equal(Gait.chooseBehavior({ targetActive: false }), 'prowl');
assert.equal(Gait.chooseBehavior({ targetActive: true, justAppeared: true }), 'observe');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'observe', stateAge: 0.4, distance: 300, targetSpeed: 200 }), 'observe');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'stalk', stateAge: 1, distance: 75, targetSpeed: 10 }), 'watch');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'stalk', stateAge: 1, distance: 260, targetSpeed: 22 }), 'stalk');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'stalk', stateAge: 1, distance: 260, targetSpeed: 180 }), 'chase');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'chase', stateAge: 1, distance: 220, targetSpeed: 100 }), 'chase');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'stalk', stateAge: 1, distance: 52, targetSpeed: 180 }), 'chase');
assert.equal(Gait.chooseBehavior({ targetActive: true, current: 'stalk', stateAge: 1, distance: 260, targetSpeed: 180, reducedMotion: true }), 'stalk');

const at30 = simulate(30);
const at60 = simulate(60);
const at120 = simulate(120);
assert.ok(phaseDistance(at30.masterPhase, at60.masterPhase) < 0.025, '30 Hz and 60 Hz should converge');
assert.ok(phaseDistance(at60.masterPhase, at120.masterPhase) < 0.015, '60 Hz and 120 Hz should converge');
for (const limb of Gait.LIMBS) {
  assert.ok(phaseDistance(at30.legPhases[limb], at60.legPhases[limb]) < 0.03, `${limb}: 30/60 Hz phase drift`);
  assert.ok(phaseDistance(at60.legPhases[limb], at120.legPhases[limb]) < 0.018, `${limb}: 60/120 Hz phase drift`);
}

const transitionProbe = Gait.createController('prowl');
for (let index = 0; index < 120; index += 1) {
  Gait.updateController(transitionProbe, { dt: 1 / 60, speed: 48, behavior: 'prowl', reducedMotion: false });
}
const previousPhase = Object.fromEntries(Gait.LIMBS.map((limb) => [limb, transitionProbe.legPhases[limb]]));
const previousDuty = Object.fromEntries(Gait.LIMBS.map((limb) => [limb, transitionProbe.dutyFactors[limb]]));
const previousContact = Object.fromEntries(Gait.LIMBS.map((limb) => [limb, Gait.sampleLimb(transitionProbe, limb, 40).planted]));
for (let index = 0; index < 360; index += 1) {
  Gait.updateController(transitionProbe, { dt: 1 / 60, speed: 220, behavior: 'chase', reducedMotion: false });
  for (const limb of Gait.LIMBS) {
    const phase = transitionProbe.legPhases[limb];
    const forwardAdvance = Gait.fract(phase - previousPhase[limb]);
    assert.ok(forwardAdvance < 0.12, `${limb} phase ran backward during gait transition`);
    const contact = Gait.sampleLimb(transitionProbe, limb, 40).planted;
    if (previousContact[limb] && !contact) {
      assert.ok(phase >= transitionProbe.dutyFactors[limb], `${limb} lifted without crossing stance boundary`);
    }
    if (!previousContact[limb] && contact) {
      assert.ok(phase < previousPhase[limb], `${limb} planted without a phase wrap`);
    }
    if (transitionProbe.dutyFactors[limb] !== previousDuty[limb]) {
      assert.ok(phase < previousPhase[limb], `${limb} duty factor changed away from touchdown`);
    }
    previousPhase[limb] = phase;
    previousDuty[limb] = transitionProbe.dutyFactors[limb];
    previousContact[limb] = contact;
  }
}
assert.ok(phaseDistance(transitionProbe.legPhases.rightHind, transitionProbe.legPhases.leftFore) < 0.035);
assert.ok(phaseDistance(transitionProbe.legPhases.rightFore, transitionProbe.legPhases.leftHind) < 0.035);
assert.ok(Math.abs(phaseDistance(transitionProbe.legPhases.rightHind, transitionProbe.legPhases.rightFore) - 0.5) < 0.035);

for (const behavior of ['prowl', 'observe', 'watch', 'stalk', 'chase']) {
  const controller = Gait.createController(behavior);
  for (let index = 0; index < 720; index += 1) {
    const speed = behavior === 'chase' ? 230 : behavior === 'stalk' ? 55 : 24;
    Gait.updateController(controller, { dt: 1 / 120, speed, behavior, reducedMotion: false });
    for (const limb of Gait.LIMBS) {
      const sample = Gait.sampleLimb(controller, limb, 44);
      Object.values(sample).forEach((value) => {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `${behavior}/${limb} emitted a non-finite value`);
      });
      assert.ok(sample.phase >= 0 && sample.phase < 1);
      assert.ok(sample.lift >= 0 && sample.lift <= 1.001);
    }
  }
}

assert.ok(Gait.targetSpeedForBehavior('stalk', 400, 0, false) <= 62);
assert.ok(Gait.targetSpeedForBehavior('chase', 900, 900, false) <= 248);
assert.ok(Gait.targetSpeedForBehavior('chase', 900, 900, true) <= 54);

console.log('check-gait: distance cadence, early paw lift, 4-phase walk, trot transition, continuity, and rate invariance OK');
