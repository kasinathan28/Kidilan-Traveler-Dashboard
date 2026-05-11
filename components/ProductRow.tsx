import React, { useState, useRef, useLayoutEffect } from 'react';
import { Product } from '../types';
import { EditIcon, DeleteIcon, ProductsIcon, MoreOptionIcon } from './icons';

interface ProductRowProps {
  product: Product;
  categories: any[];
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  handleEditClick: (product: Product) => void;
  handleOfferClick: (product: Product) => void;
  setProductToDelete: (product: Product) => void;
}

const ProductRow: React.FC<ProductRowProps> = ({
  product,
  openMenuId,
  setOpenMenuId,
  handleEditClick,
  handleOfferClick,
  setProductToDelete
}) => {
  const [openUpwards, setOpenUpwards] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (openMenuId === product._id && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 200px below, open upwards
      setOpenUpwards(spaceBelow < 200);
    }
  }, [openMenuId, product._id]);

  return (
    <tr key={product._id} className="bg-white border-b hover:bg-gray-50">
      <td data-label="Image" className="px-6 py-4">
        {product.imageUrls && product.imageUrls.length > 0 ? (
          <img src={product.imageUrls[0]} alt={product.name} className="w-12 h-12 object-cover rounded-md" />
        ) : (
          <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
            <ProductsIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </td>
      <td data-label="Product Name" className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
      <td data-label="Category" className="px-6 py-4">{product.category}</td>
      <td data-label="Price" className="px-6 py-4">
        {(product as any).discount > 0 ? (
          <div className="flex flex-col">
            <span className="text-[#2D7A79] font-bold">₹{(product.price * (1 - (product as any).discount / 100)).toFixed(2)}</span>
            <span className="text-xs text-gray-400 line-through">₹{product.price.toFixed(2)}</span>
          </div>
        ) : (
          <span>₹{product.price.toFixed(2)}</span>
        )}
      </td>
      <td data-label="Stock" className="px-6 py-4">{product.stock}</td>
      <td data-label="Actions" className="px-6 py-4 text-right relative">
        <div className="flex justify-end">
          <button
            ref={menuButtonRef}
            onClick={() => setOpenMenuId(openMenuId === product._id ? null : product._id)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={`Actions for ${product.name}`}
          >
            <MoreOptionIcon className="w-5 h-5" />
          </button>
        </div>

        {openMenuId === product._id && (
          <div
            ref={menuRef}
            className={`absolute right-6 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in zoom-in duration-100 ${
              openUpwards ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top'
            }`}
          >
            <button
              onClick={() => {
                handleEditClick(product);
                setOpenMenuId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-colors"
            >
              <EditIcon className="w-4 h-4 mr-3" />
              Edit
            </button>
            <button
              onClick={() => {
                handleOfferClick(product);
                setOpenMenuId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center transition-colors"
            >
              <span className="w-4 h-4 mr-3 flex items-center justify-center font-bold text-lg">%</span>
              {(product as any).discount > 0 ? 'Edit Offer' : 'Add Offer'}
            </button>
            <div className="border-t border-gray-100"></div>
            <button
              onClick={() => {
                setProductToDelete(product);
                setOpenMenuId(null);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
            >
              <DeleteIcon className="w-4 h-4 mr-3" />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

export default ProductRow;
