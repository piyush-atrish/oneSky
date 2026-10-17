import { Colors } from '../src/theme/colors';
import {
  GROUND_FRAGMENT_SHADER, GROUND_STYLE, GROUND_VERTEX_SHADER, createGroundUniforms, hexToRgb,
} from '../src/render/groundGrid';

const constant = (name: string) => Number(new RegExp(`const float ${name} = ([0-9.]+);`).exec(GROUND_FRAGMENT_SHADER)![1]);

describe('ground grid', () => {
  it('converts hex colors to raw 0..1 triples', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#FFFFFF')).toEqual([1, 1, 1]);
    const [r, g, b] = hexToRgb('#F2AF29');
    expect([Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]).toEqual([0xf2, 0xaf, 0x29]);
  });

  it('declares exactly the uniforms the component supplies, with matching types', () => {
    const declared = [...GROUND_FRAGMENT_SHADER.matchAll(/^uniform (float|vec3) (\w+);/gm)].map((m) => ({ type: m[1], name: m[2] }));
    const supplied = createGroundUniforms(0.2, 3);
    expect(declared.map((d) => d.name).sort()).toEqual(Object.keys(supplied).sort());
    for (const { type, name } of declared) {
      const value = supplied[name].value;
      expect(Array.isArray(value) ? 'vec3' : 'float').toBe(type);
      if (Array.isArray(value)) expect(value).toHaveLength(3);
    }
  });

  it('keeps the spoke arithmetic consistent: even count (atan seam), cardinals every quarter turn', () => {
    const spokes = constant('SPOKES');
    expect(spokes % 2).toBe(0);
    expect(spokes / 4).toBe(constant('SPOKES_PER_CARDINAL')); // the north line is offset by exactly a quarter turn
    expect(constant('SPOKES_PER_CARDINAL') % constant('SPOKES_PER_MEDIUM')).toBe(0); // cardinals sit on medium spokes
  });

  it('has sane, ordered styling', () => {
    const s = GROUND_STYLE;
    for (const alpha of [s.minor, s.major, s.cardinal, s.north]) expect(alpha > 0 && alpha <= 1).toBe(true);
    expect(s.north).toBeGreaterThanOrEqual(s.cardinal);
    expect(s.cardinal).toBeGreaterThan(s.major);
    expect(s.major).toBeGreaterThan(s.minor);
    expect(s.fadeNear).toBeLessThan(s.fadeFar);
    expect(s.fadeFar).toBeLessThan(100); // lines are gone before the camera's far plane cuts the ground
    const sum = (rgb: number[]) => rgb[0] + rgb[1] + rgb[2];
    expect(sum(hexToRgb(s.far))).toBeGreaterThan(sum(hexToRgb(s.near))); // lighter toward the horizon
  });

  it('uses the app palette for the lines', () => {
    expect(GROUND_STYLE.cream.toUpperCase()).toBe(Colors.palette.cream);
    expect(GROUND_STYLE.amber.toUpperCase()).toBe(Colors.palette.amber);
  });

  it('scales the grid with the eye height and the line width with the pixel ratio', () => {
    expect(createGroundUniforms(0.2, 3).uRingStep.value).toBeCloseTo(GROUND_STYLE.ringStep * 0.2, 12);
    expect(createGroundUniforms(1, 3).uRingStep.value).toBeCloseTo(GROUND_STYLE.ringStep, 12);
    expect(createGroundUniforms(0.2, 3).uWidthPx.value).toBeCloseTo(GROUND_STYLE.lineWidthDp * 3, 12);
    expect(createGroundUniforms(0.2, 2).uWidthPx.value).toBeCloseTo(GROUND_STYLE.lineWidthDp * 2, 12);
  });

  it('leaves three.js to supply the version and precision, and does not depend on the pixel grid', () => {
    for (const source of [GROUND_VERTEX_SHADER, GROUND_FRAGMENT_SHADER]) {
      expect(source).not.toMatch(/#version|precision |gl_FragCoord|discard/);
    }
    expect(GROUND_FRAGMENT_SHADER).toContain('fwidth');
  });
});