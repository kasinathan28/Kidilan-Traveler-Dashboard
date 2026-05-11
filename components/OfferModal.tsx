import React, { useState, useEffect, useRef, useContext } from 'react';
import { Product } from '../types';
import { XIcon } from './icons';
import { AppContext } from '../contexts/AppContext';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, discount: number) => Promise<void>;
  product: Product | null;
}

const OfferModal: React.FC<OfferModalProps> = ({ isOpen, onClose, onSave, product }) => {
  const { showToast } = useContext(AppContext);
  const [discount, setDiscount] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && product) {
      setDiscount(String(product.discount || 0));
      setError(null);
      setShowWarning(false);
      setIsSubmitting(false);
    }
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, input'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    firstElement?.focus();
    modalRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      modalRef.current?.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const discountNum = Number(discount);

    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      setError('Please enter a valid discount percentage (0-100).');
      return;
    }

    if (discountNum >= 80 && !showWarning) {
      setShowWarning(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(product._id, discountNum);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save offer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!product) return;
    setIsSubmitting(true);
    try {
      await onSave(product._id, 0);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove offer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges = product && Number(discount) !== (product.discount || 0);
  const isSaveDisabled = isSubmitting || !hasChanges;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" role="dialog" aria-modal="true">
      <div ref={modalRef} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" aria-label="Close modal">
          <XIcon className="w-6 h-6" />
        </button>
        
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Manage Offer</h2>
        <p className="text-gray-600 mb-6">Set a discount percentage for <strong>{product.name}</strong>.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">
              Discount Percentage (%)
            </label>
            <div className="relative">
              <input
                id="discount"
                type="number"
                value={discount}
                onChange={(e) => {
                  setDiscount(e.target.value);
                  setError(null);
                  setShowWarning(false);
                }}
                placeholder="0"
                min="0"
                max="100"
                className={`w-full p-3 pr-10 border rounded-lg focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#2D7A79]'}`}
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">%</span>
              </div>
            </div>
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Original Price:</span>
              <span className="font-medium">₹{product.price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Discount Amount:</span>
              <span className="text-red-600 font-medium">- ₹{(product.price * (Number(discount) / 100)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 mt-2 pt-2">
              <span className="text-gray-800">Offer Price:</span>
              <span className="text-[#2D7A79]">₹{(product.price * (1 - Number(discount) / 100)).toFixed(2)}</span>
            </div>
          </div>

          {showWarning && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center font-bold mb-1">
                <span className="mr-2">⚠️</span>
                High Discount Warning
              </div>
              You are applying a discount of <strong>{discount}%</strong>. This will significantly reduce the product price. Are you sure you want to proceed?
            </div>
          )}

          <div className="flex justify-between items-center">
            {product.discount > 0 && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="text-red-600 hover:text-red-700 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                Remove Offer
              </button>
            )}
            <div className="flex space-x-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaveDisabled}
                className={`px-5 py-2 rounded-lg text-white font-semibold shadow-md transition-all flex items-center text-sm ${
                  showWarning ? 'bg-red-600 hover:bg-red-700' : 'bg-[#2D7A79] hover:bg-opacity-90'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                {isSubmitting ? 'Saving...' : showWarning ? 'Confirm & Apply' : 'Apply Offer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OfferModal;
