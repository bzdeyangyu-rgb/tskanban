import React from "react";

export function GptChatPage() {
  return (
    <section className="feature-page" data-feature-layout="three-column" aria-label="GPT 对话">
      <aside className="feature-column feature-params">
        <span className="feature-column-label">参数区</span>
        <h1>GPT 对话</h1>
        <label className="feature-upload">
          <span>图片附件</span>
          <input type="file" accept="image/*" multiple />
          <small>可附加图片作为讨论上下文</small>
        </label>
        <label className="feature-field">
          <span>对话内容</span>
          <textarea defaultValue="帮我把这段画面描述优化成稳定的生成提示词" />
        </label>
        <label className="feature-field">
          <span>提示词优化</span>
          <select defaultValue="结构化优化">
            <option>结构化优化</option>
            <option>流程建议</option>
            <option>创意讨论</option>
          </select>
        </label>
        <button className="feature-primary" type="button">
          发送
        </button>
      </aside>

      <main className="feature-column feature-workspace">
        <span className="feature-column-label">工作区</span>
        <div className="feature-chat-window">
          <div className="feature-chat-message is-user">请优化提示词。</div>
          <div className="feature-chat-message">建议拆分为主体、材质、光线、构图和负面约束。</div>
        </div>
      </main>

      <aside className="feature-column feature-management">
        <span className="feature-column-label">管理区</span>
        <h2>对话历史</h2>
        <div className="feature-history-item">提示词优化 · 当前会话</div>
        <div className="feature-history-item">流程建议 · 草稿</div>
      </aside>
    </section>
  );
}
