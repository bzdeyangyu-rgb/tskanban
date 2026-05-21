import { Upload } from "lucide-react";

export function AssetImportPanel({
  disabled,
  onFiles
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <section className="asset-import-panel library-section">
      <div className="panel-title-row">
        <h2 className="panel-heading">素材库</h2>
        <span className="panel-chip">本地</span>
      </div>
      <label className={`asset-import-drop ${disabled ? "disabled" : ""}`}>
        <Upload aria-hidden="true" />
        <span>导入图片</span>
        <small>支持 jpg / png，可拖入或粘贴到画布</small>
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
