'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/groups', label: 'Groups', icon: '👥' },
  { href: '/expenses', label: 'Expenses', icon: '📋' },
  { href: '/payments', label: 'Pay', icon: '💳' },
  { href: '/notifications', label: 'Alerts', icon: '🔔' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = user?.is_admin
    ? [...navItems, { href: '/admin', label: 'Admin', icon: '⚙️' }]
    : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${
                active ? 'text-[#FF7043]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}