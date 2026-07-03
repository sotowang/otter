import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import type { Config } from '../../types';

interface ConfigListProps {
  configs: Config[];
  isLoading: boolean;
  onEdit: (config: Config) => void;
  onHistory: (config: Config) => void;
  onDelete: (config: Config) => void;
}

const ConfigList: React.FC<ConfigListProps> = React.memo(
  ({ configs, isLoading, onEdit, onHistory, onDelete }) => {
    // 折叠状态管理
    const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(
      new Set()
    );

    // 切换配置项的折叠状态
    const toggleExpand = (key: string) => {
      setExpandedConfigs((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    };

    // 渲染配置列表，使用useMemo优化渲染
    const renderedConfigs = useMemo(() => {
      if (isLoading) {
        return (
          <tr>
            <td colSpan={5} className="loading">
              Loading configs...
            </td>
          </tr>
        );
      }

      if (!configs || configs.length === 0) {
        return (
          <tr>
            <td colSpan={5} className="no-data">
              No configs found
            </td>
          </tr>
        );
      }

      // 渲染配置值，根据类型格式化
      const renderConfigValue = (
        value: string,
        type: string,
        configKey: string
      ) => {
        if (!value) return '';

        // 检查是否展开
        const isExpanded = expandedConfigs.has(configKey);

        // 生成预览摘要
        const getPreview = (val: string, t: string) => {
          if (t === 'json') {
            try {
              const parsed = JSON.parse(val);
              return (
                JSON.stringify(parsed, null, 2)
                  .split('\n')
                  .slice(0, 3)
                  .join('\n') +
                (parsed.length > 3 || Object.keys(parsed).length > 2
                  ? '...'
                  : '')
              );
            } catch {
              return val.slice(0, 100) + (val.length > 100 ? '...' : '');
            }
          }
          return val.slice(0, 100) + (val.length > 100 ? '...' : '');
        };

        const preview = getPreview(value, type);

        switch (type) {
          case 'json':
            try {
              const parsed = JSON.parse(value);
              return (
                <div className="config-value-wrapper">
                  <div
                    className="config-value-toggle"
                    onClick={() => toggleExpand(configKey)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="toggle-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  <div
                    className={`config-value ${isExpanded ? 'expanded' : 'collapsed'}`}
                  >
                    <pre className="config-value-json">
                      {isExpanded ? JSON.stringify(parsed, null, 2) : preview}
                    </pre>
                  </div>
                </div>
              );
            } catch {
              // 如果JSON解析失败，显示原始值
              return (
                <div className="config-value-wrapper">
                  <div
                    className="config-value-toggle"
                    onClick={() => toggleExpand(configKey)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="toggle-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  <div
                    className={`config-value ${isExpanded ? 'expanded' : 'collapsed'}`}
                  >
                    {isExpanded ? value : preview}
                  </div>
                </div>
              );
            }
          case 'markdown':
            try {
              const html = marked(value);
              return (
                <div className="config-value-wrapper">
                  <div
                    className="config-value-toggle"
                    onClick={() => toggleExpand(configKey)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="toggle-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  <div
                    className={`config-value ${isExpanded ? 'expanded' : 'collapsed'} markdown-content`}
                  >
                    {isExpanded ? (
                      <div dangerouslySetInnerHTML={{ __html: html }} />
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: marked(preview) }}
                      />
                    )}
                  </div>
                </div>
              );
            } catch {
              // 如果Markdown渲染失败，显示原始值
              return (
                <div className="config-value-wrapper">
                  <div
                    className="config-value-toggle"
                    onClick={() => toggleExpand(configKey)}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <span className="toggle-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  <div
                    className={`config-value ${isExpanded ? 'expanded' : 'collapsed'}`}
                  >
                    {isExpanded ? value : preview}
                  </div>
                </div>
              );
            }
          default:
            return (
              <div className="config-value-wrapper">
                <div
                  className="config-value-toggle"
                  onClick={() => toggleExpand(configKey)}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                </div>
                <div
                  className={`config-value ${isExpanded ? 'expanded' : 'collapsed'}`}
                >
                  {isExpanded ? value : preview}
                </div>
              </div>
            );
        }
      };

      return configs.map((cfg) => {
        const configKey = `${cfg.namespace}-${cfg.group}-${cfg.key}`;
        return (
          <tr key={configKey}>
            <td>{cfg.key}</td>
            <td>
              {renderConfigValue(cfg.value, cfg.type || 'text', configKey)}
            </td>
            <td>
              <span className="config-type">{cfg.type || 'text'}</span>
            </td>
            <td className="config-updated-at">
              {new Date(cfg.updated_at).toLocaleString()}
            </td>
            <td className="config-actions-buttons">
              <button className="btn btn-primary" onClick={() => onEdit(cfg)}>
                Edit
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onHistory(cfg)}
              >
                History
              </button>
              <button className="btn btn-danger" onClick={() => onDelete(cfg)}>
                Delete
              </button>
            </td>
          </tr>
        );
      });
    }, [configs, isLoading, onEdit, onHistory, onDelete, expandedConfigs]);

    return (
      <div className="config-table-container">
        <table className="config-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Type</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>{renderedConfigs}</tbody>
        </table>
      </div>
    );
  }
);

// 添加displayName便于调试
ConfigList.displayName = 'ConfigList';

export default ConfigList;
