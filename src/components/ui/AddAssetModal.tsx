import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import { searchTickers } from '@/lib/yahoo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AddAssetModal({ isOpen, onClose, onSuccess }: AddAssetModalProps) {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
    const [shares, setShares] = useState('');
    const [gav, setGav] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length > 1 && !selectedAsset) {
                setIsSearching(true);
                const results = await searchTickers(query);
                // Don't arbitrarily filter out quote types since some mutual funds are classified weirdly by Yahoo
                setResults(results);
                setIsSearching(false);
            } else {
                setResults([]);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query, selectedAsset]);

    const handleSave = async () => {
        if (!user || !selectedAsset || !shares || !gav) return;
        setIsSaving(true);

        try {
            const numShares = parseFloat(shares);
            const averagePrice = parseFloat(gav);

            // The DB schema needs ticker, quantity, average_buy_price, user_id
            const { error } = await supabase
                .from('holdings')
                .upsert({
                    user_id: user.id,
                    ticker: selectedAsset.symbol,
                    quantity: numShares,
                    average_buy_price: averagePrice,
                    asset_type: selectedAsset.quoteType === 'ETF' || selectedAsset.quoteType === 'MUTUALFUND' ? 'fund' : 'stock',
                }); // Removing onConflict since we don't have a unique constraint set up yet
            if (error) throw error;

            onSuccess();
            handleClose();
        } catch (error) {
            console.error("Failed to save asset:", error);
            alert("Kunne ikke lagre posisjonen. Prøv igjen.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setQuery('');
        setResults([]);
        setSelectedAsset(null);
        setShares('');
        setGav('');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex flex-col items-center justify-end sm:justify-center z-50 pointer-events-none p-4">
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-border flex justify-between items-center bg-card/50 backdrop-blur-md sticky top-0 z-10">
                                <h2 className="text-xl font-bold tracking-tight">Legg til posisjon</h2>
                                <button onClick={handleClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {!selectedAsset ? (
                                    <div className="space-y-4">
                                        {/* Search Input */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                autoFocus
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Søk etter ticker eller selskap..."
                                                className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary transition-all text-base"
                                            />
                                            {isSearching && (
                                                <Loader2 className="absolute right-3 top-3 w-5 h-5 text-muted-foreground animate-spin" />
                                            )}
                                        </div>

                                        {/* Search Results */}
                                        <div className="mt-4 space-y-2">
                                            {results.map((r, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedAsset(r)}
                                                    className="w-full text-left p-4 rounded-xl hover:bg-secondary/50 border border-transparent hover:border-border transition-colors flex justify-between items-center group"
                                                >
                                                    <div>
                                                        <p className="font-semibold group-hover:text-primary transition-colors">{r.longname || r.shortname || r.symbol}</p>
                                                        <p className="text-sm text-muted-foreground line-clamp-1">{r.symbol}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end space-y-1">
                                                        <p className="text-xs font-medium bg-secondary px-2 py-1 rounded text-muted-foreground uppercase">{r.exchDisp}</p>
                                                        {r.typeDisp && <p className="text-[10px] text-muted-foreground/60">{r.typeDisp}</p>}
                                                    </div>
                                                </button>
                                            ))}
                                            {query.length > 2 && !isSearching && results.length === 0 && (
                                                <div className="text-center p-8 text-muted-foreground text-sm">
                                                    Ingen resultater funnet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="space-y-6"
                                    >
                                        <div className="p-4 bg-secondary/30 rounded-2xl border border-border flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-lg">{selectedAsset.symbol}</p>
                                                <p className="text-sm text-muted-foreground">{selectedAsset.shortname || selectedAsset.longname}</p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedAsset(null)}
                                                className="text-xs font-medium text-primary hover:text-primary/80"
                                            >
                                                Endre
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1">Antall (Shares)</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    inputMode="decimal"
                                                    value={shares}
                                                    onChange={(e) => setShares(e.target.value)}
                                                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-lg"
                                                    placeholder="0.00"
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-muted-foreground mb-1">Gitt anskaffelsesverdi (GAV i {selectedAsset.currency || 'NOK'})</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    inputMode="decimal"
                                                    value={gav}
                                                    onChange={(e) => setGav(e.target.value)}
                                                    className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-lg"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || !shares || !gav}
                                            className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-full mt-4 flex items-center justify-center space-x-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Lagre Posisjon</span>}
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
