import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Stripe from 'stripe';
import User from '../models/User.js';
import mongoose from 'mongoose';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const orderStatuses = ['Order Placed', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Picked Up', 'Cancelled'];
const validStatusTransitions = {
    'Order Placed': ['Processing', 'Cancelled'],
    'Processing': ['Ready for Pickup', 'Out for Delivery', 'Cancelled'],
    'Ready for Pickup': ['Picked Up', 'Cancelled'],
    'Out for Delivery': ['Delivered', 'Cancelled'],
    'Delivered': [],
    'Picked Up': [],
    'Cancelled': []
};
const AUTO_DELIVERY_MIN_MS = 60 * 1000;
const AUTO_DELIVERY_RANGE_MS = 2 * 60 * 1000;

const getAutomaticDeliveryAt = () => new Date(Date.now() + AUTO_DELIVERY_MIN_MS + Math.floor(Math.random() * (AUTO_DELIVERY_RANGE_MS + 1)));

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

const createOrderWithInventory = async ({ userId, address, items, paymentType, fulfillmentMethod, pickupDate, pickupTimeSlot }) => {
    const isPickup = fulfillmentMethod === 'pickup';
    const parsedPickupDate = pickupDate ? new Date(`${pickupDate}T23:59:59`) : null;
    if ((!isPickup && !address) || (isPickup && (!pickupDate || Number.isNaN(parsedPickupDate.getTime()) || parsedPickupDate <= new Date())) || !validateItems(items)) {
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
                fulfillmentMethod: isPickup ? 'pickup' : 'delivery',
                pickupDate: isPickup ? parsedPickupDate : undefined,
                pickupTimeSlot: isPickup ? pickupTimeSlot : undefined,
                autoDeliveryAt: getAutomaticDeliveryAt(),
                autoDeliveryPaused: false,
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
        const { address, items, fulfillmentMethod, pickupDate, pickupTimeSlot } = req.body;
        await createOrderWithInventory({userId: req.userId, address, items, paymentType: 'COD', fulfillmentMethod, pickupDate, pickupTimeSlot});

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
        const { address, items, fulfillmentMethod, pickupDate, pickupTimeSlot } = req.body;
        const { origin } = req.headers;

        if ((!address && fulfillmentMethod !== 'pickup') || !validateItems(items)) {
            return res.status(400).json({ success: false, message: "Invalid data" });
        }

        order = await createOrderWithInventory({userId, address, items, paymentType: 'Online', fulfillmentMethod, pickupDate, pickupTimeSlot});
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
        let orderId, userId, returnRequestId;
        // Handle different Stripe events
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            orderId = session.metadata.orderId;
            userId = session.metadata.userId;
            returnRequestId = session.metadata.returnRequestId;
        } else if (event.type === "payment_intent.succeeded") {
            const paymentIntent = event.data.object;
            orderId = paymentIntent.metadata?.orderId;
            userId = paymentIntent.metadata?.userId;
            returnRequestId = paymentIntent.metadata?.returnRequestId;
        } else {
            // ignore other events
            return res.status(200).json({ received: true });
        }
        if (returnRequestId && userId) {
            const ReturnRequest = (await import('../models/ReturnRequest.js')).default;
            const updatedRequest = await ReturnRequest.findOneAndUpdate(
                {_id: returnRequestId, userId, status: 'awaiting_payment'},
                {paymentConfirmed: true, status: 'pending'},
                {new: true}
            );
            if (!updatedRequest) return res.status(404).send("Exchange request not found");
            return res.status(200).json({received: true});
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

// Confirm a COD payment from the order owner : /api/order/:id/confirm-payment
export const confirmPayment = async (req, res) => {
    try {
        const order = await Order.findOne({_id: req.params.id, userId: req.userId});
        if (!order) return res.status(404).json({success: false, message: 'Order not found'});
        if (order.paymentType !== 'COD') {
            return res.status(400).json({success: false, message: 'Online payment is confirmed by the payment provider'});
        }
        if (order.status === 'Cancelled') {
            return res.status(400).json({success: false, message: 'Cancelled orders cannot be paid'});
        }
        order.isPaid = true;
        order.paymentConfirmedByCustomer = true;
        await order.save();
        return res.json({success: true, message: 'Payment confirmed', order});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to confirm payment'});
    }
};

// Confirm that the customer collected a pickup order : /api/order/:id/confirm-pickup
export const confirmPickup = async (req, res) => {
    try {
        const order = await Order.findOne({_id: req.params.id, userId: req.userId});
        if (!order) return res.status(404).json({success: false, message: 'Order not found'});
        if (order.fulfillmentMethod !== 'pickup' || order.status !== 'Ready for Pickup') {
            return res.status(400).json({success: false, message: 'Order is not ready for pickup'});
        }
        if (!order.isPaid) {
            return res.status(400).json({success: false, message: 'Payment must be confirmed before pickup'});
        }
        const updatedOrder = await Order.findOneAndUpdate(
            {_id: order._id, userId: req.userId, status: 'Ready for Pickup', fulfillmentMethod: 'pickup', isPaid: true},
            {status: 'Picked Up', autoDeliveryEnabled: false, autoDeliveryPaused: false},
            {new: true}
        );
        if (!updatedOrder) {
            return res.status(409).json({success: false, message: 'Order was already updated'});
        }
        return res.json({success: true, message: 'Order marked as picked up', order: updatedOrder});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to confirm pickup'});
    }
};

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

// Pause or resume automatic delivery. Admin-only because this uses the legacy seller login.
export const toggleAutomaticDelivery = async (req, res) => {
    try {
        const {paused, action} = req.body;
        const isStop = action === 'stop';
        if (!isStop && typeof paused !== 'boolean') {
            return res.status(400).json({success: false, message: 'Paused must be true or false'});
        }
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({success: false, message: 'Order not found'});
        if (['Delivered', 'Picked Up', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({success: false, message: 'Completed orders cannot be paused'});
        }

        const now = Date.now();
        const remainingMs = order.autoDeliveryRemainingMs ?? Math.max(new Date(order.autoDeliveryAt || now).getTime() - now, 0);
        const update = isStop
            ? {autoDeliveryEnabled: false, autoDeliveryPaused: false}
            : paused
                ? {autoDeliveryPaused: true, autoDeliveryRemainingMs: remainingMs}
                : {autoDeliveryEnabled: true, autoDeliveryPaused: false, autoDeliveryRemainingMs: undefined, autoDeliveryAt: new Date(now + remainingMs)};
        const updatedOrder = await Order.findByIdAndUpdate(order._id, update, {new: true});
        return res.json({success: true, message: isStop ? 'Automatic delivery stopped' : paused ? 'Automatic delivery paused' : 'Automatic delivery resumed', order: updatedOrder});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to update automatic delivery'});
    }
};

const advanceAutomaticOrders = async () => {
    const now = new Date();
    const orders = await Order.find({
        autoDeliveryAt: {$exists: true},
        autoDeliveryEnabled: true,
        autoDeliveryPaused: false,
        status: {$nin: ['Delivered', 'Cancelled']}
    }).select('_id status fulfillmentMethod createdAt autoDeliveryAt isPaid');

    for (const order of orders) {
        const duration = new Date(order.autoDeliveryAt).getTime() - new Date(order.createdAt).getTime();
        const progress = duration > 0 ? (now.getTime() - new Date(order.createdAt).getTime()) / duration : 1;
        let automaticStatus = progress >= 1 ? 'Delivered' : progress >= 0.66
            ? (order.fulfillmentMethod === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery')
            : progress >= 0.33 ? 'Processing' : 'Order Placed';
        if (order.fulfillmentMethod === 'pickup') {
            automaticStatus = progress >= 0.66 ? 'Ready for Pickup' : progress >= 0.33 ? 'Processing' : 'Order Placed';
        }
        if (automaticStatus === 'Delivered' && !order.isPaid) {
            automaticStatus = 'Out for Delivery';
        }
        const statusOrder = ['Order Placed', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered'];
        const currentIndex = statusOrder.indexOf(order.status);
        const nextIndex = statusOrder.indexOf(automaticStatus);
        if (nextIndex > currentIndex) {
            await Order.updateOne(
                {_id: order._id, autoDeliveryPaused: false, status: order.status},
                {status: automaticStatus}
            );
        }
    }
};

export const startAutomaticDeliveryScheduler = () => {
    setInterval(() => {
        advanceAutomaticOrders().catch((error) => console.log(error.message));
    }, 10000);
};

// Update an order through the allowed lifecycle : /api/order/:id/status
export const updateOrderStatus = async (req, res) => {
    try {
        const {status} = req.body;
        if (!orderStatuses.includes(status)) {
            return res.status(400).json({success: false, message: 'Invalid order status'});
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({success: false, message: 'Order not found'});
        }
        if (status === 'Picked Up') {
            return res.status(403).json({success: false, message: 'Only the customer can confirm pickup'});
        }
        const isFulfillmentStatusValid = status !== 'Ready for Pickup' || order.fulfillmentMethod === 'pickup';
        const isDeliveryStatusValid = status !== 'Out for Delivery' || order.fulfillmentMethod !== 'pickup';
        if (!validStatusTransitions[order.status]?.includes(status) || !isFulfillmentStatusValid || !isDeliveryStatusValid) {
            return res.status(400).json({success: false, message: `Cannot move order from ${order.status} to ${status}`});
        }
        if (status === 'Delivered' && (!order.isPaid || order.fulfillmentMethod === 'pickup')) {
            return res.status(400).json({success: false, message: 'Payment must be confirmed before delivery'});
        }
        if (status === 'Picked Up' && (order.fulfillmentMethod !== 'pickup' || !order.isPaid)) {
            return res.status(400).json({success: false, message: 'A paid pickup order is required'});
        }

        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, {status}, {new: true});
        return res.json({success: true, message: 'Order status updated', order: updatedOrder});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to update order status'});
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
            if (!validStatusTransitions[order.status]?.includes('Cancelled')) {
                throw new Error(`Order cannot be cancelled from ${order.status}`);
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
