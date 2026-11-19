import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Category } from '../types';
import { getCategories, addCategory, updateCategory, deleteCategory, setCategoryHero } from '../api/mockApi';
import LoadingSpinner from './LoadingSpinner';
import { EditIcon, DeleteIcon, Squares2X2Icon } from './icons';
import { AppContext } from '../contexts/AppContext';
import ConfirmationModal from './ConfirmationModal';
import CategoryModal from './CategoryModal';
import { groupCategories } from '../utils/categories';

const CategoryTable: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [newParentId, setNewParentId] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    const { showToast } = useContext(AppContext);

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getCategories();
            setCategories(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch categories.");
            showToast("Failed to fetch categories");
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const handleAddClick = (parentId: string | null = null) => {
        setEditingCategory(null);
        setNewParentId(parentId);
        setIsModalOpen(true);
    };

    const handleEditClick = (category: Category) => {
        setEditingCategory(category);
        setNewParentId(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (category: Category) => {
        setCategoryToDelete(category);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setNewParentId(null);
    };

    const handleSave = async (categoryData: Omit<Category, '_id'> | Category) => {
        try {
            const kind = categoryData.parentCategory ? 'Sub-category' : 'Category';
            if ('_id' in categoryData && categoryData._id) {
                await updateCategory(categoryData._id, categoryData);
                showToast(`${kind} updated successfully.`);
            } else {
                await addCategory(categoryData as Omit<Category, '_id'>);
                showToast(`${kind} added successfully.`);
            }
            handleCloseModal();
            fetchCategories();
        } catch (error: any) {
            showToast(error.message || "Failed to save category.");
            throw error;
        }
    };

    // Tick = a card for this category in the storefront home hero. Optimistic; put back on failure.
    const [heroBusyId, setHeroBusyId] = useState<string | null>(null);
    const heroCount = categories.filter((c) => c.showInHero).length;
    const handleToggleHero = async (category: Category) => {
        const next = !category.showInHero;
        setHeroBusyId(category._id);
        setCategories((prev) => prev.map((c) => (c._id === category._id ? { ...c, showInHero: next } : c)));
        try {
            await setCategoryHero(category._id, next);
            showToast(next ? `"${category.name}" will show in the home hero.` : `"${category.name}" removed from the home hero.`);
        } catch (error: any) {
            setCategories((prev) => prev.map((c) => (c._id === category._id ? { ...c, showInHero: !next } : c)));
            showToast(error?.message || 'Could not update the home hero.');
        } finally {
            setHeroBusyId(null);
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;

        try {
            await deleteCategory(categoryToDelete._id);
            showToast("Category deleted successfully.");
            fetchCategories();
        } catch (error: any) {
            showToast(error.message || "Failed to delete category.");
        } finally {
            setCategoryToDelete(null);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center h-64"><LoadingSpinner /></div>;
        }

        if (error) {
            return <div className="text-center py-16 text-red-500">{error}</div>;
        }

        if (categories.length === 0) {
            return <div className="text-center py-16 text-gray-500">No categories found. Start by adding one!</div>;
        }

        const q = searchQuery.toLowerCase();
        const matches = (c: Category) =>
            c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
        // A main category shows when it or any of its sub-categories match. A match on the
        // main category keeps all its sub-categories; otherwise only the matching ones show.
        const groups = groupCategories(categories)
            .map(({ category, children }) => ({
                category,
                allChildren: children,
                children: !q || matches(category) ? children : children.filter(matches),
            }))
            .filter(({ category, children }) => !q || matches(category) || children.length > 0);

        if (groups.length === 0) {
            return <div className="text-center py-16 text-gray-500">No categories found matching "{searchQuery}".</div>;
        }

        const plural = (n: number) => `${n} Product${n !== 1 ? 's' : ''}`;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(({ category, children, allChildren }) => {
                    const total = (category.productCount || 0) + allChildren.reduce((n, c) => n + (c.productCount || 0), 0);
                    return (
                    <div key={category._id} className="bg-white rounded-xl shadow-md overflow-hidden group flex flex-col">
                        {category.imageUrl
                            ? <img src={category.imageUrl} alt={category.name} className="w-full h-40 object-cover"/>
                            : <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No image</div>}
                        <div className="p-5 flex-grow flex flex-col">
                            <h4 className="text-lg font-bold text-gray-800">{category.name}</h4>
                             {typeof category.productCount !== 'undefined' && (
                                <p className="text-sm font-medium text-gray-500 mt-1">
                                    {plural(total)}
                                    {allChildren.length > 0 && ` · ${allChildren.length} sub-categor${allChildren.length !== 1 ? 'ies' : 'y'}`}
                                </p>
                             )}
                            <p className="text-sm text-gray-600 mt-2 flex-grow">{category.description}</p>

                            <div className="mt-4 border-t border-gray-100 pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sub-categories</p>
                                {children.length > 0 && (
                                    <ul className="mt-2 divide-y divide-gray-100">
                                        {children.map((sub) => (
                                            <li key={sub._id} className="flex items-center justify-between gap-2 py-1.5">
                                                <div className="min-w-0">
                                                    <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                                                    <span className="ml-2 text-xs text-gray-500">{plural(sub.productCount || 0)}</span>
                                                </div>
                                                <div className="flex shrink-0">
                                                    <button onClick={() => handleEditClick(sub)} className="p-1.5 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${sub.name}`}>
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(sub)} className="p-1.5 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${sub.name}`}>
                                                        <DeleteIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <button
                                    onClick={() => handleAddClick(category._id)}
                                    className="mt-2 text-sm font-semibold text-[#2D7A79] hover:underline"
                                >
                                    + Add sub-category
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none" title="Show this category as a card in the home page hero">
                                    <input
                                        type="checkbox"
                                        checked={!!category.showInHero}
                                        disabled={heroBusyId === category._id}
                                        onChange={() => handleToggleHero(category)}
                                        aria-label={`Show ${category.name} in the home page hero`}
                                        className="h-4 w-4 accent-[#2D7A79] cursor-pointer disabled:cursor-wait"
                                    />
                                    Show in home hero
                                </label>
                            <div className="flex space-x-2">
                                <button onClick={() => handleEditClick(category)} className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-100 transition-colors" aria-label={`Edit ${category.name}`}>
                                    <EditIcon className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDeleteClick(category)} className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors" aria-label={`Delete ${category.name}`}>
                                    <DeleteIcon className="w-5 h-5" />
                                </button>
                            </div>
                            </div>
                        </div>
                    </div>
                    );
                })}
            </div>
        );
    };

    return (
        <>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-start gap-4 mb-6">
                    <div className="min-w-0">
                        <h3 className="text-xl font-bold text-gray-800">Manage Categories</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Home hero cards: {heroCount} ticked. Ticked ones show first (up to 4); the largest categories fill the rest.
                        </p>
                    </div>
                    <button onClick={() => handleAddClick()} className="shrink-0 whitespace-nowrap px-5 py-2 bg-[#2D7A79] text-white rounded-lg font-semibold hover:bg-opacity-90 shadow-sm transition-all flex items-center gap-2">
                        <Squares2X2Icon className="w-5 h-5" />
                        Add Category
                    </button>
                </div>
                {renderContent()}
            </div>

            <CategoryModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                category={editingCategory}
                categories={categories}
                defaultParentId={newParentId}
            />

            <ConfirmationModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={handleDelete}
                title={categoryToDelete?.parentCategory ? "Delete Sub-category" : "Delete Category"}
                message={`Are you sure you want to delete "${categoryToDelete?.name}"? This action may affect associated products and cannot be undone.`}
                variant="destructive"
            />
        </>
    );
};

export default CategoryTable;