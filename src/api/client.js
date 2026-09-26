import axios from 'axios';
import { cacheSet, cacheGet } from '../offline/db';
import { queueMutation, isNetworkError } from '../offline/sync';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Offline helpers ──────────────────────────────────────────────────────────
//
// getWithCache(key, axiosCall)
//   → Tries the API. On success: caches the response and returns it.
//   → On network failure: returns the last cached copy, or rethrows if none.
//
// postWithFallback({ url, data, label, buildTempResponse })
//   → Tries the API POST. On success: returns the response.
//   → On network failure: queues to the outbox and returns a synthetic
//     { data, _offline: true } object so callers can show a "saved locally" UI.
//
// Both are safe to call even when IndexedDB is unavailable — they degrade
// gracefully to plain API calls.

export async function getWithCache(key, axiosCall) {
  try {
    const res = await axiosCall();
    try { await cacheSet(key, res.data); } catch { /* IDB unavailable */ }
    return res;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    try {
      const cached = await cacheGet(key);
      if (cached !== null && cached !== undefined) {
        return { data: cached, _offline: true };
      }
    } catch { /* IDB unavailable */ }
    throw err;
  }
}

export async function postWithFallback({ url, data, label }) {
  try {
    return await api.post(url, data);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    try {
      await queueMutation({ url, data, label });
      return { data: { _queued: true, _label: label }, _offline: true };
    } catch (idbErr) {
      // IndexedDB failed too — surface the original network error
      throw err;
    }
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const login = (username, password) =>
  api.post('/login', { username, password });

// ── Users (Admin only) ────────────────────────────────────────────────────

export const getUsers = () => api.get('/users');

export const registerUser = (data) => api.post('/register', data);

export const updateUser = (id, data) => api.put(`/users/${id}`, data);

// ── Products ───────────────────────────────────────────────────────────────

export const getProducts = () => getWithCache('products', () => api.get('/products'));

export const createProduct = (data) => api.post('/products', data);

export const updateProduct = (id, data) => api.put(`/products/${id}`, data);

export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ── Categories ───────────────────────────────────────────────────────────

export const getCategories = () => getWithCache('categories', () => api.get('/categories'));

export const createCategory = (data) => api.post('/categories', data);

export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);

export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// ── Billing ───────────────────────────────────────────────────────────────

export const checkout = (data) =>
  postWithFallback({ url: '/billing/checkout', data, label: 'Bill' });

export const getReceipt = (invoiceNumber) => api.get(`/billing/receipt/${invoiceNumber}`);

export const holdSale = (data) => api.post('/billing/hold', data);

export const getHeldSales = () => api.get('/billing/held');

export const getHeldSale = (holdRef) => api.get(`/billing/held/${holdRef}`);

export const deleteHeldSale = (holdRef) => api.delete(`/billing/held/${holdRef}`);

export const getSalesHistory = (params = {}) => api.get('/billing/sales', { params });

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

// ── Employees ─────────────────────────────────────────────────────────────────

export const getEmployees    = ()         => api.get('/employees');
export const createEmployee  = (data)     => api.post('/employees', data);
export const updateEmployee  = (id, data) => api.put(`/employees/${id}`, data);

// ── Attendance ────────────────────────────────────────────────────────────────

export const getAttendance    = (date)   => api.get('/attendance', { params: { date } });
export const markAttendance   = (data)   => api.post('/attendance', data);
export const getAttendanceReport = (month) => api.get('/attendance/report', { params: { month } });

// ── Salary ────────────────────────────────────────────────────────────────────

export const markSalaryPaid      = (data)                  => api.post('/salary/pay', data);
export const listSalaryPayments  = (employee_id, month)    => api.get('/salary/payments', { params: { employee_id, month } });

// ── Advances ──────────────────────────────────────────────────────────────────

export const giveAdvance   = (data)                        => api.post('/advances', data);
export const listAdvances  = (employee_id, month)          => api.get('/advances', { params: { employee_id, month } });

// ── Suppliers ─────────────────────────────────────────────────────────────────

export const getSuppliers    = ()       => api.get('/suppliers');
export const createSupplier  = (data)   => api.post('/suppliers', data);
export const updateSupplier  = (id, d)  => api.put(`/suppliers/${id}`, d);
export const deleteSupplier  = (id)     => api.delete(`/suppliers/${id}`);

// ── Brands ────────────────────────────────────────────────────────────────────

export const getBrands = () => api.get('/brands');

// ── Purchase Orders ───────────────────────────────────────────────────────────

export const createPurchaseOrder  = (data)         => api.post('/purchase-orders', data);
export const getPurchaseOrders    = (status = 'all') => api.get('/purchase-orders', { params: { status } });
export const getPurchaseOrder     = (id)           => api.get(`/purchase-orders/${id}`);
export const receivePurchaseOrder = (id, data)     => api.post(`/purchase-orders/${id}/receive`, data);
export const deletePurchaseOrder  = (id)           => api.delete(`/purchase-orders/${id}`);

// ── Expense Categories ────────────────────────────────────────────────────────

export const getExpenseCategories    = ()          => api.get('/expense-categories');
export const createExpenseCategory   = (data)      => api.post('/expense-categories', data);
export const updateExpenseCategory   = (id, data)  => api.put(`/expense-categories/${id}`, data);
export const deleteExpenseCategory   = (id)        => api.delete(`/expense-categories/${id}`);

// ── Expense Report ────────────────────────────────────────────────────────────

export const getExpenseReport = (params = {}) => api.get('/expense-report', { params });

// ── Daily Expenses ────────────────────────────────────────────────────────────

export const getDailyExpenses    = (params = {}) => api.get('/daily-expenses', { params });
export const createDailyExpense  = (data)        =>
  postWithFallback({ url: '/daily-expenses', data, label: 'Expense' });
export const updateDailyExpense  = (id, data)    => api.put(`/daily-expenses/${id}`, data);
export const deleteDailyExpense  = (id)          => api.delete(`/daily-expenses/${id}`);


// ── Contact Categories ────────────────────────────────────────────────────────

export const getContactCategories    = ()          => api.get('/contact-categories');
export const createContactCategory   = (data)      => api.post('/contact-categories', data);
export const updateContactCategory   = (id, data)  => api.put(`/contact-categories/${id}`, data);
export const deleteContactCategory   = (id)        => api.delete(`/contact-categories/${id}`);

// ── Contacts ──────────────────────────────────────────────────────────────────

export const getContacts    = (params = {}) => api.get('/contacts', { params });
export const createContact  = (data)        => api.post('/contacts', data);
export const updateContact  = (id, data)    => api.put(`/contacts/${id}`, data);
export const deleteContact  = (id)          => api.delete(`/contacts/${id}`);

export default api;

// Re-export offline helpers for convenience
export { isNetworkError, getQueuedByUrl, getAllQueued } from '../offline/sync';
