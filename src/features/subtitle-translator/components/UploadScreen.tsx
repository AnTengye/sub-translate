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
      <section className="upload-hero">
        <p className="eyebrow">SRT Translate Workspace</p>
        <h1>上传字幕，生成可导出的中文字幕</h1>
        <p className="lead">
          面向桌面效率的私有翻译工作区，适合在本机、NAS 或内网环境中快速完成字幕处理。
        </p>
        <div className="upload-feature-list" aria-label="上传页功能亮点">
          <span className="feature-pill">拖放上传</span>
          <span className="feature-pill">多引擎切换</span>
          <span className="feature-pill">失败可重试</span>
        </div>
      </section>

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
        <span className="upload-card-title">导入字幕文件</span>
        <span className="upload-card-hint">
          {isDragging ? '松手即可开始导入字幕' : '支持 .srt / .vtt / .sub，点击选择或直接拖拽到这里'}
        </span>
        <span className="upload-card-note">导入后即可进入桌面工作区，继续配置引擎与翻译参数。</span>
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
