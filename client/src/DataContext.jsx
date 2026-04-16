import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Faculty, Courses, Allocations data
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [sectionsConfig, setSectionsConfig] = useState(null);

  const value = {
    faculty,
    setFaculty,
    courses,
    setCourses,
    allocations,
    setAllocations,
    sectionsConfig,
    setSectionsConfig,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useSharedData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useSharedData must be used within a DataProvider');
  }
  return context;
};

