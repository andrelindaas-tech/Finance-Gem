import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, TrendingUp, TrendingDown, Minus, Sparkles, Clock, ArrowUpRight } from 'lucide-react';
import { fetchArcticTopPicks, ArcticInsightResponse, TopPick } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Sentiment styles
const sentimentConfig = {
    bullish: { color: 'text-success', bg: 'bg-success/15', icon: TrendingUp, label: 'Kjøp' },
    bearish: { color: 'text-destructive', bg: 'bg-destructive/15', icon: TrendingDown, label: 'Selg' },
    neutral: { color: 'text-muted-foreground', bg: 'bg-secondary', icon: Minus, label: 'Hold' },
};

const changeBadge = (change?: string) => {
    if (!change) return null;
    const styles: Record<string, string> = {
        'Ny': 'bg-primary/20 text-primary',
        'Opp': 'bg-success/15 text-success',
        'Ned': 'bg-destructive/15 text-destructive',
        'Ut': 'bg-destructive/20 text-destructive line-through',
        'Uendret': 'bg-secondary text-muted-foreground',
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${styles[change] || styles['Uendret']}`}>
            {change}
        </span>
    );
};

function PickCard({ pick, index }: { pick: TopPick; index: number }) {
    const navigate = useNavigate();
    const sentiment = sentimentConfig[pick.sentiment];
    const SentimentIcon = sentiment.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => navigate(`/asset/${pick.ticker.toLowerCase()}`)}
            className="bg-card/40 border border-border rounded-2xl p-5 hover:bg-card/60 transition-colors cursor-pointer group"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl ${sentiment.bg} flex items-center justify-center`}>
                        <SentimentIcon className={`w-5 h-5 ${sentiment.color}`} />
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <span className="font-bold text-base">{pick.ticker}</span>
                            {pick.isNew && changeBadge('Ny')}
                            {!pick.isNew && pick.change !== 'Uendret' && changeBadge(pick.change)}
                        </div>
                        <p className="text-sm text-muted-foreground">{pick.name}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${sentiment.bg} ${sentiment.color}`}>
                        {sentiment.label}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
            <p className="text-sm text-muted-foreground/80 leading-relaxed">{pick.reasoning}</p>
        </motion.div>
    );
}

export default function Insights() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<ArcticInsightResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Load last saved insight from Supabase on mount
    useEffect(() => {
        async function loadLatest() {
            if (!user) return;

            const { data: rows } = await supabase
                .from('insights_feed')
                .select('*')
                .eq('user_id', user.id)
                .eq('broker_name', 'Arctic Securities')
                .order('created_at', { ascending: false })
                .limit(1);

            if (rows && rows.length > 0) {
                try {
                    const parsed = JSON.parse(rows[0].ai_summary);
                    setData(parsed);
                    setLastUpdated(new Date(rows[0].created_at).toLocaleDateString('nb-NO', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }));
                } catch (e) {
                    console.error('Failed to parse stored insight:', e);
                }
            }
        }

        loadLatest();
    }, [user]);

    const handleRefresh = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchArcticTopPicks();
            setData(result);
            setLastUpdated(new Date().toLocaleDateString('nb-NO', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }));

            // Save to Supabase for history
            if (user) {
                await supabase.from('insights_feed').insert({
                    user_id: user.id,
                    broker_name: 'Arctic Securities',
                    ai_summary: JSON.stringify(result),
                    sentiment: result.picks.filter(p => p.sentiment === 'bullish').length > result.picks.length / 2 ? 'bullish' : 'neutral',
                });
            }
        } catch (e: any) {
            console.error('Error fetching insights:', e);
            setError(e.message || 'Noe gikk galt. Prøv igjen.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Innsikt</h1>
                    <p className="text-muted-foreground mt-1">AI-drevet markedsanalyse fra Arctic Securities</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="flex items-center space-x-2 bg-primary text-primary-foreground font-semibold px-5 py-3 rounded-full hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{isLoading ? 'Henter...' : 'Oppdater Arctic'}</span>
                </button>
            </header>

            {/* Error State */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 text-destructive text-sm"
                    >
                        ⚠️ {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading State */}
            {isLoading && !data && (
                <div className="space-y-4">
                    <div className="bg-card/30 border border-border rounded-2xl p-6 animate-pulse">
                        <div className="h-4 bg-secondary rounded w-3/4 mb-3" />
                        <div className="h-3 bg-secondary rounded w-1/2" />
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-card/30 border border-border rounded-2xl p-5 animate-pulse">
                            <div className="flex items-center space-x-3 mb-3">
                                <div className="w-10 h-10 bg-secondary rounded-xl" />
                                <div>
                                    <div className="h-4 bg-secondary rounded w-24 mb-1" />
                                    <div className="h-3 bg-secondary rounded w-36" />
                                </div>
                            </div>
                            <div className="h-3 bg-secondary rounded w-full" />
                        </div>
                    ))}
                </div>
            )}

            {/* Data Loaded */}
            {data && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                >
                    {/* Summary Card */}
                    <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-3 right-3">
                            <Sparkles className="w-5 h-5 text-primary/40" />
                        </div>
                        <div className="flex items-center space-x-2 mb-3">
                            <h2 className="font-bold text-lg">{data.source}</h2>
                            <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase">Top Picks</span>
                        </div>
                        <p className="text-sm text-muted-foreground/90 leading-relaxed">{data.summary}</p>
                        {lastUpdated && (
                            <div className="flex items-center space-x-1.5 mt-4 text-xs text-muted-foreground/60">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Sist oppdatert: {lastUpdated}</span>
                            </div>
                        )}
                    </div>

                    {/* Picks Grid */}
                    <div className="space-y-3">
                        {data.picks.map((pick, i) => (
                            <PickCard key={pick.ticker} pick={pick} index={i} />
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Empty State */}
            {!data && !isLoading && (
                <div className="text-center border border-dashed border-border rounded-3xl bg-card/30 p-12">
                    <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ingen oppdateringer enda</h3>
                    <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                        Trykk på "Oppdater Arctic" for å hente de nyeste aksje&shy;anbefalingene fra Arctic Securities.
                    </p>
                    <button
                        onClick={handleRefresh}
                        className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full hover:bg-primary/90 transition-all active:scale-95"
                    >
                        Hent anbefalinger
                    </button>
                </div>
            )}
        </div>
    );
}
