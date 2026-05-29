import React from "react";

export function OnlineImagePage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="在线生图">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>在线生图</h1>
        <div className="feature-row">
          <label className="feature-field">
            <span>供应商</span>
            <select defaultValue="默认供应商">
              <option>默认供应商</option>
              <option>备用供应商</option>
            </select>
          </label>
          <label className="feature-field">
            <span>模型</span>
            <select defaultValue="gpt-image-2">
              <option>gpt-image-2</option>
              <option>nano-banana-pro</option>
            </select>
          </label>
        </div>
        <label className="feature-field">
          <span>提示词</span>
          <textarea defaultValue="生成一张适合电商展示的干净图片" />
        </label>
        <label className="feature-field">
          <span>尺寸</span>
          <select defaultValue="1:1 方图">
            <option>1:1 方图</option>
            <option>2:3 竖图</option>
            <option>16:9 宽屏</option>
          </select>
        </label>
        <button className="feature-primary" type="button">
          在线生成
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-preview-frame">
          <span>在线结果</span>
          <small>供应商返回的图片会显示在这里</small>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>历史</h2>
        <div className="feature-stat">
          <span>在线任务</span>
          <strong>0</strong>
        </div>
        <div className="feature-history-item">最近生成 · 暂无</div>
        <div className="feature-history-item">收藏提示词 · 0 条</div>
      </aside>
    </section>
  );
}
