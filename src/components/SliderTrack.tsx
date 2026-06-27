import {
  type Attributes,
  Children,
  type CSSProperties,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { computeScrollStyle, getGridDimensions, toCssUnit } from '../core';
import type { SliderInjectedOptions, SliderOptions } from '../types';

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

function groupPages(
  children: ReactNode,
  cssGridRows: number | undefined,
  options: SliderOptions
): ReactElement[] | ReactElement[][] {
  const slides = Children.toArray(children).filter(isValidElement);
  if (cssGridRows) {
    const cols: ReactElement[][] = [];
    for (let i = 0; i < slides.length; i += cssGridRows) {
      cols.push(slides.slice(i, i + cssGridRows));
    }
    return cols;
  }
  const gridDimensions = getGridDimensions(options.grid);
  if (!gridDimensions) {
    return slides;
  }
  const grouped: ReactElement[][] = [];
  for (let i = 0; i < slides.length; i += gridDimensions.itemsPerPage) {
    grouped.push(slides.slice(i, i + gridDimensions.itemsPerPage));
  }
  return grouped;
}

export function SliderTrack({
  className,
  style,
  scrollClassName,
  gridClassName,
  cssGridRows,
  children,
  __sliderOptions,
  __cssId,
  ...rest
}: SliderTrackProps) {
  if (!__sliderOptions) {
    return null;
  }
  const options = __sliderOptions;
  const gridDimensions = getGridDimensions(options.grid);
  const pages = groupPages(children, cssGridRows, options);

  const scrollStyle = computeScrollStyle(options);
  const gap = toCssUnit(options.gap) ?? '0px';

  const renderGroupedPage = (page: ReactElement[], pageIndex: number) => {
    // v8 ignore next -- Children.toArray always assigns keys; `?? pageIndex` is unreachable
    const pageKey = page.map((p) => p.key ?? pageIndex).join('--');
    const innerStyle: CSSProperties = cssGridRows
      ? {
          display: 'grid',
          height: '100%',
          gridTemplateRows: `repeat(${cssGridRows}, minmax(0, 1fr))`,
          rowGap: toCssUnit(options.grid?.gap?.row) ?? gap,
        }
      : {
          display: 'grid',
          gridTemplateColumns: `repeat(${gridDimensions?.columns}, minmax(0, 1fr))`,
          columnGap: toCssUnit(options.grid?.gap?.col) ?? gap,
          rowGap: toCssUnit(options.grid?.gap?.row) ?? gap,
        };
    return (
      <div
        key={`page-${pageKey}`}
        className={gridClassName}
        data-carousel-page="true"
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
    const base: Attributes & { 'data-carousel-page': true } = {
      // v8 ignore next -- Children.toArray always assigns keys; `?? \`page-${pageIndex}\`` is unreachable
      key: page.key ?? `page-${pageIndex}`,
      'data-carousel-page': true,
    };
    if (typeof page.type === 'string') {
      return cloneElement(page, base);
    }
    const injected: typeof base & SliderInjectedOptions = {
      ...base,
      __sliderOptions: options,
      ...(__cssId !== undefined ? { __cssId } : {}),
    };
    return cloneElement(page, injected);
  };

  return (
    <div {...rest} className={className} style={{ overflow: 'hidden', ...style }}>
      <div className={scrollClassName} data-slider-scroll="" style={scrollStyle}>
        {isGrouped(pages) ? pages.map(renderGroupedPage) : pages.map(renderFlatPage)}
      </div>
    </div>
  );
}

export default SliderTrack;
