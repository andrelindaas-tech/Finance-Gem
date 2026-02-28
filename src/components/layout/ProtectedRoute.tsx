import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
    const { session, isLoading } = useAuth();
    const [showLoading, setShowLoading] = useState(false);

    useEffect(() => {
        // Only show loader if loading takes more than 100ms to prevent screen flashing
        let timer: NodeJS.Timeout;
        if (isLoading) {
            timer = setTimeout(() => setShowLoading(true), 100);
        } else {
            setShowLoading(false);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    if (isLoading) {
        if (!showLoading) return null;
        return (
            <div className="flex bg-background h-screen w-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        // Redirect unauthenticated users to a login page (we will build this next)
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
