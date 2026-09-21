import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────

export const login = (username, password) =>
  api.post('/login', { username, password });

// ── Users (Admin only) ────────────────────────────────────────────────────

export const getUsers = () => api.get('/users');

export const registerUser = (data) => api.post('/register', data);

export const updateUser = (id, data) => api.put(`/users/${id}`, data);

// ── Products ───────────────────────────────────────────────────────────────

export const getProducts = () => api.get('/products');

export const createProduct = (data) => api.post('/products', data);

export const updateProduct = (id, data) => api.put(`/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ── Categories ───────────────────────────────────────────────────────────

export const getCategories = () => api.get('/categories');

export const createCategory = (data) => api.post('/categories', data);

export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);

export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// ── Billing ───────────────────────────────────────────────────────────────

export const checkout = (data) => api.post('/billing/checkout', data);

export const getReceipt = (invoiceNumber) => api.get(`/billing/receipt/${invoiceNumber}`);

export const holdSale = (data) => api.post('/billing/hold', data);

export const getHeldSales = () => api.get('/billing/held');

export const getHeldSale = (holdRef) => api.get(`/billing/held/${holdRef}`);

export const deleteHeldSale = (holdRef) => api.delete(`/billing/held/${holdRef}`);

export const getSalesHistory = () => api.get('/billing/sales');

// ── Credit Bills ──────────────────────────────────────────────────────────────

export const createCreditBill   = (data)             => api.post('/credit-bills', data);
export const getCreditBills     = (params = {})      => api.get('/credit-bills', { params });
export const payCreditBill      = (id, data)         => api.post(`/credit-bills/${id}/pay`, data);
export const deleteCreditBill   = (id)               => api.delete(`/credit-bills/${id}`);

// ── Stock Alerts ──────────────────────────────────────────────────────────────

export const getStockAlerts = () => api.get('/stock/alerts');

// ── Sales Stats ───────────────────────────────────────────────────────────────

export const getCategorySalesStats = ({ dateFrom, dateTo } = {}) => {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo)   params.date_to   = dateTo;
  return api.get('/billing/stats/categories', { params });
};

export default api;
