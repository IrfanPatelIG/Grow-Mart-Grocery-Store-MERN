import express from 'express';
import authUser from '../middlewares/authUser.js';
import { cancelOrder, confirmPayment, confirmPickup, getAllOrders, placeOrderCOD, placeOrderStripe, toggleAutomaticDelivery, updateOrderStatus, getUserOrders } from '../controllers/orderController.js';
import authStaffOrSeller from '../middlewares/authStaffOrSeller.js';
import authSeller from '../middlewares/authSeller.js';
import authorizeCustomer from '../middlewares/authorizeCustomer.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, authorizeCustomer, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authStaffOrSeller, getAllOrders);
orderRouter.post('/stripe', authUser, authorizeCustomer, placeOrderStripe);
orderRouter.post('/:id/cancel', authUser, cancelOrder);
orderRouter.post('/:id/confirm-payment', authUser, authorizeCustomer, confirmPayment);
orderRouter.post('/:id/confirm-pickup', authUser, authorizeCustomer, confirmPickup);
orderRouter.patch('/:id/status', authStaffOrSeller, updateOrderStatus);
orderRouter.patch('/:id/automatic-delivery', authSeller, toggleAutomaticDelivery);

export default orderRouter;