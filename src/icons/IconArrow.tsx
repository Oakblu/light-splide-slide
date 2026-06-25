import type { CSSProperties } from 'react';

export function IconArrow({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={style}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
    >
      <path
        fill="currentColor"
        d="M19.692 61.538c-1.477 0-2.462 0-3.446-1.477-1.969-1.969-1.969-4.923 0-6.892l21.169-21.169-21.169-21.169c-1.969-1.969-1.969-4.923 0-6.892s4.923-1.969 6.892 0l24.615 24.615c1.969 1.969 1.969 4.923 0 6.892l-24.615 24.615c-0.985 0.985-2.462 1.477-3.446 1.477z"
      />
    </svg>
  );
}

export default IconArrow;
