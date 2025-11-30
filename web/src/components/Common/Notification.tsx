import React, { useEffect } from 'react';
import type { Notification as NotificationType } from '../../types';

interface NotificationProps {
  notifications: NotificationType[];
  onRemove: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({
  notifications,
  onRemove,
}) => {
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        onRemove(notifications[0].id);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [notifications, onRemove]);

  if (notifications.length === 0) return null;

  return (
    <>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: '500',
            zIndex: 2000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'slideInRight 0.3s ease-out',
            backgroundColor:
              notification.type === 'success'
                ? '#52c41a'
                : notification.type === 'error'
                  ? '#ff4d4f'
                  : notification.type === 'warning'
                    ? '#faad14'
                    : '#1890ff',
          }}
        >
          {notification.message}
        </div>
      ))}
    </>
  );
};

export default Notification;
