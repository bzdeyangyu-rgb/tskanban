import { useEffect, useMemo, useState } from "react";
import {
  fetchProviderModels,
  saveProviders,
  testProviderConnection,
  type ApiProvider,
  type EditableApiProvider
} from "../api/client";

type ApiSettingsProps = {
  providers: ApiProvider[];
  onProvidersChange: (providers: ApiProvider[]) => void;
};

export function ApiSettings({ providers, onProvidersChange }: ApiSettingsProps) {
  const [draft, setDraft] = useState<EditableApiProvider>(() => emptyProvider());
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDraft(providers[0] ? { ...providers[0], apiKey: "" } : emptyProvider());
  }, [providers]);

  const modelCount = useMemo(
    () => draft.imageModels.length + draft.chatModels.length + draft.videoModels.length,
    [draft.chatModels.length, draft.imageModels.length, draft.videoModels.length]
  );

  const updateDraft = (patch: Partial<EditableApiProvider>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    try {
      setStatus("保存中...");
      const saved = await saveProviders(mergeDraft(providers, draft));
      onProvidersChange(saved);
      setStatus("已保存");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const handleTest = async () => {
    try {
      setStatus("验证中...");
      const result = await testProviderConnection({
        providerId: draft.id,
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey
      });
      applyModels(result);
      setStatus(`验证通过，找到 ${result.total} 个模型`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const handleFetchModels = async () => {
    try {
      setStatus("拉取模型中...");
      const result = await fetchProviderModels({
        providerId: draft.id,
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey
      });
      applyModels(result);
      setStatus(`已拉取 ${result.total} 个模型`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const applyModels = (result: { imageModels: string[]; chatModels: string[]; videoModels: string[] }) => {
    setDraft((current) => ({
      ...current,
      imageModels: result.imageModels,
      chatModels: result.chatModels,
      videoModels: result.videoModels
    }));
  };

  const selectProvider = (id: string) => {
    const provider = providers.find((item) => item.id === id);
    if (provider) {
      setDraft({ ...provider, apiKey: "" });
    }
  };

  const handleNew = () => {
    setDraft(emptyProvider(`api-${Date.now().toString(36).slice(-5)}`));
    setStatus("");
  };

  return (
    <section className="api-settings">
      <div className="api-settings-head">
        <h2 className="panel-heading">API 设置</h2>
        <button className="mini-button" type="button" onClick={handleNew}>
          新增
        </button>
      </div>

      {providers.length > 0 ? (
        <select className="field-control" value={draft.id} onChange={(event) => selectProvider(event.target.value)}>
          {providers.map((provider) => (
            <option value={provider.id} key={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      ) : null}

      <div className="field-list">
        <label className="field">
          平台名称
          <input
            className="field-control"
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value, id: normalizeId(event.target.value) || draft.id })}
          />
        </label>
        <label className="field">
          请求地址
          <input
            className="field-control"
            value={draft.baseUrl}
            placeholder="https://mikuapi.org/v1"
            onChange={(event) => updateDraft({ baseUrl: event.target.value })}
          />
        </label>
        <label className="field">
          协议
          <select
            className="field-control"
            value={draft.protocol}
            onChange={(event) => updateDraft({ protocol: event.target.value as EditableApiProvider["protocol"] })}
          >
            <option value="openai">OpenAI 兼容</option>
            <option value="apimart">APIMart 异步</option>
          </select>
        </label>
        <label className="field">
          API Key
          <input
            className="field-control"
            value={draft.apiKey ?? ""}
            type="password"
            placeholder={draft.hasKey ? `已保存 ${draft.keyPreview}` : "输入 API Key"}
            onChange={(event) => updateDraft({ apiKey: event.target.value })}
          />
        </label>
      </div>

      <div className="api-actions">
        <button className="mini-button" type="button" onClick={handleTest}>
          验证
        </button>
        <button className="mini-button" type="button" onClick={handleFetchModels}>
          拉模型
        </button>
        <button className="mini-button dark" type="button" onClick={handleSave}>
          保存
        </button>
      </div>
      <div className="provider-summary">
        <span>image {draft.imageModels.length}</span>
        <span>chat {draft.chatModels.length}</span>
        <span>video {draft.videoModels.length}</span>
        <span>共 {modelCount}</span>
      </div>
      {status ? <p className="muted compact">{status}</p> : null}
    </section>
  );
}

function emptyProvider(id = "mikuapi"): EditableApiProvider {
  return {
    id,
    name: id === "mikuapi" ? "mikuapi" : "新平台",
    baseUrl: id === "mikuapi" ? "https://mikuapi.org/v1" : "https://",
    protocol: "openai",
    enabled: true,
    primary: true,
    imageModels: [],
    chatModels: [],
    videoModels: [],
    hasKey: false,
    keyPreview: "",
    apiKey: ""
  };
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function mergeDraft(providers: ApiProvider[], draft: EditableApiProvider): EditableApiProvider[] {
  const existing = providers.filter((provider) => provider.id !== draft.id);
  return [{ ...draft, primary: true }, ...existing.map((provider) => ({ ...provider, primary: false }))];
}
