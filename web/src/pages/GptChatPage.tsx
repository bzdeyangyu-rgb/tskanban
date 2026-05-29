import React from "react";

export function GptChatPage() {
  return (
    <section className="chat-page" data-chat-layout="thread-composer" aria-label="GPT 对话">
      <header className="chat-page-head">
        <h1>GPT 对话</h1>
        <span>需要可用 API 配置后发送</span>
      </header>
      <main className="chat-thread" aria-label="对话消息">
        <article className="chat-message is-assistant">
          <strong>GPT</strong>
          <p>把你的问题、提示词或图片编辑想法发给我。API 配置完成后，这里会显示真实回复。</p>
        </article>
      </main>
      <form className="chat-composer" aria-label="发送消息">
        <button type="button" className="chat-attach" title="添加图片">
          +
        </button>
        <textarea placeholder="输入你要问 GPT 的内容" />
        <button type="button" className="chat-send">
          发送
        </button>
      </form>
    </section>
  );
}
