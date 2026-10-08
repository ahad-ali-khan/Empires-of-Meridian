import {describe, expect, test} from 'vitest';
import {WeatherTransition} from '../../apps/web/src/game/renderer/weather-transition';

describe('cosmetic weather fronts', () => {
  test('clouds, light, rain, fog and wind ease together and stay paused with the clock', () => {
    const front = new WeatherTransition(),
      start = {...front.current};
    front.set('rain', 10);
    expect(front.sample(10)).toEqual(start);
    const middle = {...front.sample(16)};
    expect(middle.rain).toBeCloseTo(0.34);
    expect(middle.sun).toBeGreaterThan(1.15);
    expect(middle.sun).toBeLessThan(start.sun);
    expect(front.sample(16)).toEqual(middle);
    expect(front.sample(22).rain).toBe(0.68);
    expect(front.sample(22).sun).toBe(1.15);
    front.set('clear', 22);
    expect(front.sample(28).rain).toBeCloseTo(0.34);
    expect(front.sample(34).rain).toBe(0);
  });
  test('interrupted fronts remain continuous and a developed storm has lightning without rain', () => {
    const front = new WeatherTransition();
    front.set('mist', 0);
    const before = {...front.sample(4)};
    front.set('storm', 4);
    expect(front.sample(4)).toEqual(before);
    const storm = front.sample(16);
    expect(storm.lightning).toBe(1);
    expect(storm.rain).toBe(0);
    expect(storm.sun).toBeCloseTo(0.45);
  });
});
