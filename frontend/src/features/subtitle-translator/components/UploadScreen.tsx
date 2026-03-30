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
        <div className="upload-hero-copy">
          <p className="eyebrow">SubLingo Control Room</p>
          <h1>上传字幕，启动翻译控制台</h1>
          <p className="lead">
            为本机、NAS 和内网环境设计的字幕翻译控制室。导入文件后，统一在一个深色工作台里完成配置、执行、校对与导出。
          </p>
        </div>

        <div className="upload-feature-list" aria-label="上传页功能亮点">
          <span className="feature-pill">统一 Provider 管理</span>
          <span className="feature-pill">实时活动流</span>
          <span className="feature-pill">失败批量重试</span>
        </div>
      </section>

      <section className="upload-launchpad">
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
            {isDragging ? '松手后立即进入控制台工作台' : '支持 .srt / .vtt / .sub，点击选择或直接拖拽到这里'}
          </span>
          <span className="upload-card-button">{isDragging ? '松手开始导入' : '选择字幕文件'}</span>
          <span className="upload-card-note">导入后即可进入统一操作区，继续配置引擎、执行翻译并导出中文字幕。</span>
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

        <div className="upload-side-note">
          <div className="upload-note-card">
            <span className="overview-label">CONTROL ROOM</span>
            <strong>导入后直达统一操作区</strong>
            <p>左侧只保留配置，右侧集中执行、日志和结果，避免操作分散。</p>
          </div>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
    </main>
  );
}
