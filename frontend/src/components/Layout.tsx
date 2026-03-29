import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-orange-400 font-bold text-xl tracking-wide">
            Drumpath
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-gray-300 hover:text-orange-400 transition-colors text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              to="/skills"
              className="text-gray-300 hover:text-orange-400 transition-colors text-sm font-medium"
            >
              Skills
            </Link>
            <Link
              to="/practice"
              className="text-gray-300 hover:text-orange-400 transition-colors text-sm font-medium"
            >
              Practice
            </Link>
            <button
              onClick={handleLogout}
              className="ml-4 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
