import type { CSSProperties } from 'react';

export function IconArrow({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={style}
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
    >
      <path fill="currentColor" d="M22 12 46 32 22 52z" />
    </svg>
  );
}

export default IconArrow;
