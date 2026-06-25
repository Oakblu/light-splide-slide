import { expect, it } from 'vitest';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

it('exports a hook function (server branch resolves to useEffect under node)', () => {
  expect(typeof useIsomorphicLayoutEffect).toBe('function');
});
