import express from 'express';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';
import authorizeRoles from '../middlewares/authorizeRoles.js';
import authorizeCustomer from '../middlewares/authorizeCustomer.js';
import { confirmExchangePayment, createReturnRequest, getAllReturnRequests, getUserReturnRequests, remindExchangePayment, reviewReturnRequest } from '../controllers/returnController.js';

const returnRouter = express.Router();

returnRouter.post('/', authUser, authorizeCustomer, createReturnRequest);
returnRouter.get('/user', authUser, authorizeCustomer, getUserReturnRequests);
returnRouter.get('/admin', authSeller, getAllReturnRequests);
returnRouter.patch('/:id/admin-review', authSeller, reviewReturnRequest);
returnRouter.patch('/:id/admin-remind-payment', authSeller, remindExchangePayment);
returnRouter.get('/staff', authUser, authorizeRoles('staff'), getAllReturnRequests);
returnRouter.patch('/:id/staff-review', authUser, authorizeRoles('staff'), reviewReturnRequest);
returnRouter.patch('/:id/staff-remind-payment', authUser, authorizeRoles('staff'), remindExchangePayment);
returnRouter.post('/:id/payment', authUser, authorizeCustomer, confirmExchangePayment);

export default returnRouter;