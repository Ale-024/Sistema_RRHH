import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { User, Phone, MapPin, AlertCircle, Save, Loader2, Key, Lock } from 'lucide-react';
import api from '../services/api';

export default function EmployeeProfile() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    telefono: '',
    direccion: '',
    contacto_emergencia: '',
    telefono_emergencia: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/employee/profile');
      setProfile(res.data);
      setFormData({
        telefono: res.data.telefono || '',
        direccion: res.data.direccion || '',
        contacto_emergencia: res.data.contacto_emergencia || '',
        telefono_emergencia: res.data.telefono_emergencia || ''
      });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error al cargar perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.put('/employee/profile', formData);
      setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar los cambios' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await api.put('/employee/profile/password', passwordData);
      setPasswordMessage({ type: 'success', text: 'Contraseña actualizada exitosamente' });
      setPasswordData({ currentPassword: '', newPassword: '' });
    } catch (error) {
      setPasswordMessage({ type: 'error', text: error.response?.data?.message || 'Error al cambiar contraseña' });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
        <p className="text-slate-500 mt-1">Consulta y actualiza tu información personal</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        {/* Header Info */}
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex items-center space-x-6">
          <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white shadow-sm">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{profile?.nombres} {profile?.apellidos}</h2>
            <p className="text-brand-blue font-medium">{profile?.puesto?.titulo}</p>
            <p className="text-sm text-slate-500 mt-1">{profile?.puesto?.departamento?.nombre}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">DNI</label>
              <input type="text" disabled value={profile?.dni || ''} className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Ingreso</label>
              <input type="text" disabled value={profile?.fecha_ingreso ? new Date(profile.fecha_ingreso).toLocaleDateString() : ''} className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed" />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Información de Contacto (Editable)</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                <Phone className="w-4 h-4 mr-1 text-slate-400" /> Teléfono
              </label>
              <input 
                type="text" 
                value={formData.telefono} 
                onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center">
                <MapPin className="w-4 h-4 mr-1 text-slate-400" /> Dirección
              </label>
              <input 
                type="text" 
                value={formData.direccion} 
                onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-orange-500" /> Contacto de Emergencia
              </h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                value={formData.contacto_emergencia} 
                onChange={(e) => setFormData({...formData, contacto_emergencia: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono de Emergencia</label>
              <input 
                type="text" 
                value={formData.telefono_emergencia} 
                onChange={(e) => setFormData({...formData, telefono_emergencia: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-200 flex items-center">
          <Lock className="w-6 h-6 text-slate-400 mr-3" />
          <h2 className="text-xl font-bold text-slate-900">Cambiar Contraseña</h2>
        </div>
        
        <form onSubmit={handlePasswordChange} className="p-6 sm:p-8 space-y-6">
          {passwordMessage.text && (
            <div className={`p-4 rounded-lg ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {passwordMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Actual</label>
              <input 
                type="password" 
                required
                value={passwordData.currentPassword} 
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contraseña</label>
              <input 
                type="password" 
                required
                value={passwordData.newPassword} 
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-all" 
              />
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {changingPassword ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Key className="w-5 h-5 mr-2" />}
              Actualizar Contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
