import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE } from './index';

describe('@hpt/shared', () => {
  it('exposes its package placeholder', () => {
    expect(SHARED_PACKAGE).toBe('@hpt/shared');
  });
});
