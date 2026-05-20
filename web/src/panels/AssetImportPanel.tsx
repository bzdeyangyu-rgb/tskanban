import { Upload } from "lucide-react";

export function AssetImportPanel({
  disabled,
  onFiles
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <section className="asset-import-panel">
      <div className="panel-title-row">
        <h2 className="panel-heading">本地素材</h2>
      </div>
      <label className={`asset-import-drop ${disabled ? "disabled" : ""}`}>
        <Upload aria-hidden="true" />
        <span>选择图片</span>
        <small>支持 jpg / png，也可以拖拽或粘贴到画布</small>
        <input
          accept="image/png,image/jpeg"
          disabled={disabled}
          multiple
          type="file"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            onFiles(files);
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
