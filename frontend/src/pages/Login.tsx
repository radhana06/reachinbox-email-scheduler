import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { googleLoginUrl } from '../lib/api';
import { Spinner } from '../ui/Button';

export default function Login() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner size={28} /></div>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <h1 className="text-2xl font-bold text-green-700">ReachInbox</h1>
        <p className="mt-2 text-gray-500">Schedule cold emails at scale.</p>
        <a
          href={googleLoginUrl}
          className="mt-8 flex items-center justify-center gap-3 rounded-lg border px-4 py-2.5 font-medium hover:bg-gray-50"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" className="h-5 w-5" />
          Login with Google
        </a>
      </div>
    </div>
  );
}
