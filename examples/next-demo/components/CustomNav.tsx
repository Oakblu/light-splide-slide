'use client';
import { useSliderContext } from 'light-splide-slide';

// Fully custom navigation built from the slider context — proves the slider is
// headless: built-in arrows are turned off and state is read straight from
// useSliderContext(). Renders null when used outside a <Slider> provider.
export function CustomNav() {
  const slider = useSliderContext();
  if (!slider) {
    return null;
  }
  return (
    <div className="custom-nav">
      <button type="button" onClick={slider.prev} disabled={!slider.canGoPrev}>
        ‹ Prev
      </button>
      <span className="custom-nav__count">
        {slider.currentPageIndex + 1} / {slider.paginationCount}
      </span>
      <button type="button" onClick={slider.next} disabled={!slider.canGoNext}>
        Next ›
      </button>
    </div>
  );
}
