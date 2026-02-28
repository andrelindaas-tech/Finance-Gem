import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function AppLayout() {
    return (
        <div className="min-h-screen bg-background text-foreground flex">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 pb-20 md:pb-0">
                <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
                    {/* Framer Motion AnimatePresence could wrap Outlet here later */}
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <BottomNav />
        </div>
    );
}
