import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Mail, MailOpen, X } from 'lucide-react';
import api from '../services/api';

export default function NotificationsMenu() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/employee/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/employee/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    } catch (error) {}
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.leida);
      await Promise.all(unread.map(n => api.put(`/employee/notifications/${n.id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (error) {}
  };

  const openNotification = (notif) => {
    if (!notif.leida) markAsRead(notif.id);
    setSelectedNotif(notif);
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button 
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-blue dark:hover:text-blue-400 transition-colors relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white">Notificaciones</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Marcar todas leídas
                </button>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No tienes notificaciones
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      onClick={() => openNotification(notif)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 ${!notif.leida ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notif.leida ? 'bg-slate-100 dark:bg-slate-700' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                        {notif.leida 
                          ? <MailOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          : <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm line-clamp-2 ${notif.leida ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-white font-medium'}`}>
                          {notif.mensaje}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(notif.fecha_creacion).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Modal (For full message view) */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <MailOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mensaje</h3>
                  <p className="text-xs text-slate-400">{new Date(selectedNotif.fecha_creacion).toLocaleString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedNotif(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedNotif.mensaje}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end rounded-b-xl">
              <button 
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
