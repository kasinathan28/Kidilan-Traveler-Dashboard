import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Product, SortConfig, Category } from '../types';
import { EditIcon, DeleteIcon, ProductsIcon, MoreOptionIcon } from './icons';
import { getProducts, addProduct, updateProduct, deleteProduct, getCategories, setProductHero } from '../api/mockApi';
import { AppContext } from '../contexts/AppContext';
import ConfirmationModal from './ConfirmationModal';
import ProductModal from './ProductModal';
import OfferModal from './OfferModal';
import Pagination from './Pagination';
import SortableTableHeader from './SortableTableHeader';
import { categoryLabel } from '../utils/categories';
import LoadingSpinner from './LoadingSpinner';
import { useDebounce } from '../hooks/useDebounce';
import { usePageSize } from '../hooks/usePageSize';
import ProductRow from './ProductRow';


const ProductTable: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('products');
  const [sortConfig, setSortConfig] = useState<SortConfig<Product>>({ key: '_id', direction: 'descending' });
  const [activeTab, setActiveTab] = useState<'all' | 'offers'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [productForOffer, setProductForOffer] = useState<Product | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { showToast } = useContext(AppContext);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Search, sort, tab and rows per page are applied on the server; any change sends the user back to page 1.
  const filterKey = `${debouncedSearchQuery}|${String(sortConfig.key)}|${sortConfig.direction}|${activeTab}|${pageSize}`;
  const lastFilterKey = useRef(filterKey);
  // Only the newest request may update state (page clicks can overlap).
  const requestId = useRef(0);

  const fetchAndSetProducts = useCallback(async () => {
    let page = currentPage;
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      if (currentPage !== 1) {
        setCurrentPage(1); // re-runs this effect with page 1
        return;
      }
      page = 1;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        getProducts({
          page,
          limit: pageSize,
          search: debouncedSearchQuery.trim() || undefined,
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction,
          discounted: activeTab === 'offers',
        }),
        getCategories() // Fetch all categories to map names
      ]);
      if (id !== requestId.current) return;

      setCategories(categoriesData);

      const productsWithCategoryNames = productsData.products.map(p => {
        const catId = p.categoryId || p.category;
        return {
          ...p,
          categoryId: catId,
          category: categoryLabel(catId, categoriesData) || 'Uncategorized'
        };
      });

      setProducts(productsWithCategoryNames);
      setTotalProducts(productsData.totalCount);
      // e.g. last item on the last page was deleted: step back to a page that exists
      const lastPage = Math.max(Math.ceil(productsData.totalCount / pageSize), 1);
      if (page > lastPage) setCurrentPage(lastPage);
    } catch (err) {
      if (id !== requestId.current) return;
      setError("Failed to fetch products. Please try again later.");
      showToast("Failed to fetch products");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [currentPage, filterKey, debouncedSearchQuery, sortConfig, showToast, activeTab]);

  useEffect(() => {
    fetchAndSetProducts();
  }, [fetchAndSetProducts]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't automatically open modal on refresh/login - only when explicitly requested
  // Previously this would open the modal if there was saved form data, which was causing the issue
  // useEffect(() => {
  //   const saved = localStorage.getItem('productModalFormData');
  //   if (saved) {
  //     setEditingProduct(null);
  //     setIsModalOpen(true);
  //     showToast('Restored unsaved product draft.');
  //   }
  // }, [showToast]);

  const handleAddClick = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct(productToDelete._id);
      showToast("Product deleted successfully.");
      if (products.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchAndSetProducts();
      }
    } catch (error) {
      showToast("Failed to delete product. Please try again.");
    } finally {
      setProductToDelete(null);
    }
  };

  const handleSave = async (productData: Omit<Product, '_id'> | Product) => {
    try {
      if ('_id' in productData && productData._id) {
        await updateProduct(productData._id, productData as Product);
        showToast("Product updated successfully.");
      } else {
        const result = await addProduct(productData);
        console.log(result);
        showToast("Product added successfully.");
      }
      handleCloseModal();
      fetchAndSetProducts();
    } catch (error: any) {
      // Check if it's a 413 error (Request Entity Too Large)
      if (error?.status === 413) {
        showToast(error?.message || "Upload failed: Files are too large.");
      } else {
        showToast(error?.message || "Failed to save product.");
      }
      throw error;
    }
  };

  const handleOfferClick = (product: Product) => {
    setProductForOffer(product);
    setIsOfferModalOpen(true);
  };

  const handleSaveOffer = async (id: string, discount: number) => {
    try {
      const productToUpdate = products.find(p => p._id === id);
      if (productToUpdate) {
        await updateProduct(id, { ...productToUpdate, discount });
        showToast(discount > 0 ? "Offer updated successfully." : "Offer removed successfully.");
        fetchAndSetProducts();
      }
    } catch (error) {
      showToast("Failed to update offer.");
    }
  };

  // Tick = show in the storefront home hero carousel. Optimistic; put back if the save fails.
  const [heroBusyId, setHeroBusyId] = useState<string | null>(null);
  const handleToggleHero = async (product: Product) => {
    const next = !product.showInHero;
    setHeroBusyId(product._id);
    setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, showInHero: next } : p)));
    try {
      await setProductHero(product._id, next);
      showToast(next ? `"${product.name}" will show in the home hero.` : `"${product.name}" removed from the home hero.`);
    } catch (error: any) {
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, showInHero: !next } : p)));
      showToast(error?.message || 'Could not update the home hero.');
    } finally {
      setHeroBusyId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  }

  const handleSort = (key: keyof Product) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };


  const renderTableContent = () => {
    if (isLoading) {
      return <tr><td colSpan={7} className="text-center py-16"><LoadingSpinner /></td></tr>;
    }
    if (error) {
      return <tr><td colSpan={7} className="text-center py-16 text-red-500">{error}</td></tr>;
    }
    if (products.length === 0) {
      return <tr><td colSpan={7} className="text-center py-16 text-gray-500">No products found.</td></tr>;
    }

    return products.map((product) => (
      <ProductRow
        key={product._id}
        product={product}
        categories={categories}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        handleEditClick={handleEditClick}
        handleOfferClick={handleOfferClick}
        setProductToDelete={setProductToDelete}
        onToggleHero={handleToggleHero}
        heroBusy={heroBusyId === product._id}
      />
    ));
  };


  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center space-x-6">
          <h3 className="text-xl font-bold text-gray-800">Product Sales</h3>
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'all' ? 'bg-white text-[#2D7A79] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('offers')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'offers' ? 'bg-white text-[#2D7A79] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Offers
            </button>
          </div>
        </div>
        <button onClick={handleAddClick} className="px-5 py-2 bg-[#2D7A79] text-white rounded-lg font-semibold hover:bg-opacity-90 shadow-sm transition-all">
          Add Product
        </button>
      </div>
      <div className="overflow-visible">
        <table className="w-full text-sm text-left text-gray-500 border-collapse">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-y border-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3">Image</th>
              <SortableTableHeader<Product> label="Product Name" sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHeader<Product> label="Category" sortKey="category" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHeader<Product> label="Price" sortKey="price" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHeader<Product> label="Stock" sortKey="stock" sortConfig={sortConfig} onSort={handleSort} />
              <th scope="col" className="px-6 py-3 text-center" title="Show in the home page hero carousel">Home hero</th>
              <th scope="col" className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderTableContent()}
          </tbody>
        </table>
      </div>

      {!isLoading && !error && products.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalCount={totalProducts}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onPageChange={page => setCurrentPage(page)}
        />
      )}

      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        product={editingProduct}
        categories={categories}
      />
      <OfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        onSave={handleSaveOffer}
        product={productForOffer}
      />
      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
        variant="destructive"
      />
    </div>
  );
};

export default ProductTable;