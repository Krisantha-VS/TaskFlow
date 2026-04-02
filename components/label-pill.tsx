const COLOR_MAP: Record<string, string> = {
  blue:   'label-blue',
  green:  'label-green',
  red:    'label-red',
  yellow: 'label-yellow',
  purple: 'label-purple',
  pink:   'label-pink',
  orange: 'label-orange',
  gray:   'label-gray',
};

interface LabelPillProps {
  name: string;
  color: string;
  onRemove?: () => void;
  small?: boolean;
}

export function LabelPill({ name, color, onRemove, small }: LabelPillProps) {
  const cls = COLOR_MAP[color] ?? COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-medium ${small ? 'text-xs px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${cls}`}>
      {name}
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove label: ${name}`} className="hover:opacity-70 transition-opacity leading-none">×</button>
      )}
    </span>
  );
}
