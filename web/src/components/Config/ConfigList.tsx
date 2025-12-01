import React, { useMemo } from 'react';
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
      const renderConfigValue = (value: string, type: string) => {
        if (!value) return '';

        switch (type) {
          case 'json':
            try {
              const parsed = JSON.parse(value);
              return (
                <div className="config-value">
                  <pre className="config-value-json">
                    {JSON.stringify(parsed, null, 2)}
                  </pre>
                </div>
              );
            } catch (e) {
              // 如果JSON解析失败，显示原始值
              return <div className="config-value">{value}</div>;
            }
          case 'markdown':
            try {
              const html = marked(value);
              return (
                <div className="config-value markdown-content">
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              );
            } catch (e) {
              // 如果Markdown渲染失败，显示原始值
              return <div className="config-value">{value}</div>;
            }
          default:
            return <div className="config-value">{value}</div>;
        }
      };

      return configs.map((cfg) => (
        <tr key={`${cfg.namespace}-${cfg.group}-${cfg.key}`}>
          <td>{cfg.key}</td>
          <td>{renderConfigValue(cfg.value, cfg.type || 'text')}</td>
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
      ));
    }, [configs, isLoading, onEdit, onHistory, onDelete]);

    return (
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
    );
  }
);

// 添加displayName便于调试
ConfigList.displayName = 'ConfigList';

export default ConfigList;
