import React from "react";

export function EnhancePage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="细节增强">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>细节增强</h1>
        <label className="feature-upload">
          <span>输入图片</span>
          <input type="file" accept="image/*" />
          <small>拖入或选择需要增强的图片</small>
        </label>
        <label className="feature-field">
          <span>增强程度</span>
          <input type="range" min="0" max="100" defaultValue="62" />
        </label>
        <label className="feature-field">
          <span>放大倍率</span>
          <select defaultValue="2x">
            <option>1x</option>
            <option>2x</option>
            <option>4x</option>
          </select>
        </label>
        <label className="feature-check">
          <input type="checkbox" defaultChecked />
          <span>保留原始构图</span>
        </label>
        <button className="feature-primary" type="button">
          开始增强
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-preview-frame feature-compare">
          <div>原图</div>
          <div>对比预览</div>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>增强记录管理</h2>
        <div className="feature-stat">
          <span>预览版本</span>
          <strong>0</strong>
        </div>
        <div className="feature-history-item">清晰度增强 · 待生成</div>
        <div className="feature-history-item">纹理保护 · 已启用</div>
      </aside>
    </section>
  );
}
