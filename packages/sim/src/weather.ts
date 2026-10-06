import type {EnvironmentWeather} from '../../protocol/src/index';
import {seedHash} from './terrain';

// A front develops and clears coherently. Durations and branch choice are fixed
// by the map seed; loading/replaying the same tick restores identical weather.
export function weatherAt(seed: number, tick: number): {weather: EnvironmentWeather; wind: number} {
  const front: EnvironmentWeather[] =
    seedHash(seed, 900) % 2
      ? ['clear', 'windy', 'overcast', 'rain', 'overcast', 'storm', 'overcast', 'mist', 'clear']
      : ['clear', 'mist', 'clear', 'windy', 'overcast', 'storm', 'overcast', 'rain', 'clear'];
  const durations = front.map((_, i) => 1200 + (seedHash(seed, 910 + i) % 1800));
  let phase = Math.max(0, tick) % durations.reduce((a, b) => a + b, 0),
    index = 0;
  while (phase >= durations[index]) phase -= durations[index++];
  const weather = front[index];
  return {weather, wind: {clear: 1600, mist: 900, overcast: 3000, rain: 4200, windy: 6500, storm: 8500}[weather]};
}
