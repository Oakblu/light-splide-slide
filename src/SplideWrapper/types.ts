import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { CarouselOptions } from '../carousel-context';

export enum CarouselNavigationAction {
  Next = 'next',
  Prev = 'prev',
}

export type CarouselControl =
  | number
  | `${number}`
  | `+${number}`
  | `-${number}`
  | '>'
  | '<'
  | CarouselNavigationAction;

export type SplideImperativeApi = {
  destroy: () => void;
  go: (control: CarouselControl) => void;
  index: number;
  on: (event: string, callback: (newIndex: number) => void) => () => void;
};

export type SplideWrapperProps = Omit<HTMLAttributes<HTMLDivElement>, 'aria-label' | 'children'> & {
  options?: CarouselOptions;
  className?: string;
  style?: CSSProperties;
  hasTrack?: boolean;
  'aria-label': string;
  children: ReactNode;
  extensions?: Record<string, unknown>;
  onMounted?: (splide: SplideImperativeApi) => void;
  onDestroy?: () => void;
};
