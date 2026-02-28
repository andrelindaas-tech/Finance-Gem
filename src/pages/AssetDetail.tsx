import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit3, Newspaper, Target, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from 'react';
import { fetchChartData, fetchQuotes, fetchKeyStats, processChartDataForRecharts, Range, Interval } from '@/lib/yahoo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function AssetDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const ticker = id?.toUpperCase();

    const [activeTab, setActiveTab] = useState<'oversikt' | 'notater' | 'analytikere' | 'nyheter'>('oversikt');
    const [activeRange, setActiveRange] = useState<Range>('1mo');
    const [isLoading, setIsLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);
    const [quote, setQuote] = useState<any>(null);
    const [holding, setHolding] = useState<any>(null);
    const [keyStats, setKeyStats] = useState<any>(null);

    useEffect(() => {
        async function loadData() {
            if (!ticker) return;
            setIsLoading(true);

            try {
                // Fetch current user holding if it exists
                if (user) {
                    const { data: holdingData } = await supabase
                        .from('holdings')
                        .select('*')
                        .eq('user_id', user.id)
                        .eq('ticker', ticker)
                        .single();

                    if (holdingData) {
                        setHolding(holdingData);
                    }
                }

                // Fetch current quote
                const quotesData = await fetchQuotes([ticker]);
                if (quotesData.length > 0) {
                    setQuote(quotesData[0]);
                }

                // Fetch chart data
                // Determine interval based on range
                let interval: Interval = '1d';
                if (activeRange === '1d') interval = '5m';
                else if (activeRange === '5d') interval = '15m';
                else if (activeRange === '1mo') interval = '1d';
                else if (['3mo', '6mo', 'ytd', '1y'].includes(activeRange)) interval = '1d';
                else interval = '1wk';

                const rawChartData = await fetchChartData(ticker, activeRange, interval);
                if (rawChartData) {
                    setChartData(processChartDataForRecharts(rawChartData));
                }

                // Fetch key statistics (P/E, EPS, etc.)
                const stats = await fetchKeyStats(ticker);
                if (stats) {
                    setKeyStats(stats);
                }

            } catch (e) {
                console.error("Error loading asset data", e);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [ticker, activeRange, user]);

    // Background fetch historical performances for the tabs
    const [rangePerformances, setRangePerformances] = useState<Record<string, number>>({});
    useEffect(() => {
        async function fetchPerformances() {
            if (!ticker) return;
            const rangesToFetch: Range[] = ['1d', '1wk', '1mo', '3mo', '6mo', 'ytd', '1y', '3y', '5y', 'max'];
            const results: Record<string, number> = {};

            await Promise.all(rangesToFetch.map(async (r) => {
                try {
                    // For performance metrics, we just need the 1d interval strictly 
                    // to get the start and end price accurately over that period. 
                    // Max range requires 1mo interval to not blow up the payload.
                    const interval = r === 'max' || r === '5y' || r === '3y' ? '1mo' : '1d';
                    const data = await fetchChartData(ticker, r, interval);
                    if (data && data.indicators?.quote?.[0]?.close) {
                        const closes = data.indicators.quote[0].close.filter((c: number | null) => c !== null);
                        if (closes.length >= 2) {
                            const start = closes[0];
                            const current = closes[closes.length - 1];
                            results[r] = ((current - start) / start) * 100;
                        } else if (closes.length === 1 && r === '1d' && data.meta?.chartPreviousClose) {
                            // Fallback for 1d if only current price is available
                            const current = closes[0];
                            const start = data.meta.chartPreviousClose;
                            results[r] = ((current - start) / start) * 100;
                        }
                    }
                } catch (e) {
                    // Silently ignore individual range fails
                }
            }));

            setRangePerformances(results);
        }

        // Only run this once when the ticker mounts
        if (Object.keys(rangePerformances).length === 0) {
            fetchPerformances();
        }
    }, [ticker]);

    const name = quote?.shortName || quote?.longName || ticker || 'Unknown Asset';
    const currentPrice = quote?.regularMarketPrice || 0;
    const changeAmount = quote?.regularMarketChange || 0;
    const changePercent = quote?.regularMarketChangePercent || 0;
    const isPositive = changeAmount >= 0;
    const currency = quote?.currency || 'NOK';

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 pb-20"
        >
            {/* Header */}
            <header className="flex items-center space-x-4 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-full hover:bg-secondary transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
                        {isLoading ? (
                            <div className="w-32 h-6 bg-secondary animate-pulse rounded-md" />
                        ) : (
                            <>
                                <span>{name}</span>
                                <span className="text-sm font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{ticker}</span>
                            </>
                        )}
                    </h1>
                </div>
            </header>

            {/* Main Stats & Chart Area */}
            <section className="bg-card/40 border border-border rounded-3xl p-6">
                <div className="mb-6">
                    {isLoading ? (
                        <div className="space-y-2">
                            <div className="w-40 h-10 bg-secondary animate-pulse rounded-xl" />
                            <div className="w-48 h-6 bg-secondary animate-pulse rounded-md" />
                        </div>
                    ) : (
                        <>
                            <h2 className="text-4xl font-bold">{currentPrice.toLocaleString('nb-NO')} {currency}</h2>
                            <div className="flex items-center space-x-2 mt-2">
                                <span className={`font-medium px-2 py-0.5 rounded-md text-sm ${isPositive ? 'text-success bg-success/15' : 'text-destructive bg-destructive/15'}`}>
                                    {isPositive ? '+' : ''}{changeAmount.toLocaleString('nb-NO')} {currency} ({changePercent.toFixed(2)}%)
                                </span>
                                <span className="text-muted-foreground text-sm">i dag</span>
                            </div>
                        </>
                    )}
                </div>

                {/* The Graph */}
                <div className="h-64 w-full -ml-4 flex items-center justify-center relative">
                    {isLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ bottom: 10 }}>
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                                    tickMargin={10}
                                    minTickGap={30} // prevents labels from bunching up
                                />
                                <YAxis domain={['auto', 'auto']} hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '12px' }}
                                    itemStyle={{ color: 'var(--color-foreground)' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                {(() => {
                                    // Determine graph color from the selected range performance, NOT daily change
                                    const rangePerf = rangePerformances[activeRange];
                                    const chartIsPositive = rangePerf !== undefined
                                        ? rangePerf >= 0
                                        : chartData.length >= 2
                                            ? chartData[chartData.length - 1].price >= chartData[0].price
                                            : isPositive;
                                    return (
                                        <Line
                                            type="monotone"
                                            dataKey="price"
                                            stroke={chartIsPositive ? "var(--color-success)" : "var(--color-destructive)"}
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 6, fill: chartIsPositive ? "var(--color-success)" : "var(--color-destructive)", stroke: 'var(--color-background)', strokeWidth: 2 }}
                                        />
                                    );
                                })()}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-muted-foreground">Ingen grafdata tilgjengelig.</div>
                    )}
                </div>

                {/* Time filters & Performance */}
                <div className="flex justify-between items-center mt-6 bg-secondary/30 p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-none">
                    {([
                        { range: '1d' as Range, label: '1d' },
                        { range: '1wk' as Range, label: '1u' },
                        { range: '1mo' as Range, label: '1m' },
                        { range: '3mo' as Range, label: '3m' },
                        { range: '6mo' as Range, label: '6m' },
                        { range: 'ytd' as Range, label: 'i år' },
                        { range: '1y' as Range, label: '1 år' },
                        { range: '5y' as Range, label: '5 år' },
                        { range: 'max' as Range, label: 'Maks' },
                    ]).map(({ range: t, label }) => {
                        const perf = rangePerformances[t];
                        const perfIsPos = perf !== undefined && perf >= 0;

                        return (
                            <button
                                key={t}
                                onClick={() => setActiveRange(t)}
                                className={`flex flex-col items-center flex-shrink-0 min-w-[50px] px-2 py-2 rounded-xl transition-colors ${activeRange === t ? 'bg-card shadow-sm border border-border/50' : 'hover:bg-secondary/50'}`}
                            >
                                <span className={`text-xs font-semibold ${activeRange === t ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                                {perf !== undefined ? (
                                    <span className={`text-[10px] font-medium mt-0.5 ${perfIsPos ? 'text-success' : 'text-destructive'}`}>
                                        {perfIsPos ? '+' : ''}{perf.toFixed(2)}%
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/50 mt-0.5">--</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Holdings Card */}
            {holding && (
                <section className="bg-card/40 border border-border rounded-3xl p-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <h3 className="font-semibold text-lg">Min beholdning</h3>
                        <span className="text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-0.5 rounded-md uppercase">ASK</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-secondary/40 p-4 rounded-2xl border border-border/50 flex flex-col justify-center">
                            <span className="text-xs text-muted-foreground font-medium mb-1">Antall</span>
                            <span className="font-bold">{holding.quantity.toLocaleString('nb-NO')}</span>
                        </div>
                        <div className="bg-secondary/40 p-4 rounded-2xl border border-border/50 flex flex-col justify-center">
                            <span className="text-xs text-muted-foreground font-medium mb-1">GAV</span>
                            <span className="font-bold">{holding.average_buy_price.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                        </div>
                        <div className="bg-secondary/40 p-4 rounded-2xl border border-border/50 flex flex-col justify-center">
                            <span className="text-xs text-muted-foreground font-medium mb-1">Markedsverdi</span>
                            <span className="font-bold">{(holding.quantity * currentPrice).toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-2 px-1">
                        <span className="text-sm font-medium text-muted-foreground">Avkastning</span>
                        {(() => {
                            const totalInvested = holding.quantity * holding.average_buy_price;
                            const currentValue = holding.quantity * currentPrice;
                            const returnAmount = currentValue - totalInvested;
                            const returnPercent = totalInvested > 0 ? (returnAmount / totalInvested) * 100 : 0;
                            const isReturnPos = returnAmount >= 0;

                            return (
                                <div className={`font-semibold text-sm ${isReturnPos ? 'text-success' : 'text-destructive'} flex space-x-3`}>
                                    <span>{isReturnPos ? '+' : ''}{returnPercent.toFixed(2)}%</span>
                                    <span>{isReturnPos ? '+' : ''}{returnAmount.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} {currency}</span>
                                </div>
                            );
                        })()}
                    </div>
                </section>
            )}

            {/* Tab Menu */}
            <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none">
                <button
                    onClick={() => setActiveTab('oversikt')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'oversikt' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                >
                    Oversikt
                </button>
                <button
                    onClick={() => setActiveTab('notater')}
                    className={`px-4 py-2 flex items-center space-x-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'notater' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                >
                    <Edit3 className="w-4 h-4" />
                    <span>Kjøpsstrategi</span>
                </button>
                <button
                    onClick={() => setActiveTab('analytikere')}
                    className={`px-4 py-2 flex items-center space-x-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'analytikere' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                >
                    <Target className="w-4 h-4" />
                    <span>Analytikere</span>
                </button>
                <button
                    onClick={() => setActiveTab('nyheter')}
                    className={`px-4 py-2 flex items-center space-x-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'nyheter' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                >
                    <Newspaper className="w-4 h-4" />
                    <span>Nyheter</span>
                </button>
            </nav>

            {/* Tab Content Panels */}
            <div className="bg-card/30 border border-border rounded-3xl p-6 min-h-[300px]">
                {activeTab === 'oversikt' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg mb-4">Nøkkeltall</h3>
                        {isLoading ? (
                            <div className="space-y-2">
                                <div className="h-4 bg-secondary rounded w-full animate-pulse" />
                                <div className="h-4 bg-secondary rounded w-5/6 animate-pulse" />
                                <div className="h-4 bg-secondary rounded w-4/6 animate-pulse" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Markedsverdi</span>
                                    <span className="font-bold">{keyStats?.marketCap ? (keyStats.marketCap >= 1e9 ? (keyStats.marketCap / 1e9).toFixed(2) + ' mrd' : (keyStats.marketCap / 1e6).toFixed(0) + ' mill') + ' ' + (keyStats?.currency || currency) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Omsetning</span>
                                    <span className="font-bold">{keyStats?.revenue ? (keyStats.revenue >= 1e9 ? (keyStats.revenue / 1e9).toFixed(2) + ' mrd' : (keyStats.revenue / 1e6).toFixed(0) + ' mill') + ' ' + (keyStats?.currency || currency) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">EBITDA</span>
                                    <span className="font-bold">{keyStats?.ebitda ? (keyStats.ebitda >= 1e9 ? (keyStats.ebitda / 1e9).toFixed(2) + ' mrd' : (keyStats.ebitda / 1e6).toFixed(0) + ' mill') + ' ' + (keyStats?.currency || currency) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">EPS</span>
                                    <span className="font-bold">{keyStats?.eps ? keyStats.eps.toFixed(2) + ' ' + (keyStats?.currency || currency) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Utbytte per aksje</span>
                                    <span className="font-bold">{keyStats?.dividendPerShare ? keyStats.dividendPerShare.toFixed(2) + ' ' + (keyStats?.currency || currency) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">Direkteavk.</span>
                                    <span className="font-bold">{keyStats?.dividendYield ? (keyStats.dividendYield * 100).toFixed(2) + ' %' : '0,00 %'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">P/E</span>
                                    <span className="font-bold">{keyStats?.pe ? keyStats.pe.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">P/B</span>
                                    <span className="font-bold">{keyStats?.pb ? keyStats.pb.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">PEG</span>
                                    <span className="font-bold">{keyStats?.peg ? keyStats.peg.toFixed(2) : '-'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">P/S</span>
                                    <span className="font-bold">{keyStats?.ps ? keyStats.ps.toFixed(2) : 'N/A'}</span>
                                </div>
                                <div className="bg-secondary/30 p-4 rounded-xl border border-border col-span-2">
                                    <span className="text-xs text-muted-foreground font-medium block mb-1">52-ukers Range</span>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-destructive">{keyStats?.fiftyTwoWeekLow?.toFixed(2) || '?'}</span>
                                        <div className="flex-1 h-1.5 bg-secondary rounded-full relative">
                                            {keyStats?.fiftyTwoWeekLow && keyStats?.fiftyTwoWeekHigh && currentPrice && (
                                                <div
                                                    className="absolute top-0 h-1.5 bg-primary rounded-full"
                                                    style={{
                                                        left: '0%',
                                                        width: `${Math.min(100, Math.max(0, ((currentPrice - keyStats.fiftyTwoWeekLow) / (keyStats.fiftyTwoWeekHigh - keyStats.fiftyTwoWeekLow)) * 100))}%`
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <span className="font-bold text-success">{keyStats?.fiftyTwoWeekHigh?.toFixed(2) || '?'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'notater' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg mb-2">Hvorfor kjøpte jeg?</h3>
                        <p className="text-muted-foreground text-sm mb-4">Gjennomgang av din opprinnelige sjekkliste og hypotese for kjøpet.</p>
                        <textarea
                            className="w-full bg-secondary/30 border border-border rounded-2xl p-4 min-h-[150px] outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Noter ned din overbevisning for investeringen her for å unngå FOMO-salg senere..."
                            defaultValue="Kjøpt for utbytte og sterk balanse. Skal sitte på disse i minst 3 år uavhengig av svingninger i kvartalstall."
                        />
                        <button className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl mt-2 hover:bg-primary/90 transition-colors">Lagre Notat</button>
                    </div>
                )}

                {(activeTab === 'analytikere' || activeTab === 'nyheter') && (
                    <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm">
                        Kommer snart
                    </div>
                )}
            </div>

        </motion.div>
    );
}
