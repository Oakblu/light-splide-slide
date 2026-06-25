import { Children, type CSSProperties, cloneElement, isValidElement, useId } from 'react';
import { computeScrollStyle, DEFAULTS, mergeOptions, resolveOptions, toCssUnit } from '../core';
import type { SliderInjectedOptions, SliderOptions, SliderProps } from '../types';
import { SliderRuntime } from './SliderRuntime';
import { SliderTrack } from './SliderTrack';

function slideWidthExpr(perPage: number, gap: string): string {
  return `calc((100% - (${gap} * ${Math.max(perPage - 1, 0)})) / ${perPage})`;
}

function generateBreakpointCSS(scopeId: string, options: SliderOptions): string {
  if (!options.breakpoints || !Object.keys(options.breakpoints).length) {
    return '';
  }
  const base: SliderOptions = { ...DEFAULTS, ...options };
  const mediaQuery = base.mediaQuery ?? 'max';
  const dir = mediaQuery === 'min' ? 'min-width' : 'max-width';
  // v8 ignore next -- DEFAULTS always provides perPage: 1; the ?? fallback is unreachable
  const basePerPage = base.perPage ?? 1;
  const baseGap = toCssUnit(base.gap) ?? '0px';
  // v8 ignore next -- toCssUnit always returns string for a defined fixedWidth; ?? branch is unreachable
  const baseWidth = base.fixedWidth
    ? (toCssUnit(base.fixedWidth) ?? '100%')
    : slideWidthExpr(basePerPage, baseGap);

  const scope = `[data-slider-scope="${scopeId}"]`;
  const slide = '[data-carousel-page]';
  let css = `${scope} ${slide}{width:${baseWidth}}`;

  const sorted = Object.entries(options.breakpoints)
    .map(([w, v]) => [Number(w), v] as const)
    .sort(([a], [b]) => (mediaQuery === 'max' ? b - a : a - b));

  for (const [width, bpOptions] of sorted) {
    const resolved = mergeOptions(base, bpOptions);
    // v8 ignore next -- mergeOptions inherits base.perPage (from DEFAULTS); the ?? fallback is unreachable
    const bpPerPage = resolved.perPage ?? 1;
    const bpGap = toCssUnit(resolved.gap) ?? '0px';
    // v8 ignore next -- toCssUnit always returns string for a defined fixedWidth; ?? branch is unreachable
    const bpWidth = resolved.fixedWidth
      ? (toCssUnit(resolved.fixedWidth) ?? '100%')
      : slideWidthExpr(bpPerPage, bpGap);
    css += `@media(${dir}:${width}px){${scope} ${slide}{width:${bpWidth}}}`;
  }
  return css;
}

function injectIntoTrack(
  children: SliderProps['children'],
  options: SliderOptions,
  cssId?: string
) {
  return Children.map(children, (child) => {
    if (isValidElement<SliderInjectedOptions>(child) && child.type === SliderTrack) {
      const injected: SliderInjectedOptions = {
        __sliderOptions: options,
        ...(cssId !== undefined ? { __cssId: cssId } : {}),
      };
      return cloneElement(child, injected);
    }
    return child;
  });
}

export function Slider({
  options,
  className,
  style,
  'aria-label': ariaLabel,
  children,
  onMounted,
  onDestroy,
  ...rest
}: SliderProps) {
  const uid = useId();
  const scopeId = uid.replace(/:/g, '');
  const resolved = resolveOptions(options ?? {}, null);
  const { cssVars } = computeScrollStyle(resolved);
  const sectionStyle: CSSProperties & Record<`--${string}`, string> = {
    position: 'relative',
    ...cssVars,
    ...style,
  };
  const breakpointCSS = generateBreakpointCSS(scopeId, options ?? {});
  const cssId = breakpointCSS ? scopeId : undefined;

  return (
    <section
      aria-label={ariaLabel}
      className={className}
      style={sectionStyle}
      {...rest}
      {...(cssId !== undefined ? { 'data-slider-scope': cssId } : {})}
    >
      {breakpointCSS && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is library-generated, never from user input
        <style dangerouslySetInnerHTML={{ __html: breakpointCSS }} />
      )}
      <SliderRuntime options={options ?? {}} onMounted={onMounted} onDestroy={onDestroy}>
        {injectIntoTrack(children, resolved, cssId)}
      </SliderRuntime>
    </section>
  );
}

export default Slider;
