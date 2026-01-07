import { Link, useLocation } from "react-router-dom";
import { Settings, Upload, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../ui/NavigationMenu/navigation-menu";

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
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Account</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="w-40">
                    <li>
                      <NavigationMenuLink asChild>
                        <Link to="/settings">
                          <Settings />
                          Settings
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <Link to="/upload">
                          <Upload />
                          Upload
                        </Link>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink asChild>
                        <button onClick={logout} className="w-full">
                          <LogOut />
                          Sign Out
                        </button>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        ) : (
          <Link
            to={`/login?from=${encodeURIComponent(location.pathname + location.search)}`}
          >
            <Button>Sign In</Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
