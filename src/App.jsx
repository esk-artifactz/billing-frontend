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
import Attendance from './pages/Attendance';
import AttendanceReport from './pages/AttendanceReport';
import PurchaseOrder from './pages/PurchaseOrder';
import ReceiveStock from './pages/ReceiveStock';
import Suppliers from './pages/Suppliers';
import DailyExpenses from './pages/DailyExpenses';
import ExpenseCategories from './pages/ExpenseCategories';
import Contacts from './pages/Contacts';
import SalesHistory from './pages/SalesHistory';

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

          {/* Stock Alerts — Cashier & Admin */}
          <Route
            path="/stock-alerts"
            element={
              <ProtectedRoute>
                <StockAlerts />
              </ProtectedRoute>
            }
          />

          {/* Attendance — Cashier & Admin can mark */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <Attendance />
              </ProtectedRoute>
            }
          />

          {/* Attendance Report & HR — Admin only */}
          <Route
            path="/attendance-report"
            element={
              <ProtectedRoute adminOnly>
                <AttendanceReport />
              </ProtectedRoute>
            }
          />

          {/* Suppliers — Admin only */}
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute adminOnly>
                <Suppliers />
              </ProtectedRoute>
            }
          />

          {/* Purchase Order — Cashier & Admin */}
          <Route
            path="/purchase-order"
            element={
              <ProtectedRoute>
                <PurchaseOrder />
              </ProtectedRoute>
            }
          />

          {/* Receive Stock — Cashier & Admin */}
          <Route
            path="/receive-stock"
            element={
              <ProtectedRoute>
                <ReceiveStock />
              </ProtectedRoute>
            }
          />

          {/* Daily Expenses — Cashier & Admin */}
          <Route
            path="/daily-expenses"
            element={
              <ProtectedRoute>
                <DailyExpenses />
              </ProtectedRoute>
            }
          />

          {/* Expense Report & Categories — Admin only */}
          <Route
            path="/expense-categories"
            element={
              <ProtectedRoute adminOnly>
                <ExpenseCategories />
              </ProtectedRoute>
            }
          />

          {/* Contacts — Cashier & Admin */}
          <Route
            path="/contacts"
            element={
              <ProtectedRoute>
                <Contacts />
              </ProtectedRoute>
            }
          />

          {/* Bill History — Cashier & Admin */}
          <Route
            path="/sales-history"
            element={
              <ProtectedRoute>
                <SalesHistory />
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
