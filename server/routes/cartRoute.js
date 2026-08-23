import express from 'express';
import { updateCart } from '../controllers/cartController.js';
import authUser from '../middlewares/authUser.js';
import authorizeCustomer from '../middlewares/authorizeCustomer.js';

const cartRouter = express.Router();

cartRouter.post('/update', authUser, authorizeCustomer, updateCart);

export default cartRouter;