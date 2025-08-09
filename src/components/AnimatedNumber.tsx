// /components/AnimatedNumber.tsx
'use client';

import CountUp from 'react-countup';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  prefix = '', 
  suffix = '', 
  decimals = 0,
  className 
}) => {
  return (
    <CountUp
      end={value || 0}
      duration={1.5} // Animation duration in seconds
      separator=","
      decimals={decimals}
      decimal="."
      prefix={prefix}
      suffix={suffix}
      className={className}
    />
  );
};

export default AnimatedNumber;