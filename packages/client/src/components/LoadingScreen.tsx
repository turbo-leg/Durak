import React from 'react';
import '../App.css'; // Just re-using the exist App.css or creating new component styles

export const LoadingScreen: React.FC<{ message?: string, isError?: boolean }> = ({ message = 'Connecting to Server...', isError = false }) => {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white`}>
      <div className="flex flex-col items-center gap-6">
        {!isError && (
          <div className="w-16 h-16 border-4 border-t-purple-500 border-gray-700 rounded-full animate-spin"></div>
        )}
        <h2 className={`text-2xl font-bold ${isError ? 'text-red-500' : 'text-gray-200'}`}>
          {message}
        </h2>
        {isError && (
          <button 
            className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold transition"
            onClick={() => window.location.reload()}
          >
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
};
