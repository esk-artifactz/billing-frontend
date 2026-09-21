import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Billing from './pages/Billing';
import SalesReport from './pages/SalesReport';
import CreditBills from './pages/CreditBills';
import StockAlerts from './pages/StockAlerts';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — any logged-in user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin only */}
          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <Users />
              </ProtectedRoute>
            }
          />

          {/* Products — any logged-in user */}
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />

          {/* Categories — any logged-in user */}
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />

          {/* Billing — any logged-in user */}
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            }
          />

          {/* Sales Report — Admin only */}
          <Route
            path="/sales-report"
            element={
              <ProtectedRoute adminOnly>
                <SalesReport />
              </ProtectedRoute>
            }
          />

          {/* Credit Bills — any logged-in user */}
          <Route
            path="/credit-bills"
            element={
              <ProtectedRoute>
                <CreditBills />
              </ProtectedRoute>
            }
          />

          {/* Stock Alerts — Admin only */}
          <Route
            path="/stock-alerts"
            element={
              <ProtectedRoute adminOnly>
                <StockAlerts />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
