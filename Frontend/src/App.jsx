import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import PageLayout from './components/PageLayout.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import CategoryDetailsPage from './pages/CategoryDetailsPage.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import ProductListingPage from './pages/ProductListingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminProductsPage from './pages/admin/AdminProductsPage.jsx';
import AdminProductFormPage from './pages/admin/AdminProductFormPage.jsx';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage.jsx';
import { useAuth } from './auth/AuthContext.jsx';

function ProtectedAdmin() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <AdminLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="signup" element={<SignupPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="admin/login"
          element={<Navigate to="/login" replace state={{ from: { pathname: '/admin' } }} />}
        />
        <Route path="admin" element={<ProtectedAdmin />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductFormPage />} />
          <Route path="products/:productId/edit" element={<AdminProductFormPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
        </Route>
        <Route element={<PageLayout />}>
          <Route index element={<HomePage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:slug" element={<CategoryDetailsPage />} />
          <Route path="products" element={<ProductListingPage />} />
          <Route path="products/:slug" element={<ProductDetailsPage />} />
          <Route path="search" element={<ProductListingPage searchMode />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
