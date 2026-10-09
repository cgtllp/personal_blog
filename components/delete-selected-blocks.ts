import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";

type BlockRange = {
  from: number;
  to: number;
  list?: { from: number; to: number; itemCount: number };
};

function completeBlockRanges(state: EditorState): BlockRange[] | null {
  const { selection, doc } = state;
  if (!(selection instanceof TextSelection) || selection.empty) return null;

  const ranges: BlockRange[] = [];
  let hasPartialBlock = false;
  let hasUnsupportedNode = false;

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    if (node.isTextblock) {
      const contentFrom = pos + 1;
      const contentTo = pos + node.nodeSize - 1;
      if (selection.from > contentFrom || selection.to < contentTo) {
        hasPartialBlock = true;
        return false;
      }

      const resolved = doc.resolve(contentFrom);
      let range: BlockRange = { from: pos, to: pos + node.nodeSize };
      for (let depth = resolved.depth - 1; depth > 0; depth--) {
        const parent = resolved.node(depth);
        const name = parent.type.name;
        if (name === "table" || name === "tableRow" || name === "tableCell" || name === "tableHeader") {
          hasUnsupportedNode = true;
          break;
        }
        if (name === "listItem" || name === "taskItem" || name === "blockquote") {
          // A nested list or multi-paragraph quote has more content than the selected line.
          if (parent.childCount !== 1) {
            hasUnsupportedNode = true;
            break;
          }
          range = { from: resolved.before(depth), to: resolved.after(depth) };
          if (name === "listItem" || name === "taskItem") {
            const listDepth = depth - 1;
            range.list = {
              from: resolved.before(listDepth),
              to: resolved.after(listDepth),
              itemCount: resolved.node(listDepth).childCount,
            };
          }
          break;
        }
      }
      ranges.push(range);
      return false;
    }

    // Let ProseMirror handle mixed selections containing images, rules, or tables.
    if (node.isAtom && !node.isText) hasUnsupportedNode = true;
    return true;
  });

  if (hasPartialBlock || hasUnsupportedNode || ranges.length === 0) return null;

  // Removing the final item directly would make ProseMirror restore an empty
  // item to keep the list valid. Remove its container when every item is selected.
  const listGroups = new Map<number, { list: NonNullable<BlockRange["list"]>; selected: number }>();
  for (const range of ranges) {
    if (!range.list) continue;
    const group = listGroups.get(range.list.from);
    if (group) group.selected++;
    else listGroups.set(range.list.from, { list: range.list, selected: 1 });
  }
  const completeLists = new Set(
    [...listGroups].filter(([, group]) => group.selected === group.list.itemCount).map(([from]) => from),
  );
  const result = ranges.filter(range => !range.list || !completeLists.has(range.list.from));
  for (const from of completeLists) {
    const list = listGroups.get(from)!.list;
    result.push({ from: list.from, to: list.to });
  }
  return result.sort((a, b) => b.from - a.from);
}

function emptiedListItemRange(state: EditorState, key: "Backspace" | "Delete"): BlockRange[] | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || selection.$from.parent !== selection.$to.parent) return null;

  const paragraph = selection.$from.parent;
  if (paragraph.type.name !== "paragraph") return null;
  let hasNonTextContent = false;
  paragraph.forEach(child => { if (!child.isText) hasNonTextContent = true; });
  if (hasNonTextContent) return null;

  const text = paragraph.textContent;
  let from = selection.$from.parentOffset;
  let to = selection.$to.parentOffset;
  if (selection.empty && key === "Backspace" && from > 0) {
    from -= Array.from(text.slice(0, from)).at(-1)?.length ?? 0;
  } else if (selection.empty && key === "Delete" && to < text.length) {
    to += Array.from(text.slice(to))[0]?.length ?? 0;
  }
  if ((text.slice(0, from) + text.slice(to)).trim()) return null;

  const resolved = selection.$from;
  for (let depth = resolved.depth - 1; depth > 0; depth--) {
    const parent = resolved.node(depth);
    if (parent.type.name !== "listItem" && parent.type.name !== "taskItem") continue;
    if (parent.childCount !== 1) return null;
    const listDepth = depth - 1;
    const list = resolved.node(listDepth);
    const targetDepth = list.childCount === 1 ? listDepth : depth;
    return [{ from: resolved.before(targetDepth), to: resolved.after(targetDepth) }];
  }
  return null;
}

export const DeleteSelectedBlocks = Extension.create({
  name: "deleteSelectedBlocks",
  priority: 1001,
  addKeyboardShortcuts() {
    const deleteBlocks = (key: "Backspace" | "Delete") => {
      const { state, view } = this.editor;
      const ranges = completeBlockRanges(state) ?? emptiedListItemRange(state, key);
      if (!ranges) return false;

      let transaction = state.tr;
      for (const range of ranges) transaction = transaction.delete(range.from, range.to);
      view.dispatch(transaction.scrollIntoView());
      return true;
    };
    return {
      Backspace: () => deleteBlocks("Backspace"),
      Delete: () => deleteBlocks("Delete"),
    };
  },
});
