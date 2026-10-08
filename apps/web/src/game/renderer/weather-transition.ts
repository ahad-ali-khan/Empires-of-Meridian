import {Color} from 'three';
import type {EnvironmentWeather} from '../../../../../packages/protocol/src/index';

function look(weather: EnvironmentWeather) {
  const rainy = ['rain', 'overcast', 'mist', 'storm'].includes(weather),
    storm = weather === 'storm',
    mist = weather === 'mist',
    sun = new Color(rainy ? '#d6e2ed' : '#ffe8c5'),
    fog = new Color(storm ? '#536571' : mist ? '#afbfc0' : rainy ? '#809b9e' : '#bacdc6');
  return {
    cloud: {clear: 0.2, windy: 0.35, mist: 0.6, overcast: 0.92, rain: 1, storm: 1}[weather],
    storm: storm ? 1 : weather === 'rain' ? 0.4 : 0,
    wind: {clear: 1, windy: 2.2, mist: 0.5, overcast: 1, rain: 1.5, storm: 2.8}[weather],
    rain: weather === 'rain' ? 0.68 : 0,
    lightning: storm ? 1 : 0,
    sun: storm ? 0.45 : mist ? 0.85 : rainy ? 1.15 : 3.1,
    fill: rainy ? 1.25 : 1.05,
    density: mist ? 0.01 : storm ? 0.007 : rainy ? 0.005 : 0.0024,
    sunR: sun.r,
    sunG: sun.g,
    sunB: sun.b,
    fogR: fog.r,
    fogG: fog.g,
    fogB: fog.b,
  };
}
export type WeatherLook = ReturnType<typeof look>;

/** Cosmetic only: all channels follow one eased 12-second front, paused with the match clock. */
export class WeatherTransition {
  readonly current = look('clear');
  readonly blend: {from: EnvironmentWeather; progress: number} = {from: 'clear', progress: 1};
  private from = {...this.current};
  private target = {...this.current};
  private start = 0;
  private weather: EnvironmentWeather = 'clear';
  set(weather: EnvironmentWeather, time: number) {
    if (weather === this.weather) return;
    this.sample(time);
    this.from = {...this.current};
    this.target = look(weather);
    this.start = time;
    this.blend.from = this.weather;
    this.blend.progress = 0;
    this.weather = weather;
  }
  sample(time: number) {
    const t = Math.max(0, Math.min(1, (time - this.start) / 12)),
      ease = t * t * (3 - 2 * t);
    this.blend.progress = ease;
    for (const key of Object.keys(this.current) as (keyof WeatherLook)[])
      this.current[key] = this.from[key] + (this.target[key] - this.from[key]) * ease;
    return this.current;
  }
}
