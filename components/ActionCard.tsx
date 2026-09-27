interface ActionCardProps {
  title: string;
  description: string;
  badgeText?: string;
  onClick?: () => void;
}

export default function ActionCard({
  title,
  description,
  badgeText,
  onClick,
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 bg-white rounded-2xl border border-gray-200 shadow-sm active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {badgeText && (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
            {badgeText}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}
