import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";

export function NavBar() {
  const location = useLocation();
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link to="/" className="text-xl font-bold">
        Chronicle
      </Link>
      <div>
        {isLoading ? null : isAuthenticated ? (
          <button
            onClick={logout}
            className="px-4 py-"
          >
            Logout
          </button>
        ) : (
          <Link
            to={`/login?from=${encodeURIComponent(location.pathname + location.search)}`}
          >
            <Button>
              Login
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
