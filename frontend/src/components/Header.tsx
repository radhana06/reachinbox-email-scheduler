import { useAuth } from '../context/AuthContext';
import { Button } from '../ui/Button';
import { SlackButton } from './SlackButton';

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h1 className="text-xl font-bold text-green-700">ReachInbox <span className="font-normal text-gray-500">Scheduler</span></h1>
      <div className="flex items-center gap-4">
        <SlackButton />
        {user && (
          <div className="flex items-center gap-3">
            <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full bg-gray-200" />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        )}
      </div>
    </header>
  );
}
