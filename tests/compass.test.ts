import { describe, expect, it } from 'vitest';
import { compassRotationDeg } from '../src/ui/hud';

describe('compassRotationDeg', () => {
  it('keeps north up when facing north', () => {
    expect(compassRotationDeg(Math.PI / 2)).toBeCloseTo(0);
  });
  it('turns north to the left when facing east and to the right when facing west', () => {
    expect(compassRotationDeg(0)).toBeCloseTo(-90);
    expect(compassRotationDeg(Math.PI)).toBeCloseTo(90);
  });
  it('puts north at the bottom when facing south', () => {
    expect(Math.abs(compassRotationDeg(-Math.PI / 2))).toBeCloseTo(180);
  });
  it('normalises any number of full turns into -180..180', () => {
    expect(compassRotationDeg(Math.PI / 2 + 6 * Math.PI)).toBeCloseTo(0);
    expect(compassRotationDeg(-7 * Math.PI)).toBeCloseTo(90);
  });
});
