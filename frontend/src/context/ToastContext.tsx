import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error';
interface Toast { id: number; kind: Kind; text: string }
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
