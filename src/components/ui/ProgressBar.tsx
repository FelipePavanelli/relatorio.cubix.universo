
import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  maxValue?: number;
  className?: string;
  showValue?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'danger';
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  maxValue,
  className,
  showValue = false,
  showPercentage = false,
  size = 'md',
  color = 'default',
  label
}) => {
  const maxVal = maxValue || max;
  const percentage = Math.min(Math.round((value / maxVal) * 100), 100);
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  const colorClasses = {
    default: 'bg-accent',
    success: 'bg-[#7EC866]',
    warning: 'bg-[#FFC971]',
    danger: 'bg-[#C8686D]'
  };
  
  return (
    <div className={cn('w-full', className)}>
      {label && <div className="text-sm font-medium mb-1 flex justify-between">
        <span>{label}</span>
        {(showValue || showPercentage) && <span>{percentage}%</span>}
      </div>}
      <div className="w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            'transition-all duration-500 ease-out rounded-full',
            sizeClasses[size],
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
