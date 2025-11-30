
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigForm from './ConfigForm';
import type { Config } from '../../types';

// 模拟回调函数
const mockOnSave = jest.fn();


describe('ConfigForm Component', () => {
  // 重置模拟函数
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders create mode by default', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 检查表单元素是否存在
    expect(screen.getByLabelText(/Key:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value:/i)).toBeInTheDocument();

    // 检查Key输入框是否可编辑
    const keyInput = screen.getByLabelText(/Key:/i) as HTMLInputElement;
    expect(keyInput.disabled).toBe(false);
  });

  test('renders edit mode when initialConfig is provided', () => {
    const mockConfig: Config = {
      namespace: 'public',
      group: 'DEFAULT_GROUP',
      key: 'test_key',
      value: 'test_value',
      type: 'text',
      version: 1,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    render(
      <ConfigForm
        initialConfig={mockConfig}
        onSave={mockOnSave}
      />
    );

    // 检查表单元素是否填充了初始数据
    expect(screen.getByDisplayValue('test_key')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test_value')).toBeInTheDocument();

    // 检查Type选择框是否设置了正确的值
    const typeSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(typeSelect.value).toBe('text');

    // 检查Key输入框是否禁用
    const keyInput = screen.getByLabelText(/Key:/i) as HTMLInputElement;
    expect(keyInput.disabled).toBe(true);
  });

  test('calls onSave with correct data when form is submitted', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 填充表单数据
    fireEvent.change(screen.getByLabelText(/Key:/i), {
      target: { value: 'new_key' },
    });
    fireEvent.change(screen.getByLabelText(/Value:/i), {
      target: { value: 'new_value' },
    });
    fireEvent.change(screen.getByLabelText(/Type:/i), {
      target: { value: 'json' },
    });

    // 提交表单
    fireEvent.submit(screen.getByRole('form'));

    // 检查onSave是否被调用，并且传递了正确的数据
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith({
      namespace: '',
      group: '',
      key: 'new_key',
      value: 'new_value',
      type: 'json',
    });
  });

  test('does not call onSave when form is submitted with empty key', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 填充表单数据，但key为空
    fireEvent.change(screen.getByLabelText(/Key:/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Value:/i), {
      target: { value: 'new_value' },
    });

    // 提交表单
    fireEvent.submit(screen.getByRole('form'));

    // 检查onSave是否没有被调用
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test('does not call onSave when form is submitted with empty value', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 填充表单数据，但value为空
    fireEvent.change(screen.getByLabelText(/Key:/i), {
      target: { value: 'new_key' },
    });
    fireEvent.change(screen.getByLabelText(/Value:/i), {
      target: { value: '' },
    });

    // 提交表单
    fireEvent.submit(screen.getByRole('form'));

    // 检查onSave是否没有被调用
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test('resets form after successful submission', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 填充表单数据
    fireEvent.change(screen.getByLabelText(/Key:/i), {
      target: { value: 'new_key' },
    });
    fireEvent.change(screen.getByLabelText(/Value:/i), {
      target: { value: 'new_value' },
    });

    // 提交表单
    fireEvent.submit(screen.getByRole('form'));

    // 检查表单是否被重置
    const keyInput = screen.getByLabelText(/Key:/i) as HTMLInputElement;
    const valueInput = screen.getByLabelText(/Value:/i) as HTMLTextAreaElement;
    const typeSelect = screen.getByLabelText(/Type:/i) as HTMLSelectElement;

    expect(keyInput.value).toBe('');
    expect(valueInput.value).toBe('');
    expect(typeSelect.value).toBe('text');
  });

  test('updates type when select value changes', () => {
    render(<ConfigForm onSave={mockOnSave} />);

    // 检查默认类型
    const typeSelect = screen.getByLabelText(/Type:/i) as HTMLSelectElement;
    expect(typeSelect.value).toBe('text');

    // 更改类型
    fireEvent.change(typeSelect, { target: { value: 'yaml' } });
    expect(typeSelect.value).toBe('yaml');

    // 提交表单
    fireEvent.change(screen.getByLabelText(/Key:/i), {
      target: { value: 'new_key' },
    });
    fireEvent.change(screen.getByLabelText(/Value:/i), {
      target: { value: 'new_value' },
    });
    fireEvent.submit(screen.getByRole('form'));

    // 检查onSave是否使用了正确的类型
    expect(mockOnSave).toHaveBeenCalledWith({
      namespace: '',
      group: '',
      key: 'new_key',
      value: 'new_value',
      type: 'yaml',
    });
  });
});
