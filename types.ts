export interface Address {
  name: string;
  email?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  productName?: string; 
  variantLabel?: string; // the colour / size bought, e.g. "Black / M"
  quantity: number;
  price: number;
}

export interface ProductVariant {
  sku?: string;
  attributes: { color?: string; size?: string };
  stock: number;
  price?: number | null; // null: the product price
  image?: number | null; // the product photo shown for this colour
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';


export interface Order {
  _id: string;
  orderNumber?: string; // the ORD- number the customer sees
  items: OrderItem[];
  totalAmount: number;
  deliveryFee?: number;
  customerPhone?: string;
  paymentMethod: 'card' | 'paypal' | 'cod' | 'razorpay';
  paymentStatus: 'pending' | 'paid' | 'failed';
  status: OrderStatus;
  shippingAddress: Address;
  date: string; // maps from placedAt
  customerName: string; // derived from shippingAddress
  customerEmail: string; // derived from shippingAddress
  isPreorder?: boolean;
}


export interface OrdersApiResponse {
  orders: Order[];
  totalCount: number;
}

export interface Category {
  _id: string;
  name: string;
  description: string;
  imageUrl: string; // maps from 'image'
  productCount?: number;
  showInHero?: boolean; // shown as a card in the storefront home hero
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  subHeading: string;
  price: number;
  stock: number;
  category: string;
  categoryId?: string;
  imageUrls: string[];
  specifications: { key: string; value: string; }[];
  variants?: ProductVariant[];
  showInHero?: boolean; // shown in the storefront home hero carousel
}

export interface ProductsApiResponse {
  products: Product[];
  totalCount: number;
}

export type SortConfig<T> = {
  key: keyof T | null;
  direction: 'ascending' | 'descending';
}

export type Page = 'dashboard' | 'products' | 'categories' | 'orders' | 'reviews' | 'customers' | 'reports' | 'websiteContent' | 'settings';

export interface User {
  name: string;
  email: string;
  role: 'Admin' | 'Editor';
}

export type DashboardStats = {
    totalSales: { value: number };
    totalOrders: { value: number };
    totalProducts: { value: number };
    totalCategories: { value: number };
};

export interface Offer {
  id: string;
  title: string;
  description: string;
  promoCode: string;
}

export interface BannerImage {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
}

export interface WebsiteContent {
  key: string;
  label: string;
  value: string;
}

// A ready-made size list for the product form, suggested for the categories it is linked to.
export interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
  categoryIds: string[];
}

export interface ReviewProduct {
  _id: string;
  name: string;
  images: string[];
  imageThumbs?: string[];
  price?: number;
}

export interface Review {
  _id: string;
  productId: string;
  product: ReviewProduct | null;
  name: string;
  rating: number;
  comment: string;
  isVerified: boolean;
  isPublished: boolean; // false: hidden from the shop
  isFeatured: boolean; // shown on the home page
  // the customer account that wrote it (reviews from before sign-in existed have none)
  userId?: { _id: string; name: string; email?: string } | string | null;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ReviewStatusFilter = '' | 'published' | 'hidden' | 'featured';

export interface ReviewsApiResponse {
  reviews: Review[];
  totalCount: number;
}

export interface ReviewStats {
  total: number;
  published: number;
  hidden: number;
  featured: number;
  avgRating: number;
  products: { productId: string; name: string; count: number; avgRating: number }[];
}

export interface PortfolioItem {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  section: 'hero' | 'gallery' | 'featured' | 'yt-videos';
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppContextType {
  activePage: Page;
  setActivePage: (page: Page) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  toastMessage: string;
  showToast: (message: string) => void;
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}
// --- Customers (shop accounts made through Supabase Auth: Google or email + password) ---
export type CustomerStatusFilter = '' | 'active' | 'blocked';

export interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  authProvider?: string; // 'google' | 'email'
  isBlocked: boolean;
  lastSignInAt?: string;
  createdAt: string;
  counts: { orders: number; reviews: number; cart: number; wishlist: number };
}

export interface CustomersApiResponse {
  customers: Customer[];
  totalCount: number;
}

export interface CustomerStats {
  total: number;
  blocked: number;
  newLast30: number;
  google: number;
}

// One of the customer's orders as the API returns it (only the fields the detail panel shows).
export interface CustomerOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  totalAmount: number;
  placedAt?: string;
  createdAt?: string;
  orderItems?: { quantity: number }[];
}

export interface CustomerDetail {
  customer: Customer;
  orders: CustomerOrder[];
  reviews: Review[];
}
