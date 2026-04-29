import type { PendingSelection } from "../hooks/useSelectionTracker.js";

interface SelectionAddButtonProps {
  selection: PendingSelection;
  onAdd: () => void;
}

/**
 * Floating "+" button positioned above a text selection. Click adds
 * the selection to the event feed.
 */
export function SelectionAddButton({
  selection,
  onAdd,
}: SelectionAddButtonProps) {
  const { rect } = selection;
  const top = rect.top + window.scrollY - 40;
  const left = rect.left + rect.width / 2 + window.scrollX;

  return (
    <button
      onMouseDown={(e) => {
        // Prevent the selection from being cleared before our click fires.
        e.preventDefault();
      }}
      onClick={onAdd}
      className="absolute z-50 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow-lg transition-colors"
      style={{ top, left }}
      title="Add selection to notes"
    >
      <span className="text-base leading-none">+</span>
      <span>Add</span>
    </button>
  );
}
