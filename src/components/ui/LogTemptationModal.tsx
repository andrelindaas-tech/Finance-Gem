import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface LogTemptationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function LogTemptationModal({ isOpen, onClose, onSuccess }: LogTemptationModalProps) {
    const { user } = useAuth();
    const [ticker, setTicker] = useState('');
    const [price, setPrice] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !ticker || !price || !reason) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('temptation_log')
                .insert([
                    {
                        user_id: user.id,
                        ticker: ticker.toUpperCase(),
                        price_at_logging: parseFloat(price.replace(',', '.')),
                        reason_to_skip: reason,
                    }
                ]);

            if (error) throw error;

            setTicker('');
            setPrice('');
            setReason('');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error logging temptation:', error);
            alert('Kunne ikke lagre loggen. Prøv igjen.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl pointer-events-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold">Logg en fristelse (FOMO)</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 text-neutral-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                                        Ticker symbol
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-neutral-500" />
                                        </div>
                                        <input
                                            type="text"
                                            value={ticker}
                                            onChange={(e) => setTicker(e.target.value)}
                                            placeholder="f.eks EQNR.OL"
                                            className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                                        Pris akkurat nå (NOK)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1">
                                        Hvorfor kjøper du ikke?
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="F.eks: Oppfyller ikke reglene mine for ROE, har for mye gjeld, osv..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors mt-6 flex justify-center items-center"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        'Lagre i historikken'
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
