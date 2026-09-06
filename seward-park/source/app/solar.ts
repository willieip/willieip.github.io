// NOAA/Meeus solar equations. UTC instants keep solar motion independent of
// the visitor's time zone and daylight-saving clock changes.
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
export const SEWARD_PARK = { latitude: 40.71483, longitude: -73.98915, timeZone: 'America/New_York' };

const radians = Math.PI / 180;
const degrees = 180 / Math.PI;
const wrap = (value: number, limit: number) => ((value % limit) + limit) % limit;
const sin = (angle: number) => Math.sin(angle * radians);
const cos = (angle: number) => Math.cos(angle * radians);
const tan = (angle: number) => Math.tan(angle * radians);
const newYorkClock = new Intl.DateTimeFormat('en-US', {
  timeZone: SEWARD_PARK.timeZone, hour: 'numeric', minute: '2-digit',
});

export type SolarPosition = { altitude: number; azimuth: number; rising: boolean };
export type LightingMode = 'live' | 'day' | 'night';
export type LightingStatus = { mode: LightingMode; phase: string; isNight: boolean; timeLabel: string };

export function sunPosition(date: Date, latitude = SEWARD_PARK.latitude, longitude = SEWARD_PARK.longitude): SolarPosition {
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError('A valid date is required');
  const century = (timestamp / 86400000 + 2440587.5 - 2451545) / 36525;
  const meanLongitude = wrap(280.46646 + century * (36000.76983 + century * .0003032), 360);
  const meanAnomaly = 357.52911 + century * (35999.05029 - .0001537 * century);
  const eccentricity = .016708634 - century * (.000042037 + .0000001267 * century);
  const equationOfCenter = sin(meanAnomaly) * (1.914602 - century * (.004817 + .000014 * century))
    + sin(2 * meanAnomaly) * (.019993 - .000101 * century) + sin(3 * meanAnomaly) * .000289;
  const omega = 125.04 - 1934.136 * century;
  const apparentLongitude = meanLongitude + equationOfCenter - .00569 - .00478 * sin(omega);
  const obliquity = 23 + (26 + (21.448 - century * (46.815 + century * (.00059 - century * .001813))) / 60) / 60
    + .00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) * degrees;
  const y = tan(obliquity / 2) ** 2;
  const equationOfTime = 4 * degrees * (y * sin(2 * meanLongitude) - 2 * eccentricity * sin(meanAnomaly)
    + 4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude)
    - .5 * y * y * sin(4 * meanLongitude) - 1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly));
  const utcMinutes = wrap(timestamp, 86400000) / 60000;
  const hourAngle = wrap(utcMinutes + equationOfTime + 4 * longitude, 1440) / 4 - 180;
  const altitude = Math.asin(Math.max(-1, Math.min(1,
    sin(latitude) * sin(declination) + cos(latitude) * cos(declination) * cos(hourAngle)))) * degrees;
  const azimuth = wrap(Math.atan2(sin(hourAngle), cos(hourAngle) * sin(latitude) - tan(declination) * cos(latitude)) * degrees + 180, 360);
  return { altitude, azimuth, rising: hourAngle < 0 };
}

export function sunDirection(altitude: number, azimuth: number): [number, number, number] {
  // Diorama coordinates: +X east, -Z north, +Y up.
  return [cos(altitude) * sin(azimuth), sin(altitude), -cos(altitude) * cos(azimuth)];
}

export function lightingStatus(mode: LightingMode, position: SolarPosition, date: Date): LightingStatus {
  const phase = mode === 'day' ? 'Daylight' : mode === 'night' ? 'Night'
    : position.altitude >= 6 ? 'Daylight' : position.altitude >= -6 ? (position.rising ? 'Dawn' : 'Dusk')
      : position.altitude > -12 ? 'Twilight' : 'Night';
  return { mode, phase, isNight: mode === 'night' || (mode === 'live' && position.altitude < -1), timeLabel: newYorkClock.format(date) };
}

export type LightPalette = {
  altitude: number; background: number; sky: number; ground: number; sun: number;
  sunPower: number; hemisphere: number; fill: number; environment: number; lamps: number;
};

const palettes: LightPalette[] = [
  { altitude: -18, background: 0x081321, sky: 0x738aaf, ground: 0x313e50, sun: 0xff9856, sunPower: 0, hemisphere: .20, fill: .29, environment: .06, lamps: 1 },
  { altitude: -12, background: 0x102038, sky: 0x829bc1, ground: 0x465364, sun: 0xff9856, sunPower: 0, hemisphere: .26, fill: .30, environment: .07, lamps: 1 },
  { altitude: -6, background: 0x525b75, sky: 0xa4aed0, ground: 0x726779, sun: 0xff9a58, sunPower: 0, hemisphere: .48, fill: .36, environment: .10, lamps: 1 },
  { altitude: -1, background: 0xb29a9b, sky: 0xdfb9b2, ground: 0x928066, sun: 0xffab66, sunPower: 0, hemisphere: .82, fill: .40, environment: .13, lamps: .55 },
  { altitude: 4, background: 0xe9c9a3, sky: 0xf4d6b4, ground: 0x8f8d7a, sun: 0xffc182, sunPower: 1.15, hemisphere: 1.12, fill: .52, environment: .17, lamps: .08 },
  { altitude: 12, background: 0xede4d2, sky: 0xfff0d5, ground: 0x899382, sun: 0xffe0af, sunPower: 2.2, hemisphere: 1.50, fill: .64, environment: .20, lamps: 0 },
  { altitude: 35, background: 0xeeeee7, sky: 0xf5f5e9, ground: 0x899382, sun: 0xfff3db, sunPower: 2.6, hemisphere: 1.7, fill: .70, environment: .22, lamps: 0 },
];

export function lightingPalette(altitude: number) {
  const upper = palettes.findIndex(value => value.altitude > altitude);
  if (upper === 0) return { from: palettes[0], to: palettes[0], blend: 0 };
  if (upper === -1) return { from: palettes.at(-1)!, to: palettes.at(-1)!, blend: 0 };
  const from = palettes[upper - 1], to = palettes[upper];
  const amount = (altitude - from.altitude) / (to.altitude - from.altitude);
  return { from, to, blend: amount * amount * (3 - 2 * amount) };
}
