import { createPinchZoom } from '../src/camera/pinchZoom';
import { MAX_FOV_DEG, MIN_FOV_DEG, useCameraStore } from '../src/store/useCameraStore';

/** A pinch wired to the real camera store, exactly as the gesture hook wires it. */
function rig() {
  useCameraStore.setState({ fov: 45 });
  const orphans = jest.fn();
  const pinch = createPinchZoom({ min: MIN_FOV_DEG, max: MAX_FOV_DEG, readFov: () => useCameraStore.getState().fov, onOrphan: orphans });
  const feed = (scale: number) => {
    const fov = pinch.update(scale);
    if (fov !== null) useCameraStore.getState().setFov(fov);
    return useCameraStore.getState().fov;
  };
  return { pinch, feed, orphans, fov: () => useCameraStore.getState().fov };
}

describe('pinch zoom', () => {
  it('scales smoothly from the live field of view', () => {
    const { pinch, feed } = rig();
    useCameraStore.setState({ fov: 30 });
    pinch.start();
    expect(feed(1)).toBe(30); // first update changes nothing
    expect(feed(1.5)).toBeCloseTo(20, 6);
    expect(feed(2)).toBeCloseTo(15, 6);
    expect(feed(1)).toBeCloseTo(30, 6); // fingers back where they started: back where we started
  });

  it('does not jump when the recognizer reports a scale offset on the first update', () => {
    const { pinch, feed } = rig();
    pinch.start();
    expect(feed(1.35)).toBe(45); // pre-activation offset is absorbed, not applied
    expect(feed(1.4)).toBeCloseTo(45 / (1.4 / 1.35), 6);
  });

  it('continues from where the last pinch left it, even when pinched again at once', () => {
    const { pinch, feed, fov } = rig();
    pinch.start();
    [1, 1.4, 2, 2.25].forEach(feed);
    pinch.end();
    expect(fov()).toBeCloseTo(20, 6);

    pinch.start();
    expect(feed(1.02)).toBeCloseTo(20, 6); // first frame of the second pinch: unchanged
    expect(feed(1.2)).toBeCloseTo(20 / (1.2 / 1.02), 6);
  });

  it('holds back updates that arrive before their start event, and never snaps to an old baseline', () => {
    const { pinch, feed, fov, orphans } = rig();
    pinch.start();
    [1, 1.4, 2, 2.25].forEach(feed);
    pinch.end(); // camera now at 20

    expect(feed(1.02)).toBeCloseTo(20, 6); // update first...
    expect(orphans).toHaveBeenCalledTimes(1);
    pinch.start(); // ...start second
    expect(feed(1.05)).toBeCloseTo(20, 6);
    expect(feed(1.3)).toBeCloseTo(20 / (1.3 / 1.05), 6);
    expect(fov()).toBeLessThan(20);
  });

  it('recovers when the start event is lost altogether', () => {
    const { feed, fov } = rig();
    useCameraStore.setState({ fov: 25 });
    expect(feed(1.0)).toBe(25);
    expect(feed(1.1)).toBe(25);
    expect(feed(1.2)).toBe(25); // third orphan: adopted as a new pinch, baseline = live fov
    expect(feed(1.8)).toBeCloseTo(25 / (1.8 / 1.2), 6);
    expect(fov()).toBeCloseTo(16.6667, 3);
  });

  it('is not left dead when a late end event from the previous pinch lands after the next start', () => {
    const { pinch, feed, fov } = rig();
    pinch.start();
    [1, 1.5, 2].forEach(feed);
    useCameraStore.setState({ fov: 22.5 });
    pinch.start(); // next pinch starts...
    pinch.end(); // ...and the previous pinch's end arrives late
    [1, 1.1, 1.2, 1.3].forEach(feed); // updates of the new pinch must still work
    expect(fov()).toBeLessThan(22.5);
  });

  it('applies limits by moving the baseline, so reversing at a limit responds at once', () => {
    const { pinch, feed, fov } = rig();
    pinch.start();
    feed(1);
    expect(feed(6)).toBe(MIN_FOV_DEG); // the finger implies 7.5 degrees; the camera stops at the limit
    expect(feed(5.99)).toBeGreaterThan(MIN_FOV_DEG); // a hair back: responds immediately, no dead zone
    expect(feed(4.5)).toBeCloseTo(10 * (6 / 4.5), 6); // and tracks the finger from the limit, not from the overshoot
    expect(fov()).toBeCloseTo(13.3333, 3);

    expect(feed(0.1)).toBe(MAX_FOV_DEG);
    expect(feed(0.11)).toBeLessThan(MAX_FOV_DEG);
  });

  it('ignores nonsense scales', () => {
    const { pinch, feed, fov } = rig();
    pinch.start();
    feed(1);
    for (const bad of [0, -1, NaN, Infinity]) feed(bad);
    expect(fov()).toBe(45);
  });

  it('keeps fov * scale constant between applied updates, however the events are interleaved', () => {
    // fov = startFov * baseScale / scale, so fov * scale is constant through a pinch (limits move the baseline
    // without breaking this). Random scale paths, with and without a start event, and random restarts.
    let seed = 12345;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let appliedSteps = 0;
    for (let run = 0; run < 300; run++) {
      const { pinch } = rig();
      useCameraStore.setState({ fov: 15 + rnd() * 40 });
      if (rnd() < 0.5) pinch.start();
      let scale = 0.9 + rnd() * 0.3;
      let previous: { fov: number; scale: number } | null = null;
      for (let i = 0; i < 60; i++) {
        scale *= 0.98 + rnd() * 0.04;
        if (rnd() < 0.05) { pinch.end(); pinch.start(); previous = null; }
        const applied = pinch.update(scale);
        if (applied !== null) {
          expect(applied).toBeGreaterThanOrEqual(MIN_FOV_DEG);
          expect(applied).toBeLessThanOrEqual(MAX_FOV_DEG);
          useCameraStore.getState().setFov(applied);
          const clampedNow = applied <= MIN_FOV_DEG + 1e-9 || applied >= MAX_FOV_DEG - 1e-9;
          if (previous && !clampedNow) {
            appliedSteps++;
            expect(Math.abs(applied * scale - previous.fov * previous.scale)).toBeLessThan(1e-6);
          }
        }
        previous = { fov: useCameraStore.getState().fov, scale };
      }
    }
    expect(appliedSteps).toBeGreaterThan(5000);
  });
});

describe('camera store setFov', () => {
  it('clamps, and does not notify when nothing changed', () => {
    useCameraStore.setState({ fov: 45 });
    const listener = jest.fn();
    const unsubscribe = useCameraStore.subscribe(listener);
    useCameraStore.getState().setFov(45);
    expect(listener).not.toHaveBeenCalled();
    useCameraStore.getState().setFov(1000);
    expect(useCameraStore.getState().fov).toBe(MAX_FOV_DEG);
    useCameraStore.getState().setFov(-5);
    expect(useCameraStore.getState().fov).toBe(MIN_FOV_DEG);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});