import { describe, it, expect } from 'vitest';
import { getGreeting } from './greeting';

// Use new Date(year, monthIndex, day, hour, ...) — these read in LOCAL time,
// which is what getGreeting itself uses. So these assertions are stable
// regardless of where the test runner machine is.
const at = (h) => new Date(2026, 0, 1, h, 0, 0);

describe('getGreeting', () => {
  it('greets morning between 05:00 and 11:59', () => {
    expect(getGreeting(at(5))).toBe('Good morning');
    expect(getGreeting(at(8))).toBe('Good morning');
    expect(getGreeting(at(11))).toBe('Good morning');
  });

  it('greets afternoon between 12:00 and 16:59', () => {
    expect(getGreeting(at(12))).toBe('Good afternoon');
    expect(getGreeting(at(15))).toBe('Good afternoon');
    expect(getGreeting(at(16))).toBe('Good afternoon');
  });

  it('greets evening from 17:00 onward and overnight', () => {
    expect(getGreeting(at(17))).toBe('Good evening');
    expect(getGreeting(at(21))).toBe('Good evening');
    expect(getGreeting(at(0))).toBe('Good evening');
    expect(getGreeting(at(3))).toBe('Good evening');
  });
});
