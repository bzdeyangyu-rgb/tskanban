# Phase One Visual Closure Design

## Goal

Bring the completed phase-one implementation to an acceptance-ready state by filling the missing workflow loop while visually aligning the canvas experience with `references/Infinite-Canvas`.

This is not phase two. The scope is limited to the first-stage MVP: import images, compose a small node flow, run image API nodes, see results in the canvas, preserve versions, and write RAG-ready trace data.

## Source Material

- Root development plan (`开发计划.md`): prioritizes a stable local image workstation loop with durable logs and replayable outputs.
- `SPEC.md`: defines the current MVP acceptance criteria for node canvas, image import, generation, inpaint, version retention, failure feedback, export, and RAG fields.
- `references/Infinite-Canvas`: provides the mature visual and interaction reference. Its single-file implementation is a product reference, not code to copy directly.
- `anli/PixPin_2026-05-18_19-03-36.png` and `anli/PixPin_2026-05-18_19-04-34.png`: confirm the desired dark dotted canvas, floating panels, node cards, curved links, and output-node behavior.

## Design Decision

Use a focused **A+ path**:

1. Preserve the current React, TypeScript, Vite, tldraw, Express, Zod, session, asset, and logger architecture.
2. Fill only the phase-one acceptance gaps found in review.
3. Adopt the reference project's visual language for the shell, nodes, inputs, output node, run states, and failure feedback.
4. Do not implement full ComfyUI, LLM, loop, video, LoRA, or marketplace behavior in this pass.

## Visual Direction

The phase-one canvas should look and feel close to the reference project:

- Full-screen dark canvas with subtle dotted grid.
- Floating project/title pill near the top.
- Left-side asset/import panel inspired by the reference local material panel.
- Compact vertical tool rail for import, select/connect, history, save, and export actions.
- Right/top compact controls for zoom, theme, API settings, save/load, and run status.
- Floating bottom or side run/status bar only when it helps execution feedback.
- Node cards use dark panels, soft borders, shadow, 16-22px radius, and compact typography.

The implementation should not paste the reference CSS wholesale. Extract the useful tokens and patterns into our `web/styles.css` and React components.

## Node Model

Phase one supports the existing node kinds:

- `image`
- `prompt`
- `api_text2img`
- `api_img2img`
- `api_inpaint`
- `output`
- `video` may remain visible only if already present, but it is not part of phase-one acceptance.

Node cards should follow the reference structure:

- Header: title, type, status badge.
- Body: node-specific content.
- Ports/connection affordance: clear input and output handles or tldraw arrow binding guidance.
- Failure area: compact retry/error bar when a node fails.

Minimum visual behavior:

- `image` node shows image thumbnail, role tag, and missing-image drop zone.
- `prompt` node shows editable prompt text.
- API nodes show model/provider, upstream image thumbnails when present, prompt source summary, and run status.
- `output` node shows generated outputs in a thumbnail grid.

## Import Flow

The primary user path must not require manually typing asset IDs.

Supported input methods:

- File picker from the asset/import panel.
- Drag-and-drop image onto the canvas.
- Ctrl+V paste from clipboard.

Each successful import:

1. Calls `POST /api/upload`.
2. Creates or reuses the active session.
3. Creates an `image` node at the canvas drop/paste location or selected insertion point.
4. Stores `assetId`, `url`, `name`, `mime`, `roleTag`, and optional caption in node data.
5. Shows the thumbnail immediately.

Manual `Asset ID` editing may remain as an advanced fallback, but it is not the main workflow.

## Run And Output Flow

Running a flow should behave as a single coherent canvas operation:

1. Compile the tldraw shapes into `CanvasSnapshot`.
2. Save the canvas snapshot before execution.
3. Execute through `POST /api/flows/execute`.
4. Update node statuses from the execution result.
5. Write generated assets into the connected `output` node's data.
6. Render output thumbnails inside the `output` node.
7. Preserve the option to add loose image shapes later, but the acceptance path is the output node grid.

If the flow has no output node, the UI should create one near the last executable node before or after execution, then connect or associate results with it.

## Persistence

Canvas persistence is part of execution, not a separate optional user habit.

On every flow run:

- `logs/canvases/<canvasId>.json` is written with the latest nodes, edges, viewport, selection, title, and session id.
- The session run record stores the same snapshot or a snapshot reference.
- Version records include `sourceRunId`, `sourceNodeId`, and enough parent asset information to trace lineage.

The manual save/load controls remain useful, but acceptance must not depend on pressing Save before Run.

## RAG Trace Contract

`rag_events.jsonl` must support reconstructing a real canvas run.

Extend flow execution events with stable fields:

- `canvas_id`
- `canvas_snapshot_path`
- `target_node_id`
- `run_id`
- `node_id`
- `node_type`
- `node_status`
- `node_inputs`
- `input_assets`
- `output_assets`
- `retry_attempt`
- `max_retries`
- `node_latency_ms`
- `selection_box`
- `local_prompt`

The route may write one aggregate `flow_execute` event plus node-level events, or node-level events only if they carry the full run linkage. The preferred design is:

- One aggregate event for the run summary.
- One event per executable node attempt/result.

Field names should be stable because logs are long-term assets.

## Failure Feedback

Failure behavior should match the SPEC:

- API node retries up to three times when the API call throws or returns an error.
- The flow stops at the failed node.
- The failed node receives `failed` status.
- The node card displays a compact error summary.
- The run panel or status pill displays the failed node id and message.
- RAG logs include failed attempts.

The UI should avoid modal interruptions for normal API failures.

## Export

Phase-one export means exporting the currently selected output image.

Accepted behavior:

- If an output thumbnail is selected, export/download that asset URL.
- If an output node is selected and has outputs, export the latest or visibly selected output.
- If no result is selected, show a concise status message instead of opening an empty download.

## Out Of Scope

The following remain out of this supplement:

- Full reference-app feature parity.
- ComfyUI workflow import/execution.
- LLM image understanding node.
- Loop/concurrent generation.
- Video generation completion.
- Multi-canvas library management beyond current save/load.
- Full brush editing and mask authoring UI, except preserving existing `selection_box` and `maskAssetId` paths.

## Acceptance Criteria

The supplement is complete when:

1. User can import a jpg/png by file picker, drag/drop, and paste, and each import creates a visible image node with an asset id.
2. User can create a prompt, API node, and output node, connect them, and run the flow.
3. Running the flow automatically saves the canvas snapshot.
4. Generated assets appear inside the output node grid.
5. Session versions and run records preserve source run, source node, parent assets, and output assets.
6. `rag_events.jsonl` contains canvas id, run id, flow structure, node inputs, output assets, latency, and failure details.
7. Failed API execution marks the node as failed, shows the error summary, and stops the flow after at most three attempts.
8. The canvas shell and node cards visually align with the reference project's dark dotted canvas and floating-panel style.
9. `npm test -- --run` and `npm run build` pass.

## Design Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Scope check: this is a single phase-one supplement, not a phase-two feature set.
- Consistency check: visual reference is reused as direction while implementation remains in the current React/tldraw architecture.
- Ambiguity check: output acceptance is explicitly the output node grid, not loose canvas images.
