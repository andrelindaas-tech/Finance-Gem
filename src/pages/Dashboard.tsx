import { useState, useEffect, useMemo } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Loader2, Plus } from 'lucide-react';
import { AssetCard } from '@/components/ui/AssetCard';
import { motion } from 'framer-motion';
import { fetchQuotes } from '@/lib/yahoo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AddAssetModal } from '@/components/ui/AddAssetModal';

export default function Dashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('Aksjer');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // DB state
    const [dbHoldings, setDbHoldings] = useState<any[]>([]);
    // Yahoo Quote State
    const [quotes, setQuotes] = useState<Record<string, any>>({});

    // 1. Fetch from Supabase
    const fetchHoldings = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from('holdings')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            setDbHoldings(data || []);

            // 2. Fetch Live Quotes from Yahoo for these tickers
            if (data && data.length > 0) {
                const tickers = data.map(d => d.ticker);
                const liveQuotes = await fetchQuotes(tickers);

                const quoteMap: Record<string, any> = {};
                liveQuotes.forEach((q: any) => {
                    quoteMap[q.symbol] = q;
                });
                setQuotes(quoteMap);
            }
        } catch (e) {
            console.error("Error fetching holdings from DB:", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Run on mount and after a new asset is added
    useEffect(() => {
        fetchHoldings();
    }, [user]);

    // Calculate aggregated portfolio data dynamically based on the active tab filters
    const portfolioData = useMemo(() => {
        let totalValue = 0;
        let totalDayChange = 0;

        // Filter DB holdings by tab (Aksjer = stock, Fond = fund)
        const typeFilter = activeTab === 'Aksjer' ? 'stock' : 'fund';
        const filteredHoldings = dbHoldings.filter(h => h.asset_type === typeFilter);

        const assets = filteredHoldings.map(asset => {
            const quote = quotes[asset.ticker];
            const currentPrice = quote?.regularMarketPrice || asset.average_buy_price;
            const value = currentPrice * asset.quantity;

            // Day change calculation
            const dayChangeAmount = (quote?.regularMarketChange || 0) * asset.quantity;
            const dayChangePercent = quote?.regularMarketChangePercent || 0;

            totalValue += value;
            totalDayChange += dayChangeAmount;

            return {
                id: asset.ticker.toLowerCase(),
                ticker: asset.ticker,
                name: quote?.shortName || quote?.longName || asset.ticker,
                value,
                changeAmount: dayChangeAmount,
                changePercent: dayChangePercent,
                currency: quote?.currency || 'NOK',
                // For internal components if needed later:
                shares: asset.quantity,
                gav: asset.average_buy_price
            };
        });

        // Add sorting and weights
        assets.sort((a, b) => b.value - a.value);
        const mappedAssets = assets.map(a => ({
            ...a,
            weight: totalValue > 0 ? (a.value / totalValue) * 100 : 0
        }));

        const totalDayChangePercent = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;

        return {
            totalValue,
            totalDayChange,
            totalDayChangePercent,
            assets: mappedAssets
        };
    }, [dbHoldings, quotes, activeTab]);

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Total Wealth</h1>
                <SegmentedControl
                    options={['Aksjer', 'Fond']}
                    selectedOption={activeTab}
                    onChange={setActiveTab}
                />
            </header>

            {/* Total Wealth Card */}
            <section className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

                <p className="text-muted-foreground text-sm font-medium mb-2 relative z-10">Porteføljeverdi ({activeTab})</p>
                <div className="flex items-baseline space-x-2 relative z-10">
                    <h2 className="text-5xl font-bold tracking-tight">
                        {isLoading ? (
                            <div className="w-48 h-12 bg-secondary animate-pulse rounded-xl inline-block" />
                        ) : (
                            portfolioData.totalValue.toLocaleString('nb-NO', { maximumFractionDigits: 0 })
                        )}
                    </h2>
                    {!isLoading && <span className="text-xl font-semibold text-muted-foreground">NOK</span>}
                </div>

                <div className="flex items-center mt-4 space-x-3 relative z-10 h-8">
                    {!isLoading && (
                        <>
                            <div className={`flex items-center px-3 py-1 rounded-lg ${portfolioData.totalDayChange >= 0 ? 'bg-success/15 text-success/90' : 'bg-destructive/15 text-destructive/90'}`}>
                                <span className="font-semibold text-sm">
                                    {portfolioData.totalDayChange >= 0 ? '+' : ''}
                                    {portfolioData.totalDayChange.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} NOK
                                    ({portfolioData.totalDayChangePercent.toFixed(2)}%)
                                </span>
                            </div>
                            <span className="text-muted-foreground text-sm font-medium">i dag</span>
                        </>
                    )}
                </div>
            </section>

            {/* Holdings List */}
            <section className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold tracking-tight">Dine {activeTab}</h3>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : portfolioData.assets.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                    >
                        {portfolioData.assets.map((asset: any) => (
                            <AssetCard key={asset.id} {...asset} />
                        ))}
                    </motion.div>
                ) : (
                    <div className="text-center bg-secondary/30 rounded-3xl p-8 border border-border border-dashed mt-4">
                        <p className="text-muted-foreground">Du har ingen {activeTab.toLowerCase()} i porteføljen din enda.</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="mt-4 text-primary font-medium hover:underline"
                        >
                            Legg til din første investering
                        </button>
                    </div>
                )}
            </section>

            {/* Floating Action Button */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="fixed bottom-24 right-6 bg-primary text-primary-foreground p-4 rounded-full shadow-xl hover:bg-primary/90 transition-transform hover:scale-105 active:scale-95 z-40 flex items-center justify-center"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Add Asset Modal */}
            <AddAssetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    fetchHoldings(); // Refresh list automatically
                }}
            />
        </div>
    );
}
