'use client';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { useSliderContext } from '../slider-context';

type SliderPaginationProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
  style?: CSSProperties;
  dotClassName?: string;
  dotStyle?: CSSProperties;
  renderDot?: (p: { index: number; current: boolean }) => ReactNode;
};

export function SliderPagination({
  className,
  style,
  dotClassName,
  dotStyle,
  renderDot,
  ...rest
}: SliderPaginationProps) {
  const carousel = useSliderContext();
  if (!carousel?.options.pagination) {
    return null;
  }
  return (
    <div {...rest} className={className} style={style} data-slider-pagination="">
      {Array.from({ length: carousel.paginationCount }).map((_, index) => {
        const current = index === carousel.currentPageIndex;
        const key = `dot-${index}`;
        if (renderDot) {
          return <span key={key}>{renderDot({ index, current })}</span>;
        }
        return (
          <span
            key={key}
            aria-hidden="true"
            className={dotClassName}
            style={dotStyle}
            data-slider-dot=""
            data-current={current ? 'true' : 'false'}
          />
        );
      })}
    </div>
  );
}

export default SliderPagination;
