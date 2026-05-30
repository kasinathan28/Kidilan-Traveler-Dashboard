import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { getOfferCountdown, updateOfferCountdown, changePassword } from '../api/mockApi';
import LoadingSpinner from '../components/LoadingSpinner';

const SettingsPage: React.FC = () => {
  const { showToast } = useContext(AppContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isActive, setIsActive] = useState(false);
  const [endTime, setEndTime] = useState('');
  const [label, setLabel] = useState('Hurry up! Offer ends in:');
  
  // States for live preview countdown
  const [previewText, setPreviewText] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await getOfferCountdown();
        setIsActive(data.isActive);
        setLabel(data.label || 'Hurry up! Offer ends in:');
        // Format ISO string to datetime-local field format: YYYY-MM-DDThh:mm
        if (data.endTime) {
          const date = new Date(data.endTime);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          setEndTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
      } catch (err) {
        showToast('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [showToast]);

  // Real-time preview calculation
  useEffect(() => {
    if (!isActive || !endTime) {
      setPreviewText('Countdown not active or time not selected.');
      return;
    }

    const calculateTime = () => {
      const target = new Date(endTime).getTime();
      const diff = target - Date.now();
      
      if (diff <= 0) {
        setPreviewText('Expired (Label will not show on storefront)');
        return;
      }
      
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      setPreviewText(`${days}d ${hours}h ${minutes}m ${seconds}s remaining`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [isActive, endTime]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endTime) {
      showToast('Please select a valid expiration date & time.');
      return;
    }

    try {
      setSaving(true);
      const isoString = new Date(endTime).toISOString();
      await updateOfferCountdown({
        endTime: isoString,
        isActive,
        label: label.trim() || 'Hurry up! Offer ends in:'
      });
      showToast('Settings saved successfully!');
    } catch (err) {
      showToast('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Storefront Promotion Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure general and promotional components displayed on the public e-commerce storefront.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Active Banner Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <label htmlFor="isActiveToggle" className="font-semibold text-gray-800 block cursor-pointer">
                Enable Promo Countdown Timer
              </label>
              <span className="text-xs text-gray-500">
                When enabled, a live countdown timer is shown above Top Deals on the homepage.
              </span>
            </div>
            <button
              id="isActiveToggle"
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2D7A79] focus:ring-offset-2 ${
                isActive ? 'bg-[#2D7A79]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Custom Label Input */}
          <div className={`space-y-2 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label htmlFor="labelInput" className="block text-sm font-medium text-gray-700">
              Countdown Text / Label
            </label>
            <input
              id="labelInput"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Hurry up! Offer ends in:"
              className="w-full max-w-md p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:border-transparent outline-none transition-all"
              required={isActive}
            />
          </div>

          {/* End Time Picker */}
          <div className={`space-y-2 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label htmlFor="endTimeInput" className="block text-sm font-medium text-gray-700">
              Offer Expiry Date & Time
            </label>
            <input
              id="endTimeInput"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full max-w-md p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:border-transparent outline-none transition-all"
              required={isActive}
            />
          </div>

          {/* Real-time Preview Area */}
          <div className="p-5 bg-gradient-to-r from-teal-50 to-[#A4F44A]/10 rounded-xl border border-teal-100/50">
            <h4 className="text-sm font-bold text-[#2D7A79] uppercase tracking-wide mb-2">Live Storefront Preview</h4>
            <div className="p-4 bg-white rounded-lg border border-teal-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Banner Headline</span>
                <p className="font-bold text-gray-800 text-lg">Top Deals Of The Day</p>
              </div>
              <div className="py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="text-xs font-bold text-gray-400 block mb-0.5">Countdown Text</span>
                <p className={`font-mono text-sm ${isActive ? 'text-teal-700 font-bold' : 'text-gray-400'}`}>
                  {isActive ? `${label} ${previewText}` : '(Countdown hidden)'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#2D7A79] text-white font-bold rounded-lg hover:bg-opacity-90 transition-all flex items-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <PasswordSection showToast={showToast} />
    </div>
  );
};

const PasswordSection: React.FC<{ showToast: (msg: string) => void }> = ({ showToast }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters long.');
      return;
    }

    try {
      setSaving(true);
      await changePassword(oldPassword, newPassword);
      showToast('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <h3 className="text-xl font-bold text-gray-800 mb-2">Change Administrator Password</h3>
      <p className="text-sm text-gray-600 mb-6">
        Update your administrative password regularly to maintain dashboard security.
      </p>

      <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <label htmlFor="oldPasswordInput" className="block text-sm font-medium text-gray-700">
            Current Password
          </label>
          <input
            id="oldPasswordInput"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:border-transparent outline-none transition-all"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="newPasswordInput" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <input
            id="newPasswordInput"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:border-transparent outline-none transition-all"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPasswordInput" className="block text-sm font-medium text-gray-700">
            Confirm New Password
          </label>
          <input
            id="confirmPasswordInput"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:border-transparent outline-none transition-all"
            required
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#2D7A79] text-white font-bold rounded-lg hover:bg-opacity-90 transition-all flex items-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {saving ? 'Updating Password...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
