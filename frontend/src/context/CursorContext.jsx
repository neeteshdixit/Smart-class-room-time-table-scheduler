import React, { createContext, useContext, useState } from 'react';

const CursorContext = createContext();

export const useCursor = () => {
  return useContext(CursorContext);
};

export const CursorProvider = ({ children }) => {
  const [cursorType, setCursorType] = useState('default'); // 'default', 'pointer', 'text', etc.
  const [cursorColor, setCursorColor] = useState('var(--text-main)');

  const value = {
    cursorType,
    setCursorType,
    cursorColor,
    setCursorColor,
  };

  return (
    <CursorContext.Provider value={value}>
      {children}
    </CursorContext.Provider>
  );
};
