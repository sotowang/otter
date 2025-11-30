import React, { useState, useCallback, useEffect } from 'react';
import type { Config } from '../../types';

interface ConfigFormProps {
  initialConfig?: Config | null;
  onSave: (
    config: Omit<Config, 'version' | 'created_at' | 'updated_at'>
  ) => void;
  namespaces: string[];
  currentNamespace: string;
}

const ConfigForm: React.FC<ConfigFormProps> = React.memo(
  ({ initialConfig, onSave, namespaces, currentNamespace }) => {
    // 配置类型选项
    const configTypes = [
      { value: 'text', label: 'Text' },
      { value: 'properties', label: 'Properties' },
      { value: 'json', label: 'JSON' },
      { value: 'yaml', label: 'YAML' },
      { value: 'xml', label: 'XML' },
      { value: 'markdown', label: 'Markdown' },
    ];

    // 格式化配置值，根据类型
    const formatConfigValue = useCallback((val: string, type: string) => {
      if (!val) return '';
      
      switch (type) {
        case 'json':
          try {
            const parsed = JSON.parse(val);
            return JSON.stringify(parsed, null, 2);
          } catch (e) {
            // 如果JSON解析失败，返回原始值
            return val;
          }
        default:
          return val;
      }
    }, []);

    // 初始化状态
    const [key, setKey] = useState(initialConfig?.key || '');
    const [value, setValue] = useState(initialConfig ? formatConfigValue(initialConfig.value, initialConfig.type) : '');
    const [type, setType] = useState(initialConfig?.type || 'text');
    const [namespace, setNamespace] = useState(initialConfig?.namespace || currentNamespace);
    const [isEditMode, setIsEditMode] = useState(!!initialConfig);
    const [error, setError] = useState<string | null>(null);

    // 当类型变化时，重新格式化value
    useEffect(() => {
      if (initialConfig) {
        setValue(formatConfigValue(initialConfig.value, type));
      }
    }, [type, initialConfig, formatConfigValue]);

    // 重置表单
    const resetForm = useCallback(() => {
      setKey('');
      setValue('');
      setType('text');
      setNamespace(currentNamespace);
      setIsEditMode(false);
    }, [currentNamespace]);

    // 验证配置值，根据类型
    const validateConfigValue = (val: string, type: string): string | null => {
      if (!val.trim()) {
        return 'Value cannot be empty';
      }
      
      switch (type) {
        case 'json':
          try {
            // 首先检查基本JSON格式
            const parsed = JSON.parse(val);
            
            // 检查是否为对象
            if (typeof parsed !== 'object' || parsed === null) {
              return 'JSON must be an object';
            }
            
            // 检查重复键
            const keys = new Set<string>();
            let hasDuplicateKeys = false;
            
            // 使用正则表达式查找所有键，检查是否有重复
            const keyRegex = /"([^"]+)":/g;
            let match;
            while ((match = keyRegex.exec(val)) !== null) {
              const key = match[1];
              if (keys.has(key)) {
                hasDuplicateKeys = true;
                break;
              }
              keys.add(key);
            }
            
            if (hasDuplicateKeys) {
              return 'JSON contains duplicate keys';
            }
            
            return null;
          } catch (e) {
            return 'Invalid JSON format';
          }
        default:
          return null;
      }
    };

    // 处理表单提交
    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        
        // 验证表单
        const validationError = validateConfigValue(value, type);
        if (validationError) {
          setError(validationError);
          return;
        }
        
        if (key.trim() && value.trim() && namespace) {
          onSave({
            namespace,
            group: '', // 由父组件提供
            key: key.trim(),
            value: value.trim(),
            type,
          });
          resetForm();
          setError(null);
        } else if (!namespace) {
          setError('Namespace is required');
        }
      },
      [key, value, type, onSave, resetForm]
    );

    // 当value变化时，清除错误信息
    useEffect(() => {
      if (error) {
        setError(null);
      }
    }, [value, error]);

    return (
      <form id="configForm" onSubmit={handleSubmit} role="form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="namespace">Namespace:</label>
            <select
              id="namespace"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className={error && !namespace ? 'input-error' : ''}
            >
              <option value="" disabled>
                Select namespace
              </option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>
        </div>
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
              style={error ? { borderColor: '#ff4d4f' } : {}}
            />
            {error && (
              <div 
                className="error-message" 
                style={{
                  color: '#ff4d4f',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'block',
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </form>
    );
  }
);

// 添加displayName便于调试
ConfigForm.displayName = 'ConfigForm';

export default ConfigForm;
