import { describe, expect, it } from 'vitest';
import { NavigationAction } from '../types';
import {
  getGridDimensions,
  getMaxIndex,
  getNearestPageIndex,
  getPaginationCount,
  resolveNextIndex,
} from './geometry';

describe('getGridDimensions', () => {
  it('returns null without dimensions', () => {
    expect(getGridDimensions(undefined)).toBeNull();
    expect(getGridDimensions({ dimensions: [] })).toBeNull();
  });
  it('sums columns and items per page, takes max rows', () => {
    expect(
      getGridDimensions({
        dimensions: [
          [2, 2],
          [1, 3],
        ],
      })
    ).toEqual({
      columns: 5,
      itemsPerPage: 7,
      rows: 2,
    });
  });
});

describe('getPaginationCount', () => {
  it('equals pageCount in grid mode', () => {
    expect(getPaginationCount({ grid: { dimensions: [[1, 2]] } }, 4)).toBe(4);
  });
  it('accounts for perPage', () => {
    expect(getPaginationCount({ perPage: 2 }, 5)).toBe(4);
  });
  it('accounts for perMove > 1', () => {
    expect(getPaginationCount({ perPage: 1, perMove: 2 }, 5)).toBe(3);
  });
  it('never below 1', () => {
    expect(getPaginationCount({ perPage: 5 }, 2)).toBe(1);
  });
});

describe('getMaxIndex', () => {
  it('pageCount-1 in grid mode', () => {
    expect(getMaxIndex({ grid: { dimensions: [[1, 2]] } }, 4)).toBe(3);
  });
  it('pageCount-perPage otherwise, floored at 0', () => {
    expect(getMaxIndex({ perPage: 2 }, 5)).toBe(3);
    expect(getMaxIndex({ perPage: 5 }, 2)).toBe(0);
  });
});

describe('resolveNextIndex', () => {
  const base = { currentIndex: 2, perMove: 2 };
  it('numeric control returns it directly', () => {
    expect(resolveNextIndex({ ...base, control: 5 })).toBe(5);
  });
  it('Next / > advance by perMove', () => {
    expect(resolveNextIndex({ ...base, control: NavigationAction.Next })).toBe(4);
    expect(resolveNextIndex({ ...base, control: '>' })).toBe(4);
  });
  it('Prev / < retreat by perMove', () => {
    expect(resolveNextIndex({ ...base, control: NavigationAction.Prev })).toBe(0);
    expect(resolveNextIndex({ ...base, control: '<' })).toBe(0);
  });
  it('+n / -n are relative', () => {
    expect(resolveNextIndex({ ...base, control: '+3' })).toBe(5);
    expect(resolveNextIndex({ ...base, control: '-1' })).toBe(1);
  });
  it('numeric string is absolute', () => {
    expect(resolveNextIndex({ ...base, control: '4' })).toBe(4);
  });
});

describe('getNearestPageIndex', () => {
  it('returns null for empty', () => {
    expect(getNearestPageIndex([], 0)).toBeNull();
  });
  it('picks the element whose offsetLeft is closest', () => {
    const els: { offsetLeft: number }[] = [
      { offsetLeft: 0 },
      { offsetLeft: 100 },
      { offsetLeft: 200 },
    ];
    expect(getNearestPageIndex(els, 90)).toBe(1);
    expect(getNearestPageIndex(els, 10)).toBe(0);
  });
});
