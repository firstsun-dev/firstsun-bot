import { describe, expect, it } from 'vitest';
import { startupBanner } from '../src/index.js';

describe('startupBanner', () => {
  it('returns a non-empty banner string', () => {
    expect(startupBanner()).toContain('firstsun-bot');
  });
});
