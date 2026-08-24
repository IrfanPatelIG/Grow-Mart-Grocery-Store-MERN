# 🛒 Grow-Mart – Online Grocery Store

Grow-Mart is a **full-stack MERN (MongoDB, Express, React, Node.js)** grocery app. Customers can browse products, manage a shopping cart, save addresses, and place orders via **Cash on Delivery (COD)** or **Stripe Online Payments**. Staff and Admin/Sellers can manage products, inventory, and customer orders.

👉 Live demo: [grow-mart.vercel.app](https://grow-mart-grocery-store.vercel.app/)

---

## ✨ Features

### 👤 Customer

- Register & login using JWT & cookies
- Browse categories and products with offers
- Add/remove items in the cart
- Save delivery addresses
- Checkout with:
  - **Cash on Delivery (COD)**
  - **Stripe Online Payment** (secure with webhook order updates)
- View order history and payment status

### 👷 Staff

- Secure staff login
- Manage product stock and inventory
- View and manage customer orders
- Update order status
- Manage return and exchange requests

### 🧑‍💼 Admin/Seller

- Secure admin/seller login
- Add / edit / delete products
- Upload product images using Cloudinary
- Manage product inventory
- View and manage customer orders
- Manage staff

---

##  Tech Stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Frontend   | React + Vite, Tailwind CSS           |
| Backend    | Node.js, Express, JWT auth           |
| Database   | MongoDB Atlas with Mongoose ODM      |
| Storage    | Cloudinary for product images        |
| Payments   | Stripe Checkout & Webhooks           |
| Hosting    | Vercel (frontend ), render (backend) |

---
## 📸 Screenshots

### 👤 User Side
- **Home Page**
  ![Home](./client/src/assets/home.JPG)
