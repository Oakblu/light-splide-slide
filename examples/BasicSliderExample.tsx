'use client';

/**
 * Self-contained usage example for the slider package.
 *
 * It depends ONLY on the slider itself (and React) — no app-specific code
 * (next-intl, next/image, routing, config). This mirrors how the slider is
 * used in the original `MostFrequentlyUsedSearches` component, but stripped
 * down so it works in any React project.
 *
 * Styling relies on Tailwind utility classes. If you don't use Tailwind,
 * replace the className strings with your own CSS — the slider works either way.
 */

import { NavCustomSplide, SplideSlide, SplideTrack, SplideWrapper } from '../src';

const categories = [
  { id: 1, img: '/categories/petitprix.png', title: 'Small prices', description: 'Up to €7,500' },
  { id: 2, img: '/categories/familiale.png', title: 'Family', description: '5 seats and more' },
  { id: 3, img: '/categories/electrique.png', title: 'Electric', description: 'Electric & hybrid' },
  { id: 4, img: '/categories/luxe.png', title: 'Luxury', description: 'From €100,000' },
  { id: 5, img: '/categories/neuve.png', title: 'New', description: 'Under 1,000 km' },
  { id: 6, img: '/categories/cabrio.png', title: 'Convertibles', description: 'Top down' },
];

export function BasicSliderExample() {
  return (
    <div className="bg-white shadow-lg rounded-lg overflow-clip">
      <div className="grid grid-cols-1 py-6">
        <SplideWrapper
          hasTrack={false}
          aria-label="Most frequently used searches"
          className="splide h-full"
          options={{
            type: 'slide',
            drag: true,
            pagination: false,
            lazyLoad: 'sequential',
            focus: 0,
            omitEnd: true,
            fixedWidth: '14rem',
            padding: { left: '1rem', right: '1rem' },
            gap: '1rem',
            mediaQuery: 'min',
            breakpoints: {
              375: {
                fixedWidth: '15rem',
                padding: { left: '1.5rem', right: '1.5rem' },
                gap: '1rem',
              },
            },
          }}
        >
          <NavCustomSplide />
          <SplideTrack className="h-full">
            {categories.map((category) => (
              <SplideSlide key={category.id}>
                <a
                  href={`/search?category=${category.id}`}
                  rel="noopener noreferrer"
                  className="bg-aliceBlue rounded-lg border border-slate-300 hover:border-raven flex flex-col px-4 pb-4"
                >
                  {/* Plain <img> keeps the example framework-agnostic. */}
                  <img
                    src={category.img}
                    alt={category.title}
                    className="w-[160px] h-30 mx-auto"
                    width={160}
                    height={120}
                    loading="lazy"
                  />
                  <span className="text-center space-y-1">
                    <h3 className="text-base font-semibold text-blackPearl">{category.title}</h3>
                    <p className="text-sm font-normal text-raven">{category.description}</p>
                  </span>
                </a>
              </SplideSlide>
            ))}
          </SplideTrack>
        </SplideWrapper>
      </div>
    </div>
  );
}

export default BasicSliderExample;
