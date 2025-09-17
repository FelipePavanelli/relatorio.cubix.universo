
import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  className?: string;
  innerRadius?: number;
  outerRadius?: number;
  animationDuration?: number;
  height?: number;
  legendPosition?: 'bottom' | 'side';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded-md text-sm shadow-md">
        <p className="font-medium">{payload[0].name}</p>
        <p className="text-muted-foreground">
          {payload[0].value}% ({payload[0].payload.rawValue})
        </p>
      </div>
    );
  }
  return null;
};

const DonutChart: React.FC<DonutChartProps> = ({
  data,
  className,
  innerRadius = 50,
  outerRadius = 70,
  animationDuration = 1000,
  height = 200,
  legendPosition = 'bottom'
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  return (
    <div className={cn('w-full', className)} style={{ height: 'auto' }}>
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              dataKey="value"
              animationDuration={animationDuration}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  strokeWidth={1.25}
                  stroke="rgba(255,255,255,0.9)"
                  style={{ 
                    filter: activeIndex === index ? 'drop-shadow(0 0 3px rgba(0,0,0,0.25))' : 'none',
                    opacity: activeIndex !== null && activeIndex !== index ? 0.65 : 1,
                    transition: 'opacity 0.25s, filter 0.25s'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className={cn(
        "flex flex-wrap gap-2 justify-center mt-2",
        legendPosition === 'side' ? 'flex-col items-start' : ''
      )}>
        {data.map((entry, index) => (
          <div 
            key={`legend-${index}`} 
            className="flex items-center gap-1 text-xs"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: entry.color, border: '1px solid rgba(0,0,0,0.25)' }}
            />
            <span>{entry.name} - {entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
