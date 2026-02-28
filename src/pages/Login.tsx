import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Kunne ikke logge inn.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            setError('Sjekk e-posten din for bekreftelseslenke.');
        } catch (err: any) {
            setError(err.message || 'Kunne ikke registrere bruker.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="w-full max-w-sm"
            >
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Finance Gem</h1>
                    <p className="text-muted-foreground">Investering og Disiplin</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4 bg-card/50 p-6 rounded-3xl border border-border shadow-sm backdrop-blur-md">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground px-1" htmlFor="email">E-post</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="din@epost.no"
                            className="w-full bg-input px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all border border-border"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground px-1" htmlFor="password">Passord</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="w-full bg-input px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all border border-border"
                        />
                    </div>

                    <div className="pt-2 space-y-3">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-2xl flex items-center justify-center transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Logg inn'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSignUp}
                            disabled={isLoading}
                            className="w-full bg-secondary text-secondary-foreground font-medium py-3 rounded-2xl transition-all hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-70"
                        >
                            Opprett konto
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
