import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Stripe from 'stripe';
import User from '../models/User.js';
import mongoose from 'mongoose';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const validateItems = (items) => Array.isArray(items) && items.length > 0 && items.every((item) => (
    mongoose.isValidObjectId(item.product) && Number.isInteger(item.quantity) && item.quantity > 0
));

const reserveInventory = async (items, session) => {
    const quantities = new Map();
    items.forEach((item) => {
        quantities.set(item.product, (quantities.get(item.product) || 0) + item.quantity);
    });

    const products = [];
    for (const [productId, quantity] of quantities) {
        const product = await Product.findOneAndUpdate(
            { _id: productId, quantity: { $gte: quantity }, inStock: true },
            { $inc: { quantity: -quantity } },
            { new: true, session }
        );
        if (!product) {
            throw new Error('One or more products are out of stock');
        }
        if (product.quantity === 0) {
            await Product.findByIdAndUpdate(product._id, {inStock: false}, {session});
        }
        products.push({ product, quantity });
    }
    return products;
};

const restoreInventory = async (items, session) => {
    const quantities = new Map();
    items.forEach((item) => {
        const productId = item.product._id?.toString() || item.product.toString();
        quantities.set(productId, (quantities.get(productId) || 0) + item.quantity);
    });

    for (const [productId, quantity] of quantities) {
        await Product.findByIdAndUpdate(
            productId,
            { $inc: { quantity }, $set: { inStock: true } },
            { session }
        );
    }
};

const createOrderWithInventory = async ({ userId, address, items, paymentType }) => {
    if (!address || !validateItems(items)) {
        throw new Error('Invalid data');
    }

    const session = await mongoose.startSession();
    try {
        let createdOrder;
        await session.withTransaction(async () => {
            const reservedProducts = await reserveInventory(items, session);
            const amount = reservedProducts.reduce(
                (sum, item) => sum + item.product.offerPrice * item.quantity,
                0
            );
            const taxedAmount = amount + Math.floor(amount * 0.02);
            [createdOrder] = await Order.create([{
                userId,
                items,
                amount: taxedAmount,
                address,
                paymentType,
                isPaid: false
            }], { session });
        });
        return createdOrder;
    } finally {
        await session.endSession();
    }
};

const releaseFailedPaymentOrder = async (orderId) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const order = await Order.findById(orderId).session(session);
            if (order && order.status !== 'Cancelled') {
                await restoreInventory(order.items, session);
                await Order.findByIdAndUpdate(orderId, {status: 'Cancelled'}, {session});
            }
        });
    } finally {
        await session.endSession();
    }
};

// Place Order COD : /api/order/cod
export const placeOrderCOD = async (req, res) => {
    try {
        const { address, items } = req.body;
        await createOrderWithInventory({userId: req.userId, address, items, paymentType: 'COD'});

        return res.json({ success: true, message: "Order placed successfully!" });
    } catch (error) {
        console.log(error.message);
        res.status(400).json({ success: false, message: error.message });
    }
}

// Place Order Stripe : /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    let order;
    try {
        const userId = req.userId;
        const { address, items } = req.body;
        const { origin } = req.headers;

        if (!address || !validateItems(items)) {
            return res.status(400).json({ success: false, message: "Invalid data" });
        }

        order = await createOrderWithInventory({userId, address, items, paymentType: 'Online'});
        const products = await Product.find({_id: {$in: items.map((item) => item.product)}});
        const productData = items.map((item) => {
            const product = products.find((candidate) => candidate._id.toString() === item.product.toString());
            return {name: product.name, price: product.offerPrice, quantity: item.quantity};
        });

        // Stripe line items
        const line_items = productData.map(item => ({
            price_data: {
                currency: "usd",
                product_data: { name: item.name },
                unit_amount: Math.floor(item.price + item.price * 0.02) * 100
            },
            quantity: item.quantity
        }));

        const session = await stripe.checkout.sessions.create({
            line_items,
            mode: "payment",
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            payment_intent_data: {
                metadata: {
                    orderId: order._id.toString(),
                    userId
                }
            }
        });

        return res.json({ success: true, url: session.url });

    } catch (error) {
        console.log(error.message);
        if (order) {
            try {
                await releaseFailedPaymentOrder(order._id);
            } catch (releaseError) {
                console.log(releaseError.message);
            }
        }
        res.status(400).json({ success: false, message: error.message });
    }
}

// Stripe Webhooks to verify payments : /stripe
export const stripeWebhooks = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
        // Stripe requires raw body
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
        let orderId, userId;
        // Handle different Stripe events
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            orderId = session.metadata.orderId;
            userId = session.metadata.userId;
        } else if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object;
            orderId = paymentIntent.metadata?.orderId;
            userId = paymentIntent.metadata?.userId;
        } else {
            // ignore other events
            return res.status(200).json({ received: true });
        }
        if (!orderId || !userId) {
            console.error("Missing metadata for orderId or userId");
            return res.status(400).send("Missing metadata");
        }
        // Update order to mark as paid
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { isPaid: true },
            { new: true } // return updated document
        );
        if (!updatedOrder) {
            return res.status(404).send("Order not found");
        }
        // Clear user's cart
        await User.findByIdAndUpdate(userId, { cartItems: {} });
        res.status(200).json({ received: true });
    } catch (err) {
        console.error("Error handling webhook:", err.message);
        res.status(500).send("Internal server error");
    }
};


// Get Orders by userId : /api/order/user
export const getUserOrders = async (req, res) => {
    try {
        const userId = req.userId;
        // Include all orders for this user
        const orders = await Order.find({ userId }).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Get all orders (for seller / admin) : /api/order/seller
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate("items.product address").sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
}

// Cancel an order and restore its reserved inventory : /api/order/:id/cancel
export const cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        let cancelledOrder;
        await session.withTransaction(async () => {
            const order = await Order.findById(req.params.id).session(session);
            if (!order) {
                throw new Error('Order not found');
            }
            if (order.status === 'Cancelled') {
                throw new Error('Order is already cancelled');
            }

            const user = await User.findById(req.userId).select('role').session(session);
            const isStaff = user?.role === 'staff';
            if (!isStaff && order.userId.toString() !== req.userId) {
                throw new Error('Forbidden');
            }

            await restoreInventory(order.items, session);
            cancelledOrder = await Order.findByIdAndUpdate(
                order._id,
                {status: 'Cancelled'},
                {new: true, session}
            );
        });
        return res.json({success: true, order: cancelledOrder});
    } catch (error) {
        console.log(error.message);
        const status = error.message === 'Forbidden' ? 403 : error.message === 'Order not found' ? 404 : 400;
        return res.status(status).json({success: false, message: error.message});
    } finally {
        await session.endSession();
    }
};
