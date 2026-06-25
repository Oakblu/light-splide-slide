import { useEffect, useLayoutEffect } from 'react';

/**
 * useLayoutEffect on the client, useEffect on the server — avoids React's
 * "useLayoutEffect does nothing on the server" SSR warning while keeping the
 * synchronous layout-phase timing on the client.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
