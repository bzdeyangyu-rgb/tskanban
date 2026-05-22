# Gene Library Design

## Goal

Replace the current `MS生成` canvas toolbar entry with `基因库`. This is not a ModelScope/MoTa generator and should not create an `api_img2img` node directly. It is a reusable template library for prompts first, and saved workflows later.

## User-Facing Behavior

The infinite canvas top-right toolbar shows `基因库` instead of `MS生成`. Clicking it opens a compact gene-library panel using the same visual language as the toolbar: dark surface, pill buttons, icon plus text, and tight spacing.

The panel contains saved gene buttons. Each prompt gene is shown as a small icon button with a short name. The bottom of the panel has a fixed `添加基因` action.

When the user clicks `添加基因`, the app captures prompt text using this rule:

1. Prefer the currently selected prompt node.
2. If no prompt node is selected, use the newest prompt node on the canvas.
3. If no prompt text exists, show a status message asking the user to create or select a prompt node first.

When the user clicks a prompt gene, the app creates a new prompt node on the canvas with the saved prompt text. The node should appear in the current working area, using the same node creation style as other toolbar-created nodes.

## Data Model

The first implementation stores genes locally in browser storage. It should not require a backend migration.

```ts
type GeneTemplate =
  | {
      id: string;
      type: "prompt";
      name: string;
      prompt: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "workflow";
      name: string;
      snapshot: CanvasSnapshot;
      createdAt: string;
    };
```

First release only exposes `prompt` genes. `workflow` genes are included in the shape so the next release can save a selected flow or whole canvas snapshot without changing storage.

Storage key: `tshuabu:geneLibrary`.

## Component Plan

Add a `GeneLibraryPopover` near the canvas toolbar in `App.tsx`, or extract it into `web/src/panels/GeneLibrary.tsx` if the JSX grows. It receives:

- `genes`
- `onAddGene`
- `onUseGene`
- `onClose`

`App.tsx` owns persistence and coordinates with `ReferenceCanvas` through the existing ref. `ReferenceCanvas` needs one new handle method for prompt capture:

```ts
promptGeneSource(): { prompt: string; sourceNodeId: string } | undefined;
```

This method follows the selected-prompt-then-newest-prompt rule. It keeps the selection logic inside the canvas where node state already lives.

Using a gene calls the existing `nodeDefinition("prompt")`, overrides `data.text`, then calls `canvas.addNode`.

## Visual Rules

The `基因库` toolbar button should sit where `MS生成` is today. The popover should feel like part of the current reference UI:

- Dark surface and subtle border.
- Pill-like gene buttons matching the toolbar button rhythm.
- No large cards.
- Bottom `添加基因` button fixed inside the popover.
- Empty state is short and functional: `还没有基因`.

## Non-Goals For First Release

- No ModelScope/MoTa behavior.
- No ComfyUI integration.
- No backend persistence.
- No workflow export/import UI yet.
- No editing, renaming, or deleting genes in the first pass unless it becomes necessary during QA.

## Testing

Add focused tests for the pure gene helpers:

- Load/save genes from local storage fallback.
- Create a prompt gene name when no custom name exists.
- Use selected prompt before newest prompt.

Manual browser verification:

- Toolbar shows `基因库` and no `MS生成`.
- Empty popover shows `添加基因`.
- Adding a gene from a selected prompt creates a saved gene button.
- Clicking the gene creates a prompt node with the same text.

