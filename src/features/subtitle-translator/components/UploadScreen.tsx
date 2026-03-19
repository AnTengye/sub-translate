interface UploadScreenProps {
  error: string | null;
  onFileSelected: (file: File | null | undefined) => void | Promise<void>;
}

export function UploadScreen({ error, onFileSelected }: UploadScreenProps) {
  return (
    <main className="upload-screen">
      <p className="eyebrow">日→中 字幕翻译工具</p>
      <h1>上传字幕，一键翻译</h1>
      <p className="lead">支持多引擎、批量翻译、失败重试，适合私人部署自用。</p>

      <label className="upload-card" htmlFor="subtitle-file-input">
        <span className="upload-card-title">选择字幕文件</span>
        <span className="upload-card-hint">支持 .srt / .vtt / .sub</span>
        <input
          id="subtitle-file-input"
          aria-label="选择文件"
          className="sr-only-input"
          type="file"
          accept=".srt,.vtt,.sub"
          onChange={(event) => onFileSelected(event.target.files?.[0])}
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}
    </main>
  );
}
