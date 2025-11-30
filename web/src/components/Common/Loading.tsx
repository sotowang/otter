import React from 'react';
import type { LoadingProps } from '../../types';

const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  text = 'Loading...',
}) => {
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'loading-small';
      case 'large':
        return 'loading-large';
      default:
        return 'loading-medium';
    }
  };

  return (
    <div className={`loading-container ${getSizeClass()}`}>
      <div className="loading-spinner"></div>
      {text && <div className="loading-text">{text}</div>}
    </div>
  );
};

export default Loading;
