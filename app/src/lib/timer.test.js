import { describe, it, expect } from "vitest";
import {
  makeTimer, timerTick, timerStart, timerPause, timerResume, timerReset, timerExtend, isOverTime, fmtClock
} from "./timer.js";

const T0 = 1_000_000;

describe("timer state machine", () => {
  it("starts idle at the full duration", () => {
    const t = makeTimer(300, { warningAt: 30 });
    expect(t.duration).toBe(300);
    expect(t.remaining).toBe(300);
    expect(t.state).toBe("idle");
    expect(t.running).toBe(false);
  });

  it("ticks while running and does not go negative", () => {
    let t = makeTimer(10);
    t = timerStart(t, T0);
    t = timerTick(t, T0 + 3000);
    expect(t.remaining).toBeCloseTo(7, 5);
    expect(t.elapsed).toBeCloseTo(3, 5);
    t = timerTick(t, T0 + 15000);
    expect(t.remaining).toBe(0);
    expect(t.state).toBe("finished");
  });

  it("does not tick when paused or idle", () => {
    const idle = timerTick(makeTimer(10), T0 + 5000);
    expect(idle.elapsed).toBe(0);
    let t = timerStart(makeTimer(10), T0);
    t = timerPause(t, T0 + 2000);
    const frozen = timerTick(t, T0 + 6000);
    expect(frozen.remaining).toBeCloseTo(8, 5);
  });

  it("pause then resume keeps accumulated time", () => {
    let t = timerStart(makeTimer(60), T0);
    t = timerPause(t, T0 + 10_000);
    expect(t.state).toBe("paused");
    t = timerResume(t, T0 + 20_000);
    expect(t.running).toBe(true);
    t = timerTick(t, T0 + 25_000);
    expect(t.remaining).toBeCloseTo(45, 5); // 10s before pause + 5s after resume
  });

  it("reset restores the full duration", () => {
    let t = timerStart(makeTimer(60), T0);
    t = timerTick(t, T0 + 30_000);
    t = timerReset(t);
    expect(t.remaining).toBe(60);
    expect(t.elapsed).toBe(0);
    expect(t.state).toBe("idle");
    expect(t.warned).toBe(false);
  });

  it("extend adds seconds (authorized grace)", () => {
    let t = timerStart(makeTimer(60), T0);
    t = timerTick(t, T0 + 70_000); // over by 10s
    expect(isOverTime(t)).toBe(true);
    t = timerExtend(t, 30);
    expect(t.duration).toBe(90);
    expect(t.remaining).toBeCloseTo(20, 5);
  });

  it("flags the warning threshold once", () => {
    let t = makeTimer(60, { warningAt: 15 });
    t = timerStart(t, T0);
    t = timerTick(t, T0 + 40_000); // 20s left — no warning yet
    expect(t.warned).toBe(false);
    t = timerTick(t, T0 + 46_000); // 14s left
    expect(t.warned).toBe(true);
  });

  it("formats clock display", () => {
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(65)).toBe("1:05");
    expect(fmtClock(600)).toBe("10:00");
  });
});
