import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: "Topics", href: "/topics", current: location.pathname.startsWith("/topics") || location.pathname === "/" },
    { name: "Runs", href: "/runs", current: location.pathname.startsWith("/runs") },
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
        </div>
      </nav>

      <main>
        {children}
      </main>
    </div>
  );
}