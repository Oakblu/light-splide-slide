'use client';
import {
  type Attributes,
  Children,
  cloneElement,
  type CSSProperties,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
} from 'react';
import { getGridDimensions, toCssUnit } from '../core';
import { useSliderContext } from '../slider-context';

type SliderTrackProps = {
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
}: SliderTrackProps) {
  const carousel = useSliderContext();
  const slideChildren = Children.toArray(children).filter(isValidElement);
  const gridDimensions = getGridDimensions(carousel?.options.grid);

  const pages = useMemo<ReactElement[] | ReactElement[][]>(() => {
    if (cssGridRows) {
      const cols: ReactElement[][] = [];
      for (let i = 0; i < slideChildren.length; i += cssGridRows) {
        cols.push(slideChildren.slice(i, i + cssGridRows));
      }
      return cols;
    }
    if (!gridDimensions) {
      return slideChildren;
    }
    const grouped: ReactElement[][] = [];
    for (let i = 0; i < slideChildren.length; i += gridDimensions.itemsPerPage) {
      grouped.push(slideChildren.slice(i, i + gridDimensions.itemsPerPage));
    }
    return grouped;
  }, [cssGridRows, gridDimensions, slideChildren]);

  const pageCount = pages.length;
  useEffect(() => {
    carousel?.setPageCount(pageCount);
  }, [carousel, pageCount]);

  if (!carousel) {
    return null;
  }

  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const hasPadding = carousel.options.padding !== undefined;
  const pad =
    typeof carousel.options.padding === 'object'
      ? carousel.options.padding
      : { left: carousel.options.padding, right: carousel.options.padding };
  const paddingLeft = toCssUnit(pad?.left) ?? '0px';
  const paddingRight = toCssUnit(pad?.right) ?? '0px';

  const scrollStyle: CSSProperties & Record<`--${string}`, string> = {
    display: 'flex',
    scrollSnapType: 'x mandatory',
    overflowX: 'auto',
    overflowY: 'hidden',
    overscrollBehaviorX: 'contain',
    scrollbarWidth: 'none',
    scrollBehavior: 'smooth',
    gap,
    '--slider-gap': gap,
    '--slider-padding-left': paddingLeft,
    '--slider-padding-right': paddingRight,
    ...(hasPadding
      ? { paddingLeft, paddingRight, scrollPaddingLeft: paddingLeft, scrollPaddingRight: paddingRight }
      : {}),
  };

  const renderGroupedPage = (page: ReactElement[], pageIndex: number) => {
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
        style={{ minWidth: 0, flexShrink: 0, scrollSnapAlign: 'start' }}
      >
        <div style={innerStyle}>
          {page.map((child, ci) => (
            <div key={`item-${pageKey}-${child.key ?? ci}`} style={{ width: '100%' }}>
              {child}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFlatPage = (page: ReactElement, pageIndex: number) => {
    const pageProps: Attributes & { 'data-carousel-page': true } = {
      key: page.key ?? `page-${pageIndex}`,
      'data-carousel-page': true,
    };
    return cloneElement(page, pageProps);
  };

  return (
    <div className={className} style={{ overflow: 'hidden', ...style }}>
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
