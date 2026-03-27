import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncAction } from '../../../components/ui/feedback/useAsyncAction';
import type { ProviderId } from '../../../lib/providers/types';
import type { ProviderCenterModel, ProviderCenterProfile } from '../provider-center-api';

interface ModelManagerDialogProps {
  isOpen: boolean;
  family: ProviderId;
  profile: ProviderCenterProfile;
  onClose: () => void;
  onLoadCatalog: (
    family: ProviderId,
    profileId: string,
  ) => Promise<{ profile: ProviderCenterProfile; models: ProviderCenterModel[]; summary: string }>;
  onApply: (models: ProviderCenterModel[]) => void;
}

export function ModelManagerDialog({
  isOpen,
  family,
  profile,
  onClose,
  onLoadCatalog,
  onApply,
}: ModelManagerDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ProviderCenterModel[]>(profile.availableModels ?? []);
  const selectedIdsRef = useRef<string[]>([]);
  const loadCatalogRef = useRef(onLoadCatalog);
  const loadAction = useAsyncAction();

  useEffect(() => {
    loadCatalogRef.current = onLoadCatalog;
  }, [onLoadCatalog]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');
    selectedIdsRef.current = profile.models.map((model) => model.id);
    setSelectedIds(selectedIdsRef.current);
    setCatalog(profile.availableModels ?? []);

    void loadAction
      .run(async () => {
        const result = await loadCatalogRef.current(family, profile.id);
        setCatalog(result.models);
        return result;
      })
      .catch(() => undefined);
  }, [family, isOpen, profile.id]);

  const filteredCatalog = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return catalog;
    }

    return catalog.filter((model) => model.id.toLowerCase().includes(keyword) || model.label.toLowerCase().includes(keyword));
  }, [catalog, query]);

  if (!isOpen) {
    return null;
  }

  function toggleModel(modelId: string) {
    const nextSelectedIds = selectedIdsRef.current.includes(modelId)
      ? selectedIdsRef.current.filter((id) => id !== modelId)
      : [...selectedIdsRef.current, modelId];
    selectedIdsRef.current = nextSelectedIds;
    setSelectedIds(nextSelectedIds);
  }

  function applySelection() {
    const selectedModels = catalog.filter((model) => selectedIdsRef.current.includes(model.id));
    onApply(selectedModels);
    onClose();
  }

  return (
    <div className="provider-center-create-backdrop">
      <section className="provider-center-model-dialog" role="dialog" aria-label="模型管理" aria-modal="true">
        <header className="provider-center-model-dialog-header">
          <div>
            <h3>模型管理</h3>
            <p className="provider-center-caption">从模型提供商返回的全量模型池中选择要加入当前配置的模型。</p>
          </div>
          <button className="provider-close-button" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="provider-center-model-dialog-toolbar">
          <label className="provider-center-search">
            <input
              aria-label="搜索模型"
              className="provider-center-input"
              type="text"
              value={query}
              placeholder="搜索模型 ID 或名称"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button
            className="provider-inline-button"
            type="button"
            disabled={loadAction.isPending}
            onClick={() =>
              void loadAction
                .run(async () => {
                  const result = await loadCatalogRef.current(family, profile.id);
                  setCatalog(result.models);
                  return result;
                })
                .catch(() => undefined)
            }
          >
            {loadAction.isPending ? '加载中…' : '刷新'}
          </button>
        </div>

        <div className="provider-center-model-dialog-body">
          {loadAction.isPending ? <div className="empty-state">正在拉取模型列表…</div> : null}

          {!loadAction.isPending && loadAction.error ? (
            <div className="empty-state">模型加载失败：{loadAction.error}</div>
          ) : null}

          {!loadAction.isPending && !loadAction.error ? (
            <>
              <p className="provider-center-caption">发现 {catalog.length} 个模型</p>
              {filteredCatalog.length === 0 ? (
                <div className="empty-state">没有匹配的模型。</div>
              ) : (
                <div className="provider-center-catalog-list">
                  {filteredCatalog.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className="provider-center-catalog-item"
                      aria-pressed={selectedIds.includes(model.id)}
                      aria-label={model.label}
                      onClick={() => toggleModel(model.id)}
                    >
                      <span className="provider-center-catalog-check" aria-hidden="true">
                        {selectedIds.includes(model.id) ? '✓' : ''}
                      </span>
                      <div className="provider-center-catalog-copy">
                        <strong>{model.label}</strong>
                        <span>{model.id}</span>
                      </div>
                      <span className="provider-center-model-status">{model.source}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <footer className="provider-center-model-dialog-footer">
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" type="button" onClick={applySelection}>
            添加到当前配置
          </button>
        </footer>
      </section>
    </div>
  );
}
