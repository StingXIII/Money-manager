
import React from 'react';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = "h-8 w-8" }) => {
  return (
    <div className={`animate-spin rounded-full border-t-2 border-b-2 border-blue-500 ${className}`}></div>
  );
};

export default Spinner;
