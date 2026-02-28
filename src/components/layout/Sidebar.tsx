import { NavLink } from 'react-router-dom';
import { Home, LineChart, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils'; // We'll add this utility next

export default function Sidebar() {
    const navItems = [
        { name: 'Dashboard', path: '/', icon: Home },
        { name: 'Innsikt', path: '/insights', icon: LineChart },
        { name: 'Disiplin', path: '/discipline', icon: Shield },
        { name: 'Profil', path: '/profile', icon: User },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 bg-card/50 backdrop-blur-xl border-r border-border h-screen fixed left-0 top-0 p-4">
            <div className="mb-8 px-4">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Finance Gem</h1>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200",
                                isActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
