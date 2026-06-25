import { describe, expect, it } from 'vitest';
import { mergeOptions, resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies defaults', () => {
    const r = resolveOptions({}, null);
    expect(r).toMatchObject({ arrows: true, drag: true, pagination: false, perMove: 1, perPage: 1, type: 'slide' });
  });
  it('user options override defaults', () => {
    expect(resolveOptions({ perPage: 3 }, null).perPage).toBe(3);
  });
  it('skips breakpoints when viewportWidth is null', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, null);
    expect(r.perPage).toBe(1);
  });
  it('applies max-width breakpoints (default mediaQuery)', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, 500);
    expect(r.perPage).toBe(2);
  });
  it('does not apply max-width breakpoint above width', () => {
    const r = resolveOptions({ perPage: 1, breakpoints: { 600: { perPage: 2 } } }, 800);
    expect(r.perPage).toBe(1);
  });
  it('applies min-width breakpoints', () => {
    const r = resolveOptions({ perPage: 1, mediaQuery: 'min', breakpoints: { 600: { perPage: 2 } } }, 800);
    expect(r.perPage).toBe(2);
  });
});

describe('mergeOptions', () => {
  it('returns base when no override', () => {
    expect(mergeOptions({ perPage: 1 }).perPage).toBe(1);
  });
  it('deep-merges padding objects', () => {
    const r = mergeOptions({ padding: { left: '1rem', right: '1rem' } }, { padding: { right: '2rem' } });
    expect(r.padding).toEqual({ left: '1rem', right: '2rem' });
  });
  it('normalizes scalar base padding and preserves unspecified override side', () => {
    const r = mergeOptions({ padding: '1rem' }, { padding: { left: '2rem' } });
    expect(r.padding).toEqual({ left: '2rem', right: '1rem' });
  });
  it('object override of only one side keeps the other side from base', () => {
    const r = mergeOptions({ padding: { left: '1rem', right: '1rem' } }, { padding: { left: '2rem' } });
    expect(r.padding).toEqual({ left: '2rem', right: '1rem' });
  });
  it('deep-merges grid gap', () => {
    const r = mergeOptions({ grid: { gap: { row: '1px' } } }, { grid: { gap: { col: '2px' } } });
    expect(r.grid).toEqual({ gap: { row: '1px', col: '2px' } });
  });
  it('override gap wins, falls back to base', () => {
    expect(mergeOptions({ gap: '1rem' }, { perPage: 2 }).gap).toBe('1rem');
    expect(mergeOptions({ gap: '1rem' }, { gap: '2rem' }).gap).toBe('2rem');
  });
  it('keeps base breakpoints (override breakpoints ignored)', () => {
    const r = mergeOptions({ breakpoints: { 1: {} } }, { breakpoints: { 2: {} } });
    expect(r.breakpoints).toEqual({ 1: {} });
  });
  it('returns undefined padding/grid when neither present', () => {
    const r = mergeOptions({ perPage: 1 }, { perPage: 2 });
    expect(r.padding).toBeUndefined();
    expect(r.grid).toBeUndefined();
  });
});
