import express from 'express';
import { sellerLogin, isSellerAuth, sellerLogout, listStaff, demoteStaff } from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';

const sellerRouter = express.Router();

sellerRouter.post('/login', sellerLogin);
sellerRouter.get('/is-auth', authSeller, isSellerAuth);
sellerRouter.get('/logout', sellerLogout);
sellerRouter.get('/staff', authSeller, listStaff);
sellerRouter.patch('/staff/:id/demote', authSeller, demoteStaff);

export default sellerRouter;