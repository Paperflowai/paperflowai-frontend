// src/components/TimeChart.tsx
"use client";

import { useMemo } from 'react';

interface ChartData {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface TimeChartProps {
  data: ChartData[];
  title: string;
  type?: 'pie' | 'bar';
  height?: number;
}

export default function TimeChart({ data, title, type = 'pie', height = 200 }: TimeChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);
  
  if (type === 'pie') {
    return (
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>{title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Simple pie chart using CSS */}
          <div style={{ position: 'relative', width: height, height: height, flexShrink: 0 }}>
            <svg width={height} height={height} viewBox="0 0 100 100">
              {data.map((item, index) => {
                const total = data.reduce((sum, d) => sum + d.value, 0);
                const percentage = total > 0 ? (item.value / total) * 100 : 0;
                const angle = (percentage / 100) * 360;
                const prevAngles = data.slice(0, index).reduce((sum, d) => {
                  const prevPercentage = total > 0 ? (d.value / total) * 100 : 0;
                  return sum + (prevPercentage / 100) * 360;
                }, 0);
                
                const startAngle = prevAngles - 90; // Start from top
                const endAngle = startAngle + angle;
                
                const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M 50 50`,
                  `L ${startX} ${startY}`,
                  `A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                  'Z'
                ].join(' ');
                
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>
          
          {/* Legend */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {data.map((item, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ 
                  width: 12, 
                  height: 12, 
                  backgroundColor: item.color, 
                  borderRadius: 2,
                  flexShrink: 0
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {item.percentage}% • {Math.round(item.value / 60 * 10) / 10}h
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Bar chart
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{title}</h3>
      <div style={{ height: height }}>
        {data.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 120, 
              fontSize: 14, 
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {item.label}
            </div>
            <div style={{ flex: 1, position: 'relative', height: 24, backgroundColor: '#f1f5f9', borderRadius: 4 }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                backgroundColor: item.color,
                borderRadius: 4,
                transition: 'width 0.3s ease'
              }} />
              <div style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                fontWeight: 600,
                color: '#374151'
              }}>
                {Math.round(item.value / 60 * 10) / 10}h
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
