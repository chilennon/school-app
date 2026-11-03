"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">📡</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">You are offline</h1>
      <p className="text-slate-500 max-w-sm">
        The app couldn't load this page because there is no internet connection. 
        Please check your network and try again.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-6 px-6 py-2 bg-blue-600 text-white font-bold rounded-xl active:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}