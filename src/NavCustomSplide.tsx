'use client';

import { twMerge } from 'tailwind-merge';

import { useCarouselContext } from './carousel-context';
import IconArrowRight from './icons/IconArrowRight';

function NavCustomSplide({
  alwaysNavLR = false,
  onPrev,
  onNext,
  prevButtonClassName,
  nextButtonClassName,
  prevButtonTestId,
  nextButtonTestId,
}: {
  alwaysNavLR?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  prevButtonClassName?: string;
  nextButtonClassName?: string;
  prevButtonTestId?: string;
  nextButtonTestId?: string;
}) {
  const carousel = useCarouselContext();
  const handlePrev = onPrev ?? carousel?.prev;
  const handleNext = onNext ?? carousel?.next;
  const canGoPrev = onPrev ? true : (carousel?.canGoPrev ?? false);
  const canGoNext = onNext ? true : (carousel?.canGoNext ?? false);
  const arrowsEnabled = carousel?.options.arrows ?? true;
  const hideArrowsOnMobile = carousel?.hideArrowsOnMobile ?? false;
  const topNavigation = carousel?.topNavigation ?? false;

  if (!arrowsEnabled && !onPrev && !onNext) {
    return null;
  }

  return (
    <div
      className={twMerge(
        'pointer-events-none absolute inset-x-0 top-1/2 z-2',
        topNavigation && 'md:right-0 md:left-auto md:top-[-55px] md:flex md:items-center',
        hideArrowsOnMobile && !topNavigation && 'hidden md:block',
        hideArrowsOnMobile && topNavigation && 'hidden md:flex'
      )}
    >
      <button
        className={twMerge(
          'pointer-events-auto absolute opacity-75 hover:opacity-100 top-1/2 left-0 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center border-0 bg-arsenic p-0 text-white',
          'rounded-r-lg [&>svg]:h-[1em] [&>svg]:w-[1em] [&>svg]:fill-none focus:outline-none',
          topNavigation &&
            'md:static md:top-0 md:h-9 md:w-9 md:translate-y-0 md:rounded-l md:rounded-r-none md:border md:border-r-0 md:border-raven md:bg-white md:text-raven',
          prevButtonClassName,
          !alwaysNavLR && 'disabled:!opacity-0'
        )}
        type="button"
        onClick={handlePrev}
        data-testid={prevButtonTestId}
        disabled={!canGoPrev}
        aria-label="Previous slide"
      >
        <IconArrowRight className="rotate-180 !transform-none" />
      </button>
      <button
        className={twMerge(
          'pointer-events-auto absolute opacity-75 hover:opacity-100 top-1/2 right-0 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center border-0 bg-arsenic p-0 text-white',
          'rounded-l-lg [&>svg]:h-[1em] [&>svg]:w-[1em] [&>svg]:fill-none focus:outline-none',
          topNavigation &&
            'md:static md:top-0 md:ml-[-1px] md:h-9 md:w-9 md:translate-y-0 md:rounded-r md:rounded-l-none md:border md:border-raven md:bg-white md:text-raven',
          nextButtonClassName,
          !alwaysNavLR && 'disabled:!opacity-0'
        )}
        type="button"
        onClick={handleNext}
        data-testid={nextButtonTestId}
        disabled={!canGoNext}
        aria-label="Next slide"
      >
        <IconArrowRight />
      </button>
    </div>
  );
}

export default NavCustomSplide;
