import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { esRolAdministrativo } from '../shared/roles';

function Monograma({ tamano = 'w-12 h-12', texto = 'text-lg' }) {
  return (
    <div className={`${tamano} border border-white/30 bg-white/5 flex items-center justify-center shrink-0`}>
      <span className={`font-serif font-bold text-white ${texto} leading-none`}>MT</span>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [requiereOtp, setRequiereOtp] = useState(false);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const setToken = useAuthStore((state) => state.setToken);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (mfaSetup) {
        await api.post('/auth/mfa/verify', { code: otp });
      }
      const res = await api.post('/auth/login', { email, password, ...(otp ? { otp } : {}) });
      if (res.data.mfaSetupRequired) {
        setToken(res.data.token);
        const setup = await api.post('/auth/mfa/setup');
        setMfaSetup({ secret: setup.data.secret });
        setError('Configure su aplicación autenticadora y confirme el código.');
        return;
      }
      login(res.data.user, res.data.token);
      setMfaSetup(null);
      setRequiereOtp(false);

      if (res.data.user.debeCambiarPassword) {
        navigate('/employee/profile', {
          state: { avisoCambioPassword: true },
        });
        return;
      }
      navigate(esRolAdministrativo(res.data.user) ? '/admin' : '/employee');
    } catch (err) {
      if (err.response?.data?.type?.endsWith('/mfa-requerido')) setRequiereOtp(true);
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-700 flex flex-col sm:flex-row">
      {/* ── Panel de marca ─────────────────────────────────────────── */}
      <div className="relative sm:w-[45%] bg-brand-DEFAULT overflow-hidden flex flex-col justify-between p-8 lg:p-14">
        {/* Textura geométrica discreta */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/10" />
          <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full border border-white/[0.07]" />
          <div className="absolute bottom-[-8rem] left-[-6rem] w-[26rem] h-[26rem] rounded-full bg-brand-800/60" />
          <div className="absolute inset-y-0 right-0 w-px bg-white/10" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-4">
            <Monograma />
            <div>
              <p className="font-semibold tracking-[0.18em] uppercase text-white">Marketing Total</p>
              <p className="text-brand-200 text-xs tracking-widest uppercase mt-0.5">Gestión Humana</p>
            </div>
          </div>
        </div>

        <div className="relative hidden sm:block my-10">
          <h2 className="font-serif text-3xl lg:text-4xl text-white leading-snug max-w-md">
            Las personas de la empresa,
            <span className="block font-normal italic text-brand-200 mt-1">en orden y a tiempo.</span>
          </h2>
          <p className="text-brand-100/85 max-w-sm leading-relaxed mt-5 text-sm">
            Expedientes, asistencia, solicitudes y nómina en un solo lugar,
            con los controles que exige cada proceso.
          </p>
        </div>

        <div className="relative hidden sm:block">
          <dl className="grid grid-cols-3 gap-4 border-t border-white/15 pt-5">
            {['Asistencia', 'Solicitudes', 'Nómina'].map((m) => (
              <div key={m}>
                <dt className="text-white text-sm font-medium">{m}</dt>
                <dd className="text-brand-200/80 text-xs mt-0.5">Módulo interno</dd>
              </div>
            ))}
          </dl>
          <p className="text-brand-200/70 text-xs tracking-wide mt-8">
            © {new Date().getFullYear()} Marketing Total · Uso interno
          </p>
        </div>
      </div>

      {/* ── Formulario ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md">
          <div className="sm:hidden mb-8 flex items-center gap-3">
            <Monograma tamano="w-9 h-9" texto="text-sm" />
            <div>
              <p className="font-semibold tracking-[0.18em] uppercase text-sm text-slate-800 dark:text-slate-100">Marketing Total</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 tracking-widest uppercase">Gestión Humana</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="h-1 bg-brand-blue" />
            <div className="p-8 lg:p-10">
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Iniciar sesión</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-7">
                Use su cuenta corporativa para continuar.
              </p>

              {error && (
                <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-4 py-3 text-sm mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="correo" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    id="correo"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    placeholder="nombre@marketingtotal.hn"
                  />
                </div>

                {(requiereOtp || mfaSetup) && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Código de autenticación
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue sm:text-sm tracking-[0.3em]"
                      placeholder="000000"
                    />
                    {mfaSetup && (
                      <div className="mt-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-400">
                        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Configuración de segundo factor
                        </p>
                        <p>Agregue esta clave a su aplicación autenticadora:</p>
                        <code className="block mt-1.5 font-mono text-slate-800 dark:text-slate-100 select-all break-all">
                          {mfaSetup.secret}
                        </code>
                        <p className="mt-1.5 text-slate-500 dark:text-slate-400">
                          Luego ingrese el código de 6 dígitos y continúe.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-brand-blue hover:bg-brand-DEFAULT text-white text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    mfaSetup ? 'Confirmar y activar' : 'Ingresar'
                  )}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Si no tiene credenciales, solicítelas al área de Recursos Humanos.
          </p>
        </div>
      </div>
    </div>
  );
}
