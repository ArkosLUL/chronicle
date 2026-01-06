import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function NavBar() {
  const location = useLocation();
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <Link to="/" className="text-xl font-bold">
        Chronicle
      </Link>
      <div>
        {isLoading ? null : isAuthenticated ? (
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Logout
          </button>
        ) : (
          <Link
            to={`/login?from=${encodeURIComponent(location.pathname + location.search)}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
