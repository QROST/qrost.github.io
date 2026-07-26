#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceURL = new URL('../audio.js', import.meta.url);
const source = await readFile(sourceURL, 'utf8');
const moduleURL = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { Sonifier } = await import(moduleURL);

const state = {
  dt: 0.016,
  pitch: 0,
  fov: 56,
  pulse: 0,
  gOrg: 0.5,
  yaw: 0,
  view: null,
  focus: null,
};

function makeEngine({ now, nextTime, bpm = 80 }) {
  const parameter = { setTargetAtTime() {} };
  const scheduled = [];
  const engine = new Sonifier();

  engine.started = true;
  engine.muted = false;
  engine.ctx = { currentTime: now };
  engine.nextTime = nextTime;
  engine.lookahead = 0.14;
  engine.bpm = bpm;
  engine._awake = true;
  engine._wakeAmt = 1;
  engine._clHue = null;
  engine._clEnergy = 0;
  engine.masterLP = { frequency: parameter };
  engine.revSend = { gain: parameter };
  engine.master = { gain: parameter };
  engine.ambGain = { gain: parameter };
  engine._focus = () => {};
  engine._scheduleStep = (time) => scheduled.push(time);
  engine._onBar = () => {};

  return { engine, scheduled };
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 1 });
  engine.update(state);
  assert.ok(scheduled.length > 0, 'stale recovery should queue the next audible step');
  assert.ok(scheduled.length <= 2, `stale scheduler burst: queued ${scheduled.length} steps`);
  assert.ok(scheduled.every((time) => time >= 100), `scheduled a past step at ${scheduled[0]}`);
}

{
  const { engine, scheduled } = makeEngine({ now: 0, nextTime: 0.12 });
  engine.setMuted(true);
  engine.ctx.currentTime = 600;
  engine.update(state);
  assert.equal(scheduled.length, 0, 'muted scheduler should not queue notes');

  engine.setMuted(false);
  engine.update(state);
  assert.ok(scheduled.length > 0 && scheduled.length <= 2, `unmute burst: queued ${scheduled.length} steps`);
  assert.ok(scheduled.every((time) => time >= 600), `unmute scheduled a past step at ${scheduled[0]}`);
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 100.05 });
  engine.update(state);
  assert.deepEqual(scheduled, [100.05], 'normal future lookahead should keep its musical grid time');
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 99.95 });
  engine.update(state);
  assert.equal(scheduled[0], 99.95, 'ordinary 50ms RAF lateness should preserve the musical grid');
  assert.ok(scheduled.length <= 2, `minor lateness burst: queued ${scheduled.length} steps`);
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 99.9 });
  engine.update(state);
  assert.ok(scheduled.length > 0 && scheduled.length <= 2, 'larger lateness should recover without a burst');
  assert.ok(scheduled.every((time) => time >= 100), `larger lateness scheduled a past step at ${scheduled[0]}`);
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 1000 });
  engine.update(state);
  assert.ok(scheduled.length > 0 && scheduled.length <= 2, 'far-future scheduler corruption should not cause long silence');
  assert.ok(scheduled.every((time) => time >= 100 && time < 101), `far-future recovery produced ${scheduled[0]}`);
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: 100.13, bpm: 68 });
  engine.step = 15;
  engine._onBar = () => { engine.bpm = 89; };
  engine.update(state);
  assert.deepEqual(scheduled, [100.13], 'slow-BPM grid should schedule once before the boundary tempo change');
  const retainedNextTime = engine.nextTime;

  engine.ctx.currentTime = 100.016;
  engine.update(state);
  assert.deepEqual(scheduled, [100.13], 'tempo change must not insert an event before an already-scheduled note');
  assert.equal(engine.nextTime, retainedNextTime, 'legal future grid should survive a slow-to-fast boundary tempo change');
}

{
  const { engine, scheduled } = makeEngine({ now: 100, nextTime: Number.NaN });
  engine.update(state);
  assert.ok(scheduled.length > 0 && scheduled.length <= 2, 'non-finite scheduler state should recover');
  assert.ok(scheduled.every((time) => Number.isFinite(time) && time >= 100), 'recovery must only queue finite future steps');
}

console.log('PASS: scheduler preserves small jitter and recovers stale, muted, invalid, and far-future clocks');
