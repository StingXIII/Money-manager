
import React, { createContext, useState, useContext, ReactElement } from 'react';

interface DateFilterContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  prevMonth: () => void;
  nextMonth: () => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export const DateFilterProvider = ({ children }: React.PropsWithChildren<{}>): ReactElement => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const prevMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const nextMonth = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  return (
    <DateFilterContext.Provider value={{ selectedDate, setSelectedDate, prevMonth, nextMonth }}>
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (context === undefined) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};
