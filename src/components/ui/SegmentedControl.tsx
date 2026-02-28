import { motion } from 'framer-motion';

interface SegmentedControlProps {
    options: string[];
    selectedOption: string;
    onChange: (option: string) => void;
}

export function SegmentedControl({ options, selectedOption, onChange }: SegmentedControlProps) {
    return (
        <div className="flex p-1 bg-secondary rounded-2xl w-full sm:w-80 relative">
            {options.map((option) => (
                <button
                    key={option}
                    onClick={() => onChange(option)}
                    className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${selectedOption === option ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    {option}
                    {selectedOption === option && (
                        <motion.div
                            layoutId="segmented-control-bg"
                            className="absolute inset-0 bg-card rounded-xl border border-border shadow-sm"
                            style={{ zIndex: -1 }}
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
}
