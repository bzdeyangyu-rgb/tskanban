import React from "react";

const templates = ["商品棚拍", "电影感场景", "角色设定"];

export function TextToImagePage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="文生图">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>文生图</h1>
        <label className="feature-field">
          <span>输入提示词</span>
          <textarea defaultValue="一张干净的产品主图，柔和侧光，真实材质，高级灰背景" />
        </label>
        <div className="feature-row">
          <label className="feature-field">
            <span>尺寸</span>
            <select defaultValue="1024x1024">
              <option>1024x1024</option>
              <option>1024x1536</option>
              <option>1536x1024</option>
            </select>
          </label>
          <label className="feature-field">
            <span>批量</span>
            <input type="number" min="1" max="8" defaultValue="4" />
          </label>
        </div>
        <div className="feature-template-list" aria-label="提示词模板">
          <strong>提示词模板</strong>
          {templates.map((item) => (
            <button type="button" key={item}>
              {item}
            </button>
          ))}
        </div>
        <button className="feature-primary" type="button">
          生成预览
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-preview-frame">
          <div className="feature-preview-grid">
            <span>生成预览</span>
            <span>版本 A</span>
            <span>版本 B</span>
            <span>版本 C</span>
          </div>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>版本管理</h2>
        <div className="feature-stat">
          <span>当前版本</span>
          <strong>v0</strong>
        </div>
        <div className="feature-stat">
          <span>批量队列</span>
          <strong>4 张</strong>
        </div>
        <div className="feature-history-item">草稿提示词 · 未提交</div>
        <div className="feature-history-item">模板收藏 · 3 个</div>
      </aside>
    </section>
  );
}
