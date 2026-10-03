import * as Astronomy from 'astronomy-engine';

export function getLocalSiderealTime(date: Date, longitude: number): number {
  const greenwichSiderealHours = Astronomy.SiderealTime(date);
  return ((greenwichSiderealHours + longitude / 15) % 24 + 24) % 24;
}