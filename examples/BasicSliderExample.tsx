'use client';
import { Slider, SliderArrows, SliderPagination, SliderSlide, SliderTrack } from '../src';

const categories = [
  { id: 1, title: 'Small prices' },
  { id: 2, title: 'Family' },
  { id: 3, title: 'Electric' },
  { id: 4, title: 'Luxury' },
];

/**
 * Minimal example using className-based styling (works with any CSS class system).
 * No Tailwind required — swap classNames for your own CSS.
 */
export function BasicSliderExample() {
  return (
    <Slider
      aria-label="Categories"
      options={{
        perPage: 1,
        fixedWidth: '14rem',
        gap: '1rem',
        pagination: true,
        padding: { left: '1rem', right: '1rem' },
      }}
    >
      <SliderArrows />
      <SliderTrack>
        {categories.map((c) => (
          <SliderSlide key={c.id}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>{c.title}</div>
          </SliderSlide>
        ))}
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
}

/**
 * Inline-style variant — demonstrates the slider works with no CSS dependency at all.
 */
export function InlineStyleSliderExample() {
  return (
    <Slider
      aria-label="Categories (inline styles)"
      style={{ maxWidth: '40rem', margin: '0 auto' }}
      options={{
        perPage: 2,
        gap: '0.75rem',
        arrows: true,
        pagination: true,
      }}
    >
      <SliderArrows />
      <SliderTrack>
        {categories.map((c) => (
          <SliderSlide key={c.id}>
            <div
              style={{
                padding: '1rem',
                background: '#f5f5f5',
                borderRadius: 6,
                textAlign: 'center',
              }}
            >
              {c.title}
            </div>
          </SliderSlide>
        ))}
      </SliderTrack>
      <SliderPagination />
    </Slider>
  );
}

export default BasicSliderExample;
