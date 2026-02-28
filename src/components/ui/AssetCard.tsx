import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface AssetCardProps {
    id: string;
    ticker: string;
    name: string;
    value: number;
    changeAmount: number;
    changePercent: number;
    weight: number;
    totalReturnAmount?: number;
    totalReturnPercent?: number;
    currency?: string;
}

export function AssetCard({ id, ticker, name, value, changeAmount, changePercent, weight, totalReturnAmount, totalReturnPercent, currency = 'NOK' }: AssetCardProps) {
    const navigate = useNavigate();
    const isPositive = changeAmount >= 0;

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/asset/${id}`)}
            className="bg-card/40 hover:bg-card/60 transition-colors cursor-pointer border border-border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0"
        >
            <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg">{ticker}</span>
                    <span className="text-muted-foreground text-sm bg-black/20 px-2 py-0.5 rounded-md">{weight.toFixed(1)}%</span>
                </div>
                <span className="text-muted-foreground text-sm">{name}</span>
            </div>

            <div className="flex flex-col items-start sm:items-end">
                <span className="font-semibold text-lg">{value.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</span>
                {totalReturnAmount !== undefined && totalReturnPercent !== undefined ? (
                    <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className={`text-sm font-medium ${totalReturnAmount >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {totalReturnAmount >= 0 ? '+' : ''}{totalReturnAmount.toLocaleString('nb-NO', { maximumFractionDigits: 0 })}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${totalReturnAmount >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                            {totalReturnPercent >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}%
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className={`text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? '+' : ''}{changeAmount.toLocaleString('nb-NO')}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${isPositive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
