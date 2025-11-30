import React, { useState, useCallback } from 'react';
import type { Config } from '../../types';

interface ConfigFormProps {
  initialConfig?: Config | null;
  onSave: (
    config: Omit<Config, 'version' | 'created_at' | 'updated_at'>
  ) => void;
}

const ConfigForm: React.FC<ConfigFormProps> = React.memo(
  ({ initialConfig, onSave }) => {
    // 配置类型选项
    const configTypes = [
      { value: 'text', label: 'Text' },
      { value: 'properties', label: 'Properties' },
      { value: 'json', label: 'JSON' },
      { value: 'yaml', label: 'YAML' },
      { value: 'xml', label: 'XML' },
    ];

    // 初始化状态
    const [key, setKey] = useState(initialConfig?.key || '');
    const [value, setValue] = useState(initialConfig?.value || '');
    const [type, setType] = useState(initialConfig?.type || 'text');
    const [isEditMode, setIsEditMode] = useState(!!initialConfig);

    // 重置表单
    const resetForm = useCallback(() => {
      setKey('');
      setValue('');
      setType('text');
      setIsEditMode(false);
    }, []);

    // 处理表单提交
    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (key.trim() && value.trim()) {
          onSave({
            namespace: '', // 由父组件提供
            group: '', // 由父组件提供
            key: key.trim(),
            value: value.trim(),
            type,
          });
          resetForm();
        }
      },
      [key, value, type, onSave, resetForm]
    );

    return (
      <form id="configForm" onSubmit={handleSubmit} role="form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="key">Key:</label>
            <input
              type="text"
              id="key"
              placeholder="Enter config key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isEditMode}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="configType">Type:</label>
            <select
              id="configType"
              className="form-control"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {configTypes.map((configType) => (
                <option key={configType.value} value={configType.value}>
                  {configType.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="value">Value:</label>
            <textarea
              id="value"
              rows={8}
              placeholder="Enter config value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
      </form>
    );
  }
);

// 添加displayName便于调试
ConfigForm.displayName = 'ConfigForm';

export default ConfigForm;
