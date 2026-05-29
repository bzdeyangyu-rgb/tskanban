import React from "react";

export function AngleControlPage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="角度控制">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>角度控制</h1>
        <label className="feature-upload">
          <span>输入图片</span>
          <input type="file" accept="image/*" />
          <small>上传需要改变视角的图片</small>
        </label>
        <div className="feature-control-box">
          <strong>相机控制</strong>
          <label className="feature-field">
            <span>水平旋转</span>
            <input type="range" min="-90" max="90" defaultValue="35" />
          </label>
          <label className="feature-field">
            <span>俯仰角度</span>
            <input type="range" min="-45" max="45" defaultValue="8" />
          </label>
        </div>
        <label className="feature-field">
          <span>参数</span>
          <select defaultValue="35mm">
            <option>24mm</option>
            <option>35mm</option>
            <option>50mm</option>
          </select>
        </label>
        <button className="feature-primary" type="button">
          生成新角度
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-preview-frame">
          <span>结果预览</span>
          <small>相机角度变体会显示在这里</small>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>角度版本管理</h2>
        <div className="feature-history-item">左 35 度 · 草稿</div>
        <div className="feature-history-item">低角度 · 待生成</div>
      </aside>
    </section>
  );
}
