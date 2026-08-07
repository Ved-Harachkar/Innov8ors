import React, { useState, useEffect } from 'react';

export default function Alert({ type = 'success', message, duration = 5000, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible || !message) return null;

  const icons = { success: '✓', error: '✕', warning: '⚠' };

  return (
    <div className={`alert alert-${type} fade-in`}>
      <span>{icons[type] || '●'}</span>
      <span>{message}</span>
    </div>
  );
}
