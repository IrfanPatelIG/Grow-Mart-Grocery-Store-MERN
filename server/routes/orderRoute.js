import express from 'express';
import authUser from '../middlewares/authUser.js';
import { cancelOrder, getAllOrders, getUserOrders, placeOrderCOD, placeOrderStripe } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';
import authorizeCustomer from '../middlewares/authorizeCustomer.js';

const orderRouter = express.Router();

orderRouter.post('/cod', authUser, authorizeCustomer, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, getAllOrders);
orderRouter.post('/stripe', authUser, authorizeCustomer, placeOrderStripe);
orderRouter.post('/:id/cancel', authUser, cancelOrder);

export default orderRouter;