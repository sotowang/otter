import React, { useMemo } from 'react';
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

      return configs.map((cfg) => (
        <tr key={`${cfg.namespace}-${cfg.group}-${cfg.key}`}>
          <td>{cfg.key}</td>
          <td>{cfg.value}</td>
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
