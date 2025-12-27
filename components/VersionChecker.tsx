import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

const APP_VERSION = '2.0.0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

const VersionChecker: React.FC = () => {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkVersion = async () => {
    try {
      setIsChecking(true);
      
      // Get the current version from localStorage
      const storedVersion = localStorage.getItem('app_version');
      
      // If stored version doesn't match current version, user needs to refresh
      if (storedVersion && storedVersion !== APP_VERSION) {
        setNeedsUpdate(true);
      } else {
        // Store current version
        localStorage.setItem('app_version', APP_VERSION);
      }
    } catch (error) {
      console.error('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRefresh = () => {
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Clear localStorage version
    localStorage.setItem('app_version', APP_VERSION);
    
    // Hard reload
    window.location.reload();
  };

  useEffect(() => {
    // Check on mount
    checkVersion();
    
    // Check periodically
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, []);

  if (!needsUpdate) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Update Available
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              A new version of the app is available with important improvements and bug fixes. 
              Please refresh to get the latest version.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-medium">
            Version {APP_VERSION} includes:
          </p>
          <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
            <li>Improved performance and speed</li>
            <li>Enhanced race condition handling</li>
            <li>Better multi-user support</li>
          </ul>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isChecking}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          Refresh Now
        </button>

        <p className="text-xs text-slate-500 text-center">
          This will reload the page and clear cached data
        </p>
      </div>
    </div>
  );
};

export default VersionChecker;
