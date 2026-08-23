import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ReturnRequest from '../models/ReturnRequest.js';

const completedStatuses = ['Delivered', 'Picked Up'];

const getRequestData = (request) => request.populate([
    {path: 'orderId', select: '_id status fulfillmentMethod'},
    {path: 'productId', select: 'name images offerPrice'},
    {path: 'replacementProductId', select: 'name images offerPrice'}
]);

export const createReturnRequest = async (req, res) => {
    try {
        const {orderId, productId, quantity, type, reason, replacementProductId} = req.body;
        if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId) || !['return', 'exchange'].includes(type) || !Number.isInteger(quantity) || quantity < 1 || !reason?.trim()) {
            return res.status(400).json({success: false, message: 'Invalid return or exchange details'});
        }
        if (type === 'exchange' && !mongoose.isValidObjectId(replacementProductId)) {
            return res.status(400).json({success: false, message: 'Select a replacement product'});
        }

        const order = await Order.findOne({_id: orderId, userId: req.userId});
        if (!order || !completedStatuses.includes(order.status)) {
            return res.status(400).json({success: false, message: 'Only completed orders can be returned'});
        }
        const orderItem = order.items.find((item) => item.product.toString() === productId);
        if (!orderItem || quantity > orderItem.quantity) {
            return res.status(400).json({success: false, message: 'Invalid product quantity'});
        }
        const originalProduct = await Product.findById(productId).select('offerPrice');
        const replacementProduct = type === 'exchange' ? await Product.findById(replacementProductId).select('offerPrice') : null;
        if (!originalProduct || (type === 'exchange' && !replacementProduct)) {
            return res.status(404).json({success: false, message: 'Product not found'});
        }
        const originalAmount = originalProduct.offerPrice * quantity;
        const replacementAmount = replacementProduct ? replacementProduct.offerPrice * quantity : undefined;
        const additionalAmount = replacementAmount ? Math.max(replacementAmount - originalAmount, 0) : 0;
        const existingRequest = await ReturnRequest.findOne({orderId, productId, status: {$in: ['awaiting_payment', 'pending', 'approved']}});
        if (existingRequest) {
            return res.status(409).json({success: false, message: 'A request already exists for this product'});
        }

        const request = await ReturnRequest.create({orderId, userId: req.userId, productId, quantity, type, reason: reason.trim(), replacementProductId: type === 'exchange' ? replacementProductId : undefined, originalAmount, replacementAmount, additionalAmount, status: additionalAmount > 0 ? 'awaiting_payment' : 'pending'});
        return res.status(201).json({success: true, message: 'Request submitted', request: await getRequestData(request)});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to submit request'});
    }
};

export const confirmExchangePayment = async (req, res) => {
    try {
        const request = await ReturnRequest.findOneAndUpdate(
            {_id: req.params.id, userId: req.userId, type: 'exchange', status: 'awaiting_payment', additionalAmount: {$gt: 0}},
            {status: 'pending', paymentConfirmed: true},
            {new: true}
        );
        if (!request) return res.status(400).json({success: false, message: 'Exchange payment cannot be confirmed'});
        return res.json({success: true, message: 'Dummy payment confirmed. Exchange request submitted.', request});
    } catch (error) {
        return res.status(400).json({success: false, message: 'Unable to confirm exchange payment'});
    }
};

export const remindExchangePayment = async (req, res) => {
    try {
        const request = await ReturnRequest.findOneAndUpdate(
            {_id: req.params.id, type: 'exchange', status: 'awaiting_payment'},
            {$set: {paymentReminderSentAt: new Date()}, $inc: {paymentReminderCount: 1}},
            {new: true}
        );
        if (!request) return res.status(400).json({success: false, message: 'Payment reminder is not available'});
        return res.json({success: true, message: 'Payment request resent', request});
    } catch (error) {
        return res.status(400).json({success: false, message: 'Unable to resend payment request'});
    }
};

export const getUserReturnRequests = async (req, res) => {
    try {
        const requests = await ReturnRequest.find({userId: req.userId}).populate('orderId productId replacementProductId').sort({createdAt: -1});
        return res.json({success: true, requests});
    } catch (error) {
        return res.status(500).json({success: false, message: 'Unable to fetch requests'});
    }
};

export const getAllReturnRequests = async (req, res) => {
    try {
        const requests = await ReturnRequest.find({}).populate('orderId productId replacementProductId userId', '-password').sort({createdAt: -1});
        return res.json({success: true, requests});
    } catch (error) {
        return res.status(500).json({success: false, message: 'Unable to fetch requests'});
    }
};

export const reviewReturnRequest = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const {status, reviewNote} = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({success: false, message: 'Invalid review status'});
        }
        let updatedRequest;
        await session.withTransaction(async () => {
            const request = await ReturnRequest.findById(req.params.id).session(session);
            if (!request || request.status !== 'pending') throw new Error('Request is no longer pending');
            if (request.type === 'exchange' && request.additionalAmount > 0 && !request.paymentConfirmed) throw new Error('Customer payment is required before approval');
            if (status === 'approved') {
                const returnedProduct = await Product.findByIdAndUpdate(request.productId, {$inc: {quantity: request.quantity}, $set: {inStock: true}}, {new: true, session});
                if (!returnedProduct) throw new Error('Returned product no longer exists');
                if (request.type === 'exchange') {
                    const replacement = await Product.findOneAndUpdate(
                        {_id: request.replacementProductId, quantity: {$gte: request.quantity}, inStock: true},
                        {$inc: {quantity: -request.quantity}},
                        {new: true, session}
                    );
                    if (!replacement) throw new Error('Replacement product is out of stock');
                    if (replacement.quantity === 0) await Product.findByIdAndUpdate(replacement._id, {inStock: false}, {session});
                }
            }
            updatedRequest = await ReturnRequest.findByIdAndUpdate(request._id, {status, reviewNote: reviewNote?.trim(), reviewedAt: new Date()}, {new: true, session});
        });
        return res.json({success: true, message: `Request ${status}`, request: updatedRequest});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: error.message});
    } finally {
        await session.endSession();
    }
};
