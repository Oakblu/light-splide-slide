import type { Item } from './data';

export function Card({ item }: { item: Item }) {
  return (
    <div className="card" style={{ background: `hsl(${item.hue} 70% 92%)` }}>
      <span className="card__index" style={{ color: `hsl(${item.hue} 60% 35%)` }}>
        {item.id}
      </span>
      <span className="card__label">{item.label}</span>
    </div>
  );
}
