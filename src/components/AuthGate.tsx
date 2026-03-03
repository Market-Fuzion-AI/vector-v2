import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthPage } from '../pages/AuthPage';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2F5BFF]"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return <>{children}</>;
};
