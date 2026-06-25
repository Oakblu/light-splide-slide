import type { ReactNode } from "react";
import {
  Slider,
  SliderArrows,
  SliderPagination,
  SliderSlide,
  SliderTrack,
  useSliderContext,
} from "light-splide-slide";
// Optional baseline theme — drives the first demo. Remove this import and the
// arrows/dots render unstyled (headless), ready for your own CSS.
import "light-splide-slide/styles.css";

type Item = { id: number; label: string; hue: number };

const items: Item[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  label: `Slide ${i + 1}`,
  hue: (i * 36) % 360,
}));

function Card({ item }: { item: Item }) {
  return (
    <div className="card" style={{ background: `hsl(${item.hue} 70% 92%)` }}>
      <span
        className="card__index"
        style={{ color: `hsl(${item.hue} 60% 35%)` }}
      >
        {item.id}
      </span>
      <span className="card__label">{item.label}</span>
    </div>
  );
}

// A fully custom navigation built from the context — proves the slider is
// headless: arrows are turned off and we read state straight from useSliderContext.
function CustomNav() {
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

export default function App() {
  return (
    <main className="page">
      <header className="page__header">
        <h1>light-splide-slide</h1>
        <p>Headless, SSR-safe React slider — live Vite demo.</p>
      </header>

      <Demo
        title="1. Baseline theme"
        description="Arrows + dot pagination styled by the optional styles.css, fixed-width peeking cards."
      >
        <Slider
          aria-label="Baseline slider"
          options={{
            fixedWidth: "14rem",
            gap: "1rem",
            padding: { left: "1rem", right: "1rem" },
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
            gap: "1rem",
            mediaQuery: "max",
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
            grid: {
              dimensions: [[2, 3]],
              gap: { row: "0.75rem", col: "0.75rem" },
            },
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
          options={{ perPage: 2, gap: "1rem", arrows: false }}
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
    </main>
  );
}
