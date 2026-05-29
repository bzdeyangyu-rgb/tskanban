import React, { useEffect, useMemo, useState } from "react";
import {
  fetchProviderModels,
  saveProviderList,
  testProviderConnection,
  type ApiProvider,
  type EditableApiProvider,
  type ProviderCapabilities,
  type ProviderCapabilityStatus,
  type ProviderReadiness
} from "../api/client";

type ApiSettingsProps = {
  providers: ApiProvider[];
  onProvidersChange: (providers: ApiProvider[]) => void;
};

export function ApiSettings({ providers, onProvidersChange }: ApiSettingsProps) {
  const [draft, setDraft] = useState<EditableApiProvider>(() => emptyProvider());
  const [status, setStatus] = useState("");
  const [readiness, setReadiness] = useState<ProviderReadiness>(() => readinessFromProviders(providers));

  useEffect(() => {
    setDraft(
      providers[0]
        ? { ...providers[0], capabilities: providers[0].capabilities ?? normalizeProviderCapabilities(providers[0]), apiKey: "" }
        : emptyProvider()
    );
    setReadiness(readinessFromProviders(providers));
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
      const saved = await saveProviderList(mergeDraft(providers, draft));
      onProvidersChange(saved.providers);
      setReadiness(saved.readiness);
      setStatus(saved.readiness.message);
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
        apiKey: draft.apiKey,
        protocol: draft.protocol
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
        apiKey: draft.apiKey,
        protocol: draft.protocol
      });
      applyModels(result);
      setStatus(`已拉取 ${result.total} 个模型`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const applyModels = (result: {
    imageModels: string[];
    chatModels: string[];
    videoModels: string[];
    capabilities?: ProviderCapabilities;
  }) => {
    setDraft((current) => ({
      ...current,
      imageModels: result.imageModels,
      chatModels: result.chatModels,
      videoModels: result.videoModels,
      capabilities:
        result.capabilities ??
        normalizeProviderCapabilities({
          ...current,
          imageModels: result.imageModels,
          chatModels: result.chatModels,
          videoModels: result.videoModels
        })
    }));
  };

  const selectProvider = (id: string) => {
    const provider = providers.find((item) => item.id === id);
    if (provider) {
      setDraft({ ...provider, capabilities: provider.capabilities ?? normalizeProviderCapabilities(provider), apiKey: "" });
    }
  };

  const handleNew = () => {
    setDraft(emptyProvider(`api-${Date.now().toString(36).slice(-5)}`));
    setStatus("");
  };

  return (
    <section className="api-settings compact-card">
      <div className="api-settings-head">
        <h2 className="panel-heading">API 设置</h2>
        <button className="mini-button" type="button" onClick={handleNew}>
          新增
        </button>
      </div>

      <p className={`api-readiness api-readiness-${readiness.reason}`}>{readiness.message}</p>

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
            onChange={(event) => {
              const protocol = event.target.value as EditableApiProvider["protocol"];
              updateDraft({ protocol, capabilities: normalizeProviderCapabilities({ ...draft, protocol }) });
            }}
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
      <div className="provider-summary" aria-label="模型统计">
        <span>图像模型 {draft.imageModels.length}</span>
        <span>对话模型 {draft.chatModels.length}</span>
        <span>视频模型 {draft.videoModels.length}</span>
        <span>合计 {modelCount}</span>
      </div>
      <div className="provider-capability-panel" aria-label="供应商能力">
        <div className="provider-capability-head">
          <strong>供应商能力</strong>
          <span>按模型分类与协议字段归一化</span>
        </div>
        <div className="provider-capability-grid">
          {capabilityKeys.map((key) => {
            const capability = (draft.capabilities ?? normalizeProviderCapabilities(draft))[key];
            return (
              <div className={`provider-capability provider-capability-${capability.status}`} key={key}>
                <span className="provider-capability-label">{capability.label}</span>
                <span className="provider-capability-status">{capabilityStatusLabel[capability.status]}</span>
                <small>{capability.reason}</small>
              </div>
            );
          })}
        </div>
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
    capabilities: normalizeProviderCapabilities({
      protocol: "openai",
      imageModels: [],
      chatModels: [],
      videoModels: []
    }),
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

function readinessFromProviders(providers: ApiProvider[]): ProviderReadiness {
  const primary = providers.find((provider) => provider.primary && provider.enabled) ?? providers.find((provider) => provider.enabled);
  if (!primary) {
    return {
      ready: false,
      reason: "no_provider",
      message: "未配置 API 平台，画布生成暂不可用。请填写请求地址、API Key，并保存。"
    };
  }
  if (!primary.hasKey) {
    return {
      ready: false,
      reason: "missing_key",
      message: `${primary.name} 缺少 API Key，生成暂不可用。`,
      primaryProviderId: primary.id
    };
  }
  return {
    ready: true,
    reason: "ready",
    message: `${primary.name} 已可用于生成。`,
    primaryProviderId: primary.id
  };
}

const capabilityKeys: Array<keyof ProviderCapabilities> = ["text2img", "img2img", "inpaint", "video", "llm"];

const capabilityStatusLabel: Record<ProviderCapabilityStatus, string> = {
  available: "已支持",
  inferred: "可推断",
  unavailable: "未确认"
};

function normalizeProviderCapabilities(input: {
  protocol: EditableApiProvider["protocol"];
  imageModels?: string[];
  chatModels?: string[];
  videoModels?: string[];
}): ProviderCapabilities {
  const imageModels = input.imageModels ?? [];
  const chatModels = input.chatModels ?? [];
  const videoModels = input.videoModels ?? [];
  const protocolSupportsRichModes = input.protocol === "openai" || input.protocol === "apimart";

  const fromModel = (label: string, modelCount: number) => ({
    label,
    status: "available" as const,
    source: "model" as const,
    modelCount,
    reason: `已识别 ${modelCount} 个相关模型`
  });

  const fromProtocol = (label: string) => ({
    label,
    status: protocolSupportsRichModes ? ("inferred" as const) : ("unavailable" as const),
    source: protocolSupportsRichModes ? ("protocol" as const) : ("none" as const),
    modelCount: 0,
    reason: protocolSupportsRichModes ? "根据当前协议推断" : "当前协议未声明该能力"
  });

  return {
    text2img: imageModels.length > 0 ? fromModel("文生图", imageModels.length) : fromProtocol("文生图"),
    img2img: imageModels.length > 0 ? fromModel("图生图", imageModels.length) : fromProtocol("图生图"),
    inpaint: fromProtocol("局部重绘"),
    video: videoModels.length > 0 ? fromModel("视频", videoModels.length) : fromProtocol("视频"),
    llm: chatModels.length > 0 ? fromModel("LLM", chatModels.length) : fromProtocol("LLM")
  };
}
