import React from "react";

export function ImageEditPage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="图片编辑">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>图片编辑</h1>
        <label className="feature-field">
          <span>输入提示词</span>
          <textarea defaultValue="保留主体结构，替换背景为干净的室内展台" />
        </label>
        <label className="feature-upload">
          <span>参考图片</span>
          <input type="file" accept="image/*" />
          <small>可加入主图或风格参考</small>
        </label>
        <button className="feature-secondary" type="button">
          遮罩入口
        </button>
        <label className="feature-field">
          <span>参考权重</span>
          <input type="range" min="0" max="100" defaultValue="65" />
        </label>
        <button className="feature-primary" type="button">
          提交编辑
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-preview-frame">
          <span>编辑预览</span>
          <small>遮罩区域和生成结果会显示在这里</small>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>图片编辑管理</h2>
        <div className="feature-stat">
          <span>参考素材</span>
          <strong>1</strong>
        </div>
        <div className="feature-history-item">遮罩草稿 · 未绘制</div>
        <div className="feature-history-item">编辑版本 · v0</div>
      </aside>
    </section>
  );
}
