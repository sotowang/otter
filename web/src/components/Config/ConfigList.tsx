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
            <td
              colSpan={5}
              style={{ textAlign: 'center', color: '#999', padding: '40px' }}
            >
              <span className="loading"></span> Loading configs...
            </td>
          </tr>
        );
      }

      if (configs.length === 0) {
        return (
          <tr>
            <td
              colSpan={5}
              style={{ textAlign: 'center', color: '#999', padding: '40px' }}
            >
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
              <div style={{ maxHeight: '120px', overflow: 'auto', margin: '0' }}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontSize: '12px', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            );
          } catch (e) {
            // 如果JSON解析失败，显示原始值
            return (
              <div style={{ maxHeight: '120px', overflow: 'auto', margin: '0' }}>
                <div style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {value}
                </div>
              </div>
            );
          }
        case 'markdown':
          try {
            const html = marked(value);
            return (
              <div 
                className="markdown-content" 
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ fontSize: '13px', maxHeight: '120px', overflow: 'auto', margin: '0' }}
              />
            );
          } catch (e) {
            // 如果Markdown渲染失败，显示原始值
            return (
              <div style={{ maxHeight: '120px', overflow: 'auto', margin: '0' }}>
                <div style={{ fontSize: '12px', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {value}
                </div>
              </div>
            );
          }
        default:
          return (
            <div style={{ maxHeight: '120px', overflow: 'auto', margin: '0' }}>
              <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {value}
              </div>
            </div>
          );
      }
    };

    return configs.map((cfg) => (
        <tr key={`${cfg.namespace}-${cfg.group}-${cfg.key}`}>
          <td>{cfg.key}</td>
          <td>{renderConfigValue(cfg.value, cfg.type || 'text')}</td>
          <td>{cfg.type || 'text'}</td>
          <td>{cfg.version}</td>
          <td className="actions">
            <button onClick={() => onEdit(cfg)}>Edit</button>
            <button onClick={() => onHistory(cfg)}>History</button>
            <button onClick={() => onDelete(cfg)}>Delete</button>
          </td>
        </tr>
      ));
    }, [configs, isLoading, onEdit, onHistory, onDelete]);

    return (
      <table id="configTable">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Type</th>
            <th>Version</th>
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
