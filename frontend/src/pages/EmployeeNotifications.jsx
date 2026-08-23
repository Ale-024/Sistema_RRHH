import { useState, useEffect } from 'react';
import api from '../services/api';
import { Bell, Check, Mail, MailOpen } from 'lucide-react';

export default function EmployeeNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/employee/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/employee/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, leida: true } : n)
      );
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.leida);
      await Promise.all(unread.map(n => api.put(`/employee/notifications/${n.id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const unreadCount = notifications.filter(n => !n.leida).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificación${unreadCount > 1 ? 'es' : ''} sin leer`
              : 'Todas tus notificaciones están al día'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium rounded-lg transition-colors"
          >
            <Check className="w-4 h-4 mr-1" /> Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Bell className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">No tienes notificaciones</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start p-5 gap-4 transition-colors ${
                notif.leida ? 'bg-white' : 'bg-blue-50/50'
              }`}
            >
              <div className={`mt-0.5 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                notif.leida ? 'bg-slate-100' : 'bg-blue-100'
              }`}>
                {notif.leida
                  ? <MailOpen className="w-5 h-5 text-slate-400" />
                  : <Mail className="w-5 h-5 text-blue-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${notif.leida ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                  {notif.mensaje}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(notif.fecha_creacion).toLocaleString()}
                </p>
              </div>
              {!notif.leida && (
                <button
                  onClick={() => markAsRead(notif.id)}
                  className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Marcar leída
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
