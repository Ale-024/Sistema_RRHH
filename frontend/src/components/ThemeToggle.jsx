import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

function aplicarTemaInicial() {
  const oscuro =
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', oscuro);
  return oscuro;
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(aplicarTemaInicial);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand-blue dark:hover:text-blue-400 transition-colors rounded-full"
      title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
