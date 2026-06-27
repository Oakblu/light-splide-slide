import { describe, expect, it } from 'vitest';
import { computeScrollStyle } from './scroll-style';

describe('computeScrollStyle', () => {
  it('emits the baseline structural styles', () => {
    const style = computeScrollStyle({});
    expect(style.display).toBe('flex');
    expect(style.scrollSnapType).toBe('x mandatory');
    expect(style.overflowX).toBe('auto');
    expect(style.overflowY).toBe('hidden');
    expect(style.overscrollBehaviorX).toBe('contain');
    expect(style.scrollbarWidth).toBe('none');
    expect(style.scrollBehavior).toBe('smooth');
  });

  it('defaults gap and padding to 0px', () => {
    const style = computeScrollStyle({});
    expect(style.gap).toBe('0px');
  });

  it('forwards gap (string and number) to style', () => {
    expect(computeScrollStyle({ gap: '12px' }).gap).toBe('12px');
    expect(computeScrollStyle({ gap: 8 }).gap).toBe('8px');
  });

  it('applies object padding to padding + scroll-padding', () => {
    const style = computeScrollStyle({ padding: { left: '20px', right: '10px' } });
    expect(style.paddingLeft).toBe('20px');
    expect(style.paddingRight).toBe('10px');
    expect(style.scrollPaddingLeft).toBe('20px');
    expect(style.scrollPaddingRight).toBe('10px');
  });

  it('applies scalar padding symmetrically', () => {
    expect(computeScrollStyle({ padding: 16 }).paddingLeft).toBe('16px');
    expect(computeScrollStyle({ padding: '1rem' }).paddingRight).toBe('1rem');
  });

  it('leaves padding / scroll-padding unset when no padding option', () => {
    const style = computeScrollStyle({});
    expect(style.paddingLeft).toBeUndefined();
    expect(style.scrollPaddingLeft).toBeUndefined();
  });

  it('sets touch-action pan-y only when drag is disabled', () => {
    expect(computeScrollStyle({ drag: false }).touchAction).toBe('pan-y');
    expect(computeScrollStyle({ drag: true }).touchAction).toBeUndefined();
    expect(computeScrollStyle({}).touchAction).toBeUndefined();
  });
});
