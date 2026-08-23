import { v2 as cloudinary } from 'cloudinary';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

// Add Product : /api/product/add
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);
        const images = req.files;
        let imagesUrl = await Promise.all(images.map(async (item) =>{
            let result = await cloudinary.uploader.upload(item.path, {resource_type: 'image'});
            return result.secure_url;
        }));
        await Product.create({...productData, images: imagesUrl});
        res.json({success: true, message: "Product Added"});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

// Get Product : /api/product/list
export const productList = async (req, res) => {
    try {
        const products = await Product.find({});
        res.json({success: true, products});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

// Get Single Product : /api/product/id
export const productById = async (req, res) => {
    try {
        const { id } = req.body;
        const product = await Product.findById(id);
        res.json({success: true, product});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res) => {
    try {
        const { id, quantity } = req.body;
        if (quantity < 0) {
            return res.json({ success: false, message: "Quantity cannot be negative" });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { quantity, inStock: quantity > 0 },
            { new: true }
        );

        res.json({ success: true, message: "Stock Updated", product: updatedProduct });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Get staff dashboard data : /api/staff/dashboard
export const staffDashboard = async (req, res) => {
    try {
        const [products, orders] = await Promise.all([
            Product.find({}).sort({ quantity: 1 }),
            Order.find({}).populate('items.product').sort({ createdAt: -1 }).limit(10)
        ]);

        const lowStockProducts = products.filter((product) => product.quantity <= 5);
        const totalSales = orders.reduce((sum, order) => sum + order.amount, 0);

        res.json({
            success: true,
            summary: {
                productCount: products.length,
                orderCount: orders.length,
                lowStockCount: lowStockProducts.length,
                totalSales
            },
            lowStockProducts,
            recentOrders: orders,
            products
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: 'Unable to fetch dashboard data'});
    }
};

// Delete a listed product : /api/product/:id
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({success: false, message: 'Product not found'});
        }
        return res.json({success: true, message: 'Product deleted'});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to delete product'});
    }
};

// Update a listed product : /api/product/:id
export const updateProduct = async (req, res) => {
    try {
        const {name, description, category, price, offerPrice} = req.body;
        if (!name?.trim() || !category?.trim() || Number(price) < 0 || Number(offerPrice) < 0) {
            return res.status(400).json({success: false, message: 'Invalid product details'});
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            {
                name: name.trim(),
                description: Array.isArray(description) ? description : String(description || '').split('\n'),
                category: category.trim(),
                price: Number(price),
                offerPrice: Number(offerPrice)
            },
            {new: true, runValidators: true}
        );
        if (!product) {
            return res.status(404).json({success: false, message: 'Product not found'});
        }
        return res.json({success: true, message: 'Product updated', product});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to update product'});
    }
};