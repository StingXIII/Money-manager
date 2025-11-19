
import React, { useState, useRef, useEffect } from 'react';
import { useDateFilter } from '../../contexts/DateFilterContext';
import { useLanguage } from '../../contexts/LanguageContext';

const MonthSelector: React.FC = () => {
    const { selectedDate, prevMonth, nextMonth, setSelectedDate } = useDateFilter();
    const { language } = useLanguage();
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const togglePicker = () => setShowPicker(!showPicker);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (year: number, month: number) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(year);
        newDate.setMonth(month);
        setSelectedDate(newDate);
        setShowPicker(false);
    };

    // Generate last 10 years for dropdown
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - i);
    
    const getMonthName = (index: number, short: boolean = false) => {
         const date = new Date(2000, index, 1);
         const locale = language === 'vi' ? 'vi-VN' : 'en-US';
         return date.toLocaleDateString(locale, { month: short ? 'short' : 'long' });
    }

    const months = Array.from({ length: 12 }, (_, i) => getMonthName(i, true));

    return (
        <div className="relative inline-block text-left" ref={pickerRef}>
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow p-1 border dark:border-gray-700">
                <button 
                    onClick={prevMonth} 
                    className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                
                <button 
                    onClick={togglePicker}
                    className="px-4 py-1 font-semibold text-gray-800 dark:text-white min-w-[160px] text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors capitalize"
                >
                   {selectedDate.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' })}
                </button>

                <button 
                    onClick={nextMonth} 
                    className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {showPicker && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 border dark:border-gray-700 max-h-80 overflow-y-auto">
                    <div className="p-2 grid grid-cols-3 gap-1">
                        {years.map(year => (
                            <div key={year} className="col-span-3 mb-2">
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 mb-1 border-b dark:border-gray-700">{year}</div>
                                <div className="grid grid-cols-3 gap-1">
                                    {months.map((month, index) => (
                                        <button
                                            key={`${year}-${index}`}
                                            onClick={() => handleSelect(year, index)}
                                            className={`text-sm py-1.5 px-2 rounded capitalize ${
                                                selectedDate.getMonth() === index && selectedDate.getFullYear() === year
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {month}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthSelector;
