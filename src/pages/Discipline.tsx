import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LogTemptationModal from '../components/ui/LogTemptationModal';

interface TemptationLog {
    id: string;
    ticker: string;
    price_at_logging: number;
    date_logged: string;
    reason_to_skip: string;
}

export default function Discipline() {
    const { user } = useAuth();
    const [isMockModalOpen, setIsMockModalOpen] = useState(false);

    const { data: logs, isLoading, refetch } = useQuery({
        queryKey: ['temptation_logs', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('temptation_log')
                .select('*')
                .order('date_logged', { ascending: false });

            if (error) throw error;
            return data as TemptationLog[];
        },
        enabled: !!user,
    });

    return (
        <div className="space-y-6 pb-24">
            <header className="mb-8 pl-1">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Disiplin</h1>
                <p className="text-neutral-400">Beskytt porteføljen mot dine egne impulser.</p>
            </header>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-blue-500" />
                            Fristelseslogg (FOMO)
                        </h2>
                        <p className="text-sm text-neutral-400 mt-1">Aksjer du hadde lyst til å kjøpe, men klarte å la være.</p>
                    </div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden p-1">
                    {isLoading ? (
                        <div className="p-8 text-center text-neutral-500 animate-pulse">Laster loggen...</div>
                    ) : logs && logs.length > 0 ? (
                        <div className="divide-y divide-neutral-800/50">
                            {logs.map((log) => (
                                <div key={log.id} className="p-5 hover:bg-neutral-800/30 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-white text-lg">{log.ticker}</h3>
                                            <span className="text-xs text-neutral-500 font-medium bg-neutral-800/50 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                {new Date(log.date_logged).toLocaleDateString('no-NO', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-neutral-400">Pris ved logg</div>
                                            <div className="font-medium text-white">{log.price_at_logging.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 bg-neutral-950/50 rounded-xl p-3 border border-neutral-800/50">
                                        <span className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-1 block">Hvorfor jeg lot være</span>
                                        <p className="text-sm text-neutral-300 leading-relaxed italic">"{log.reason_to_skip}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center justify-center">
                            <ShieldAlert className="w-12 h-12 text-neutral-700 mb-4" />
                            <h3 className="text-neutral-300 font-medium mb-1">Ingen fristelser logget</h3>
                            <p className="text-neutral-500 text-sm max-w-sm">
                                Neste gang du føler FOMO på en "het" aksje som ikke passer strategien din, logg den her i stedet for å kjøpe den.
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setIsMockModalOpen(true)}
                    className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-2xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Logg en ny fristelse
                </button>
            </section>

            <LogTemptationModal
                isOpen={isMockModalOpen}
                onClose={() => setIsMockModalOpen(false)}
                onSuccess={() => refetch()}
            />
        </div>
    );
}
