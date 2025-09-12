import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, Shield } from "lucide-react";
import { LoginPage } from "@/pages/login";
import { useState, useRef, useEffect } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('Layout render - showDropdown:', showDropdown);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const navigation = [
    { name: "Topics", href: "/topics", current: location.pathname.startsWith("/topics") || location.pathname === "/" },
    { name: "Runs", href: "/runs", current: location.pathname.startsWith("/runs") },
    ...(user?.role === 'admin' ? [{ name: "Members", href: "/members", current: location.pathname.startsWith("/members") }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav>
        <div className="container">
          <h1>News Agent</h1>
          <div className="nav-links">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={item.current ? "active" : ""}
              >
                {item.name}
              </Link>
            ))}
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative" ref={dropdownRef}>
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || user.email}
                  className="w-8 h-8 rounded-full cursor-pointer hover:opacity-80"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Avatar clicked, current dropdown state:', showDropdown);
                    setShowDropdown(!showDropdown);
                  }}
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="user-avatar-fallback"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Avatar clicked, current dropdown state:', showDropdown);
                    setShowDropdown(!showDropdown);
                  }}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
              )}

              {showDropdown && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-content">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || user.email}
                          className="user-dropdown-avatar"
                        />
                      ) : (
                        <div className="user-dropdown-avatar-fallback">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="user-dropdown-info">
                        <div className="user-dropdown-name">
                          {user.name || 'User'}
                        </div>
                        <div className="user-dropdown-email">
                          {user.email}
                        </div>
                        {user.role === 'admin' && (
                          <div className="user-dropdown-admin">
                            <Shield className="w-3 h-3 text-red-600" />
                            <span>Admin</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      logout();
                    }}
                    className="user-dropdown-button"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        {children}
      </main>
    </div>
  );
}