import { useRef, useState } from 'react';

interface UploadScreenProps {
  error: string | null;
  onFileSelected: (file: File | null | undefined) => void | Promise<void>;
}

export function UploadScreen({ error, onFileSelected }: UploadScreenProps) {
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  function resetDragState() {
    dragDepthRef.current = 0;
    setIsDragging(false);
  }

  return (
    <main className="upload-screen">
      <p className="eyebrow">日→中 字幕翻译工具</p>
      <h1>上传字幕，一键翻译</h1>
      <p className="lead">支持多引擎、批量翻译、失败重试，适合私人部署自用。</p>

      <label
        className={`upload-card${isDragging ? ' drag-active' : ''}`}
        htmlFor="subtitle-file-input"
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          resetDragState();
          void onFileSelected(file);
        }}
      >
        <span className="upload-card-title">选择字幕文件</span>
        <span className="upload-card-hint">
          {isDragging ? '松手即可开始导入字幕' : '支持 .srt / .vtt / .sub，或直接拖拽到这里'}
        </span>
        <input
          id="subtitle-file-input"
          aria-label="选择文件"
          className="sr-only-input"
          type="file"
          accept=".srt,.vtt,.sub"
          onChange={(event) => {
            resetDragState();
            void onFileSelected(event.target.files?.[0]);
          }}
        />
      </label>

      {error ? <p className="error-text">{error}</p> : null}
    </main>
  );
}
