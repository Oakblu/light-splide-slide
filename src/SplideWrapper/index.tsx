'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';
import { twMerge } from 'tailwind-merge';

import {
  CarouselContext,
  type CarouselContextValue,
  useCarouselContext,
} from '../carousel-context';
import {
  useCarouselController,
  useCarouselLastChildVisibility,
  useCarouselScrollSync,
  useSplideImperativeApi,
  useViewportWidth,
} from './hooks';
import type { SplideWrapperProps } from './types';
import {
  getGridDimensions,
  getMaxIndex,
  getPaginationCount,
  resolveOptions,
  toCssUnit,
} from './utils';

function SplideWrapper({
  options,
  className,
  style,
  hasTrack = false,
  'aria-label': ariaLabel,
  children,
  extensions,
  onMounted,
  onDestroy,
  ...rest
}: SplideWrapperProps) {
  const [pageCount, setPageCount] = useState(0);
  const viewportWidth = useViewportWidth();

  const resolvedOptions = useMemo(
    () => resolveOptions(options ?? {}, viewportWidth),
    [options, viewportWidth]
  );
  const hideArrowsOnMobile = className?.includes('noArrows') ?? false;
  const topNavigation = className?.includes('splideNav--top') ?? false;

  const {
    currentIndex,
    currentIndexRef,
    emitMoved,
    goTo,
    movedListenersRef,
    next,
    prev,
    registerScrollElement,
    scrollElementRef,
  } = useCarouselController({
    pageCount,
    resolvedOptions,
  });

  const maxIndex = getMaxIndex(resolvedOptions, pageCount);
  const paginationCount = getPaginationCount(resolvedOptions, pageCount);
  const perStep = resolvedOptions.grid ? 1 : (resolvedOptions.perMove ?? 1);
  const currentPageIndex =
    currentIndex >= maxIndex ? paginationCount - 1 : Math.floor(currentIndex / perStep);
  const isLastChildVisible = useCarouselLastChildVisibility({
    pageCount,
    scrollElementRef,
  });

  // Context lets Nav/Track/Slide share one carousel state without prop drilling.
  const contextValue = useMemo<CarouselContextValue>(
    () => ({
      canGoNext: currentIndex < maxIndex && !isLastChildVisible,
      canGoPrev: currentIndex > 0,
      currentIndex,
      hideArrowsOnMobile,
      goTo,
      next,
      options: resolvedOptions,
      pageCount,
      paginationCount,
      prev,
      registerScrollElement,
      setPageCount,
      topNavigation,
    }),
    [
      currentIndex,
      hideArrowsOnMobile,
      goTo,
      isLastChildVisible,
      maxIndex,
      next,
      pageCount,
      paginationCount,
      prev,
      registerScrollElement,
      resolvedOptions,
      topNavigation,
    ]
  );

  useCarouselScrollSync({
    currentIndexRef,
    emitMoved,
    pageCount,
    scrollElementRef,
  });
  useSplideImperativeApi({
    currentIndexRef,
    goTo,
    movedListenersRef,
    onDestroy,
    onMounted,
  });

  return (
    <CarouselContext.Provider value={contextValue}>
      <section
        aria-label={ariaLabel}
        className={twMerge('relative', className)}
        style={style}
        {...rest}
      >
        {children}
        {resolvedOptions.pagination && (
          // Pagination is rendered here because it depends only on wrapper-level state.
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: paginationCount }).map((_, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: <In this case can't cause an issue as the items can't be rearrage>
                key={`pagination-${index}`}
                className={twMerge(
                  'h-2.5 w-2.5 rounded-full border-0 bg-iron p-0 opacity-100',
                  index === currentPageIndex && 'bg-luxauto-100'
                )}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </section>
    </CarouselContext.Provider>
  );
}

function SplideTrack({
  className,
  cssGridRows,
  gridClassName,
  scrollClassName,
  children,
}: {
  className?: string;
  cssGridRows?: number;
  gridClassName?: string;
  scrollClassName?: string;
  children?: ReactNode;
}) {
  const carousel = useCarouselContext();
  const slideChildren = (Children.toArray(children) as (ReactNode & { key?: string })[]).filter(
    isValidElement
  );
  const gridDimensions = getGridDimensions(carousel?.options.grid);

  const pages = useMemo(():
    | (ReactNode & { key?: string })[]
    | (ReactNode & { key?: string })[][] => {
    if (cssGridRows) {
      const groupedColumns: (ReactNode & { key?: string })[][] = [];
      for (let index = 0; index < slideChildren.length; index += cssGridRows) {
        groupedColumns.push(slideChildren.slice(index, index + cssGridRows));
      }

      return groupedColumns;
    }

    // In grid mode one "page" contains multiple items; otherwise each child is one page.
    if (!gridDimensions) {
      return slideChildren.map((child) => child);
    }

    const groupedPages: (ReactNode & { key?: string })[][] = [];
    for (let index = 0; index < slideChildren.length; index += gridDimensions.itemsPerPage) {
      groupedPages.push(slideChildren.slice(index, index + gridDimensions.itemsPerPage));
    }

    return groupedPages;
  }, [cssGridRows, gridDimensions, slideChildren]);

  useEffect(() => {
    if (carousel) carousel.setPageCount(pages.length);
  }, [carousel, pages.length]);

  if (!carousel) {
    return null;
  }

  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const hasPadding = carousel.options.padding !== undefined;
  const resolvedPadding =
    typeof carousel.options.padding === 'object'
      ? carousel.options.padding
      : { left: carousel.options.padding, right: carousel.options.padding };
  const paddingLeft = toCssUnit(resolvedPadding?.left) ?? '0px';
  const paddingRight = toCssUnit(resolvedPadding?.right) ?? '0px';

  return (
    <div className={twMerge('overflow-hidden', className)}>
      <div
        ref={carousel.registerScrollElement}
        className={twMerge(
          'flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          scrollClassName
        )}
        style={
          {
            // Expose layout values both as CSS vars and inline styles to keep the track easy to debug.
            '--carousel-gap': gap,
            '--carousel-padding-left': paddingLeft,
            '--carousel-padding-right': paddingRight,
            gap,
            scrollBehavior: 'smooth',
            ...(hasPadding
              ? {
                  paddingLeft,
                  paddingRight,
                  scrollPaddingLeft: paddingLeft,
                  scrollPaddingRight: paddingRight,
                }
              : {}),
          } as React.CSSProperties
        }
      >
        {cssGridRows
          ? (pages as (ReactNode & { key?: string })[][]).map((page, pageIndex) => {
              const pageKey = page.map((subPage) => subPage?.key ?? pageIndex).join('--');
              return (
                <div
                  key={`carousel-css-grid-column-${pageKey}`}
                  className={twMerge('min-w-0 shrink-0 snap-start', gridClassName)}
                  data-carousel-page="true"
                >
                  <div
                    className="grid h-full"
                    style={
                      {
                        gridTemplateRows: `repeat(${cssGridRows}, minmax(0, 1fr))`,
                        rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
                      } as React.CSSProperties
                    }
                  >
                    {page.map((child, childIndex) => (
                      <div
                        key={`css-grid-item-${pageKey}-${child?.key ?? childIndex}`}
                        className="w-full"
                      >
                        {child}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          : gridDimensions
            ? (pages as (ReactNode & { key?: string })[][]).map((page, pageIndex) => {
                const pageKey = page.map((subPage) => subPage?.key ?? pageIndex).join('--');
                return (
                  <div
                    key={`carousel-page-${pageKey}`}
                    className={twMerge('min-w-0 shrink-0 snap-start', gridClassName)}
                    data-carousel-page="true"
                  >
                    <div
                      className="grid"
                      style={
                        {
                          gridTemplateColumns: `repeat(${gridDimensions.columns}, minmax(0, 1fr))`,
                          columnGap: toCssUnit(carousel.options.grid?.gap?.col) ?? gap,
                          rowGap: toCssUnit(carousel.options.grid?.gap?.row) ?? gap,
                        } as React.CSSProperties
                      }
                    >
                      {page.map((child, childIndex) => (
                        <div
                          key={`grid-item-${pageKey}-${child?.key ?? childIndex}`}
                          className="w-full"
                        >
                          {child}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            : pages.map((page, pageIndex) =>
                isValidElement<Record<string, unknown>>(page)
                  ? cloneElement(page, {
                      ...(page.props as object),
                      'data-carousel-page': true,
                      key: page.key ?? `carousel-page-${pageIndex}`,
                    })
                  : page
              )}
      </div>
    </div>
  );
}

function SplideSlide({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const carousel = useCarouselContext();

  if (!carousel) {
    return <div className={className}>{children}</div>;
  }

  const fixedWidth = toCssUnit(carousel.options.fixedWidth);
  const gap = toCssUnit(carousel.options.gap) ?? '0px';
  const perPage = carousel.options.perPage ?? 1;
  // Slides either use a fixed width or divide the visible space by perPage.
  const width = fixedWidth
    ? fixedWidth
    : `calc((100% - (${gap} * ${Math.max(perPage - 1, 0)})) / ${perPage})`;

  return (
    <div className={twMerge('min-w-0 shrink-0 snap-start', className)} style={{ width }} {...rest}>
      {children}
    </div>
  );
}

export default SplideWrapper;
export type { SplideWrapperProps } from './types';
export { SplideSlide, SplideTrack };
