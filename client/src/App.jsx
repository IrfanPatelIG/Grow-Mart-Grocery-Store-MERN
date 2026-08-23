import { Route, Routes, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"
import Home from "./pages/Home"
import { Toaster } from 'react-hot-toast';
import Footer from "./components/Footer";
import { useAppContext } from "./context/AppContext";
import Login from "./components/Login";
import AllProducts from "./pages/AllProducts";
import ProductCategory from "./pages/ProductCategory";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import AddAddress from "./pages/AddAddress";
import MyOrders from "./pages/MyOrders";
import Profile from "./pages/Profile";
import SellerLogin from "./components/seller/SellerLogin";
import SellerLayout from "./pages/seller/SellerLayout";
import AddProduct from "./pages/seller/AddProduct";
import ProductList from "./pages/seller/ProductList.jsx"
import Orders from "./pages/seller/Orders.jsx"
import Loading from "./components/Loading.jsx"
import StaffDashboard from "./pages/staff/StaffDashboard.jsx"
import StaffManagement from "./pages/seller/StaffManagement.jsx"
import ReturnRequests from "./pages/seller/ReturnRequests.jsx"
import StaffReturnRequests from "./pages/staff/StaffReturnRequests.jsx"

function App() {
  const isSellerPath = useLocation().pathname.includes("seller");
  const { showUserLogin, isSeller, user } = useAppContext();
  const userHasStaffRole = user?.role === "staff";
  const canAccessSellerArea = isSeller || userHasStaffRole;

  return (
    <>
      <div className="text-default min-h-screen text-gray-700 bg-white" >
        {isSellerPath ? null : <Navbar/> }
        {showUserLogin ? <Login /> : null }
        <Toaster />
        <div className={`${isSellerPath ? "" : "px-6 md:px-16 lg:px-24 xl:px-32"}`}>
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/products" element={<AllProducts/>} />
            <Route path="/products/:category" element={<ProductCategory/>} />
            <Route path="/products/:category/:id" element={<ProductDetails/>} />
            <Route path="/cart" element={userHasStaffRole ? <StaffDashboard /> : <Cart/>} />
            <Route path="/add-address" element={<AddAddress/>} />
            <Route path="/my-orders" element={<MyOrders/>} />
            <Route path="/profile" element={<Profile/>} />
            <Route path="/loader" element={<Loading/>} />
            <Route path="/staff" element={userHasStaffRole ? <StaffDashboard /> : <Home /> } />
            <Route path="/staff/returns" element={userHasStaffRole ? <StaffReturnRequests /> : <Home />} />
            <Route path="/seller" element={canAccessSellerArea ? <SellerLayout /> : <SellerLogin /> } >
              <Route index element={canAccessSellerArea ? <AddProduct /> : null} />
              <Route path="/seller/product-list" element={<ProductList />} />
              <Route path="/seller/orders" element={<Orders />} />
              <Route path="/seller/staff-management" element={isSeller ? <StaffManagement /> : null} />
              <Route path="/seller/returns" element={isSeller ? <ReturnRequests /> : null} />
            </Route>
          </Routes>
        </div>
        {!isSellerPath && <Footer />}
      </div>
    </>
  )
}

export default App
