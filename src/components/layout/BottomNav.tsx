import { NavLink } from 'react-router-dom';
import { Home, LineChart, Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BottomNav() {
    const navItems = [
        { name: 'Dashboard', path: '/', icon: Home },
        { name: 'Innsikt', path: '/insights', icon: LineChart },
        { name: 'Disiplin', path: '/discipline', icon: Shield },
        { name: 'Profil', path: '/profile', icon: User },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border pb-safe pt-2 px-4 z-50">
            <div className="flex justify-around items-center">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex flex-col items-center p-2 rounded-xl transition-all duration-200",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className={cn("w-6 h-6 mb-1", { "stroke-[2.5px]": isActive })} />
                                <span className="text-[10px] font-medium">{item.name}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
}
