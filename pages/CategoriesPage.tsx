import React, { useContext } from 'react';
import CategoryTable from '../components/CategoryTable';
import { AppContext } from '../contexts/AppContext';

const CategoriesPage: React.FC = () => {
    const { searchQuery } = useContext(AppContext);
    return (
        <div>
            <CategoryTable searchQuery={searchQuery} />
        </div>
    );
}

export default CategoriesPage;
