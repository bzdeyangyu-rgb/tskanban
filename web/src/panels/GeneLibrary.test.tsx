import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GeneLibraryPopover } from "./GeneLibrary";
import { createPromptGene, createWorkflowGene } from "./geneLibraryModel";

describe("GeneLibraryPopover", () => {
  it("renders prompt and workflow genes in a three-column template grid", () => {
    const promptGene = createPromptGene("霓虹雨夜，赛博城市", [], "2026-05-22T09:00:00.000Z", "夜景提示词");
    const workflowGene = createWorkflowGene(
      {
        canvasId: "gene",
        nodes: [
          { id: "prompt", type: "prompt", x: 0, y: 0, width: 240, height: 160, data: {} },
          { id: "api", type: "api_text2img", x: 320, y: 0, width: 260, height: 180, data: {} },
          { id: "output", type: "output", x: 660, y: 0, width: 260, height: 180, data: {} }
        ],
        edges: [
          { id: "e1", from: "prompt", to: "api" },
          { id: "e2", from: "api", to: "output" }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      },
      [promptGene],
      "2026-05-22T09:02:00.000Z",
      "出图流程"
    );

    const html = renderToStaticMarkup(
      <GeneLibraryPopover
        geneScope="selection"
        genes={[promptGene, workflowGene]}
        onAddGene={() => undefined}
        onClose={() => undefined}
        onDeleteGene={() => undefined}
        onGeneScopeChange={() => undefined}
        onRenameGene={() => undefined}
        onUseGene={() => undefined}
      />
    );

    expect(html).toContain("基因库");
    expect(html).toContain("data-columns=\"3\"");
    expect(html).toContain("2 个基因");
    expect(html).toContain("1 提示词");
    expect(html).toContain("1 流程");
    expect(html).toContain("当前选中");
    expect(html).toContain("选中+输出");
    expect(html).toContain("全画布流程");
    expect(html).not.toContain("加输出");
    expect(html).toContain("夜景提示词");
    expect(html).toContain("生成提示词");
    expect(html).toContain("出图流程");
    expect(html).toContain("导入流程");
    expect(html).toContain("3 节点");
    expect(html).toContain("重命名");
    expect(html).toContain("删除");
    expect(html).toContain("添加基因");
    expect(html).toContain("导入流程");
  });
});
