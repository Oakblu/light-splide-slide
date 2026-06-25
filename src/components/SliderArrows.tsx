'use client';
import type { CSSProperties, ReactNode } from 'react';
import { IconArrow } from '../icons/IconArrow';
import { useSliderContext } from '../slider-context';

type RenderButton = (p: { disabled: boolean; onClick: () => void }) => ReactNode;

type SliderArrowsProps = {
  className?: string;
  style?: CSSProperties;
  prevClassName?: string;
  nextClassName?: string;
  prevStyle?: CSSProperties;
  nextStyle?: CSSProperties;
  prevLabel?: string;
  nextLabel?: string;
  placement?: 'default' | 'top';
  hideOnMobile?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  renderPrev?: RenderButton;
  renderNext?: RenderButton;
};

const noop = () => {};

export function SliderArrows({
  className,
  style,
  prevClassName,
  nextClassName,
  prevStyle,
  nextStyle,
  prevLabel = 'Previous slide',
  nextLabel = 'Next slide',
  placement = 'default',
  hideOnMobile = false,
  onPrev,
  onNext,
  renderPrev,
  renderNext,
}: SliderArrowsProps) {
  const carousel = useSliderContext();
  const arrowsEnabled = carousel?.options.arrows ?? true;
  if (!arrowsEnabled && !onPrev && !onNext) {
    return null;
  }
  const handlePrev = onPrev ?? carousel?.prev ?? noop;
  const handleNext = onNext ?? carousel?.next ?? noop;
  const canPrev = onPrev ? true : (carousel?.canGoPrev ?? false);
  const canNext = onNext ? true : (carousel?.canGoNext ?? false);

  return (
    <div
      className={className}
      style={style}
      data-slider-arrows=""
      data-placement={placement}
      data-hide-on-mobile={hideOnMobile ? 'true' : 'false'}
    >
      {renderPrev ? (
        renderPrev({ disabled: !canPrev, onClick: handlePrev })
      ) : (
        <button
          type="button"
          aria-label={prevLabel}
          className={prevClassName}
          style={prevStyle}
          data-direction="prev"
          data-disabled={canPrev ? 'false' : 'true'}
          disabled={!canPrev}
          onClick={handlePrev}
        >
          <IconArrow style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      {renderNext ? (
        renderNext({ disabled: !canNext, onClick: handleNext })
      ) : (
        <button
          type="button"
          aria-label={nextLabel}
          className={nextClassName}
          style={nextStyle}
          data-direction="next"
          data-disabled={canNext ? 'false' : 'true'}
          disabled={!canNext}
          onClick={handleNext}
        >
          <IconArrow />
        </button>
      )}
    </div>
  );
}

export default SliderArrows;
