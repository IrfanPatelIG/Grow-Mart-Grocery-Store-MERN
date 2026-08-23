import mongoose from 'mongoose';


const orderSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user'},
    items: [{
        product: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product'},
        quantity: {type: Number, required: true},
    }],
        amount: {type: Number, required: true},
        address: {type: String, required: false, ref: 'address'},
        fulfillmentMethod: {type: String, enum: ['delivery', 'pickup'], default: 'delivery'},
        pickupDate: {type: Date, required: false},
        status: {type: String, enum: ['Order Placed', 'Processing', 'Ready for Pickup', 'Out for Delivery', 'Delivered', 'Picked Up', 'Cancelled'], default: 'Order Placed'},
        autoDeliveryAt: {type: Date, required: false},
        autoDeliveryEnabled: {type: Boolean, default: true},
        autoDeliveryPaused: {type: Boolean, default: false},
        autoDeliveryRemainingMs: {type: Number, required: false},
        paymentType: {type: String, required: true},
        isPaid: {type: Boolean, required: true, default: false},
        paymentConfirmedByCustomer: {type: Boolean, default: false},
}, {timestamps: true});

const Order = mongoose.models.order || mongoose.model('order', orderSchema);

export default Order;