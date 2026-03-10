const COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  green:  'bg-green-500/15 text-green-400 border-green-500/30',
  red:    'bg-red-500/15 text-red-400 border-red-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  pink:   'bg-pink-500/15 text-pink-400 border-pink-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  gray:   'bg-gray-500/15 text-gray-400 border-gray-500/30',
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
    <span className={`inline-flex items-center gap-1 border rounded-full font-medium ${small ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${cls}`}>
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 transition-opacity leading-none">×</button>
      )}
    </span>
  );
}
