import { Category } from '../types';

export interface CategoryGroup {
  category: Category;
  children: Category[];
}

// Main categories (A-Z), each with its sub-categories (A-Z). A sub-category whose parent
// is missing is shown as a main category so it never disappears from the admin.
export const groupCategories = (categories: Category[]): CategoryGroup[] => {
  const byId = new Map(categories.map((c) => [c._id, c]));
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
  const isChild = (c: Category) => !!c.parentCategory && byId.has(c.parentCategory) && c.parentCategory !== c._id;
  return categories
    .filter((c) => !isChild(c))
    .sort(byName)
    .map((category) => ({
      category,
      children: categories.filter((c) => isChild(c) && c.parentCategory === category._id).sort(byName),
    }));
};

// "Backpacks › Travel Bags" for a sub-category, just the name for a main one.
export const categoryLabel = (id: string | undefined, categories: Category[]): string => {
  const cat = categories.find((c) => c._id === id);
  if (!cat) return '';
  const parent = cat.parentCategory ? categories.find((c) => c._id === cat.parentCategory) : undefined;
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
};
