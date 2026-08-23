import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema({
    orderId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'order'},
    userId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'user'},
    productId: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'product'},
    quantity: {type: Number, required: true, min: 1},
    type: {type: String, enum: ['return', 'exchange'], required: true},
    replacementProductId: {type: mongoose.Schema.Types.ObjectId, ref: 'product'},
    reason: {type: String, required: true, trim: true, maxlength: 500},
    status: {type: String, enum: ['awaiting_payment', 'pending', 'approved', 'rejected'], default: 'pending'},
    originalAmount: {type: Number, required: true, min: 0},
    replacementAmount: {type: Number, required: false, min: 0},
    additionalAmount: {type: Number, default: 0, min: 0},
    paymentConfirmed: {type: Boolean, default: false},
    paymentReminderSentAt: {type: Date},
    paymentReminderCount: {type: Number, default: 0},
    reviewedAt: {type: Date},
    reviewNote: {type: String, trim: true, maxlength: 500}
}, {timestamps: true});

returnRequestSchema.index({orderId: 1, productId: 1, status: 1});

const ReturnRequest = mongoose.models.returnRequest || mongoose.model('returnRequest', returnRequestSchema);

export default ReturnRequest;
