import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SpouseInclusionContextType {
  includeSpouse: boolean;
  setIncludeSpouse: (value: boolean) => void;
}

const SpouseInclusionContext = createContext<SpouseInclusionContextType | undefined>(undefined);

export const SpouseInclusionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [includeSpouse, setIncludeSpouse] = useState(false);

  return (
    <SpouseInclusionContext.Provider value={{ includeSpouse, setIncludeSpouse }}>
      {children}
    </SpouseInclusionContext.Provider>
  );
};

export const useSpouseInclusion = () => {
  const context = useContext(SpouseInclusionContext);
  if (context === undefined) {
    throw new Error('useSpouseInclusion must be used within a SpouseInclusionProvider');
  }
  return context;
};

