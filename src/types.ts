import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export enum NavigationAction {
  Next = 'next',
  Prev = 'prev',
}

export type SliderControl =
  | number
  | `${number}`
  | `+${number}`
  | `-${number}`
  | '>'
  | '<'
  | NavigationAction;

export type SliderPadding = { left?: string | number; right?: string | number };

export type SliderGrid = {
  gap?: { row?: string | number; col?: string | number };
  dimensions?: [number, number][];
};

export type SliderOptions = {
  arrows?: boolean;
  breakpoints?: Record<number, Partial<SliderOptions>>;
  drag?: boolean;
  fixedHeight?: string | number;
  fixedWidth?: string | number;
  gap?: string | number;
  grid?: SliderGrid;
  mediaQuery?: 'max' | 'min';
  padding?: SliderPadding | number | string;
  pagination?: boolean;
  perMove?: number;
  perPage?: number;
  type?: 'slide' | 'loop';
};

export type SliderEventMap = {
  moved: (index: number) => void;
};

export type SliderApi = {
  destroy: () => void;
  go: (control: SliderControl) => void;
  index: number;
  on: <E extends keyof SliderEventMap>(event: E, callback: SliderEventMap[E]) => () => void;
};

export type SliderContextValue = {
  canGoNext: boolean;
  canGoPrev: boolean;
  currentIndex: number;
  goTo: (control: SliderControl) => void;
  next: () => void;
  prev: () => void;
  options: SliderOptions;
  pageCount: number;
  paginationCount: number;
  currentPageIndex: number;
  registerScrollElement: (el: HTMLDivElement | null) => void;
  setPageCount: (count: number) => void;
};

export type SliderProps = Omit<HTMLAttributes<HTMLElement>, 'aria-label'> & {
  options?: SliderOptions;
  className?: string;
  style?: CSSProperties;
  'aria-label': string;
  children: ReactNode;
  onMounted?: (api: SliderApi) => void;
  onDestroy?: () => void;
};

export type SliderInjectedOptions = {
  /** Internal: resolved options injected by <Slider> into structural children. Not part of the public API. */
  __sliderOptions?: SliderOptions;
};
