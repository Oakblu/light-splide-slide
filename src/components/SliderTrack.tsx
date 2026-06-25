'use client';
import {
  type Attributes,
  Children,
  type CSSProperties,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
} from 'react';
import { computeScrollStyle, getGridDimensions, toCssUnit } from '../core';
import { useSliderContext } from '../slider-context';
import type { SliderInjectedOptions } from '../types';

type SliderTrackProps = HTMLAttributes<HTMLDivElement> &
  SliderInjectedOptions & {
    className?: string;
    style?: CSSProperties;
    scrollClassName?: string;
    gridClassName?: string;
    cssGridRows?: number;
    children?: ReactNode;
  };

function isGrouped(pages: ReactElement[] | ReactElement[][]): pages is ReactElement[][] {
  return Array.isArray(pages[0]);
}

export function SliderTrack({
  className,
  style,
  scrollClassName,
  gridClassName,
  cssGridRows,
  children,
  __sliderOptions: _ignoredSliderOptions,
  ...rest
}: SliderTrackProps) {
  const carousel = useSliderContext();
  const gridDimensions = useMemo(
    () => getGridDimensions(carousel?.options.grid),
    [carousel?.options.grid]
  );

  const pages = useMemo<ReactElement[] | ReactElement[][]>(() => {
    const slides = Children.toArray(children).filter(isValidElement);
    if (cssGridRows) {
      const cols: ReactElement[][] = [];
      for (let i = 0; i < slides.length; i += cssGridRows) {
        cols.push(slides.slice(i, i + cssGridRows));
      }
      return cols;
    }
    if (!gridDimensions) {
      return slides;
    }
    const grouped: ReactElement[][] = [];
    for (let i = 0; i < slides.length; i += gridDimensions.itemsPerPage) {
      grouped.push(slides.slice(i, i + gridDimensions.itemsPerPage));
    }
    return grouped;
  }, [children, cssGridRows, gridDimensions]);

  const pageCount = pages.length;
  useEffect(() => {
    carousel?.setPageCount(pageCount);
  }, [carousel, pageCount]);

  if (!carousel) {
    return null;
  }

  const { style: scrollBaseStyle, cssVars: scrollCssVars } = computeScrollStyle(carousel.options);
  const gap = toCssUnit(carousel.options.gap) ?? '0px'; // still needed for grid row/col fallbacks below
  const scrollStyle: CSSProperties & Record<`--${string}`, string> = {
    ...scrollBaseStyle,
    ...scrollCssVars,
  };

  const renderGroupedPage = (page: ReactElement[], pageIndex: number) => {
    // v8 ignore next -- Children.toArray always assigns keys; `?? pageIndex` is unreachable
    const pageKey = page.map((p) => p.key ?? pageIndex).join('--');
    const innerStyle: CSSProperties = cssGridRows
      ? {
          display: 'grid',
          height: '100%',
          gridTemplateRows: `repeat(${cssGridRows}, minmax(0, 1fr))`,
          rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
        }
      : {
          display: 'grid',
          gridTemplateColumns: `repeat(${gridDimensions?.columns}, minmax(0, 1fr))`,
          columnGap: toCssUnit(carousel.options.grid?.gap?.col) ?? gap,
          rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
        };
    return (
      <div
        key={`page-${pageKey}`}
        className={gridClassName}
        data-carousel-page="true"
        // A grid page is one snap unit: it must fill the viewport so the inner
        // grid's fractional columns have a width to divide (otherwise they
        // collapse to min-content and every page packs side-by-side).
        style={{ width: '100%', flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start' }}
      >
        <div style={innerStyle}>
          {page.map((child, ci) => {
            // v8 ignore next -- Children.toArray always assigns keys; right side of `?? ci` is unreachable
            const itemKey = `item-${pageKey}-${child.key ?? ci}`;
            return (
              <div key={itemKey} style={{ width: '100%' }}>
                {child}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFlatPage = (page: ReactElement, pageIndex: number) => {
    const pageProps: Attributes & { 'data-carousel-page': true } = {
      // v8 ignore next -- Children.toArray always assigns keys; `?? \`page-${pageIndex}\`` is unreachable
      key: page.key ?? `page-${pageIndex}`,
      'data-carousel-page': true,
    };
    return cloneElement(page, pageProps);
  };

  return (
    <div {...rest} className={className} style={{ overflow: 'hidden', ...style }}>
      <div
        ref={carousel.registerScrollElement}
        className={scrollClassName}
        data-slider-scroll=""
        style={scrollStyle}
      >
        {isGrouped(pages) ? pages.map(renderGroupedPage) : pages.map(renderFlatPage)}
      </div>
    </div>
  );
}

export default SliderTrack;
