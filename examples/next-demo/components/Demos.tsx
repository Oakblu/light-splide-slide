'use client';
import {
  Slider,
  SliderArrows,
  SliderPagination,
  SliderSlide,
  SliderTrack,
} from 'light-splide-slide';
import type { ReactNode } from 'react';
import { Card } from './Card';
import { CustomNav } from './CustomNav';
import { items } from './data';

function Demo({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="demo">
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}

// The whole interactive surface, reused verbatim by the App Router (app/page.tsx)
// and the Pages Router (pages/pages-router.tsx). Because the library returns null
// from getServerSnapshot, the server and first-client markup are identical in
// both — no hydration mismatch.
export function Demos() {
  return (
    <>
      <Demo
        title="1. Baseline theme"
        description="Arrows + dot pagination styled by the optional styles.css, fixed-width peeking cards."
      >
        <Slider
          aria-label="Baseline slider"
          options={{
            fixedWidth: '14rem',
            gap: '1rem',
            padding: { left: '1rem', right: '1rem' },
            pagination: true,
          }}
        >
          <SliderArrows />
          <SliderTrack>
            {items.map((item) => (
              <SliderSlide key={item.id}>
                <Card item={item} />
              </SliderSlide>
            ))}
          </SliderTrack>
          <SliderPagination />
        </Slider>
      </Demo>

      <Demo
        title="2. Responsive perPage (your own CSS)"
        description="3 per page on desktop, 1 on narrow screens via breakpoints. Arrows styled through className — no baseline CSS."
      >
        <Slider
          aria-label="Responsive slider"
          options={{
            perPage: 3,
            gap: '1rem',
            mediaQuery: 'max',
            breakpoints: { 640: { perPage: 1 } },
          }}
        >
          <SliderArrows
            className="myarrows"
            prevClassName="myarrows__btn myarrows__btn--prev"
            nextClassName="myarrows__btn myarrows__btn--next"
          />
          <SliderTrack>
            {items.map((item) => (
              <SliderSlide key={item.id}>
                <Card item={item} />
              </SliderSlide>
            ))}
          </SliderTrack>
        </Slider>
      </Demo>

      <Demo
        title="3. Grid pages"
        description="grid.dimensions = [[2, 3]] → 2 rows × 3 columns = 6 items per page."
      >
        <Slider
          aria-label="Grid slider"
          options={{
            grid: { dimensions: [[2, 3]], gap: { row: '0.75rem', col: '0.75rem' } },
            pagination: true,
          }}
        >
          <SliderArrows />
          <SliderTrack>
            {items.map((item) => (
              <SliderSlide key={item.id}>
                <Card item={item} />
              </SliderSlide>
            ))}
          </SliderTrack>
          <SliderPagination />
        </Slider>
      </Demo>

      <Demo
        title="4. Fully custom controls (headless)"
        description="Built-in arrows disabled; navigation rendered from useSliderContext()."
      >
        <Slider
          aria-label="Custom-controls slider"
          options={{ perPage: 2, gap: '1rem', arrows: false }}
        >
          <CustomNav />
          <SliderTrack>
            {items.map((item) => (
              <SliderSlide key={item.id}>
                <Card item={item} />
              </SliderSlide>
            ))}
          </SliderTrack>
        </Slider>
      </Demo>
    </>
  );
}
