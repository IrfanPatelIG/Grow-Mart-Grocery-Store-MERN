import express from 'express';
import { addProduct, productList, productById, changeStock, staffDashboard, deleteProduct, updateProduct } from '../controllers/productController.js';
import { upload } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import authUser from '../middlewares/authUser.js';
import authorizeRoles from '../middlewares/authorizeRoles.js';
import authStaffOrSeller from '../middlewares/authStaffOrSeller.js';

const productRouter = express.Router();

productRouter.post('/add', upload.array(["images"]), authStaffOrSeller, addProduct);
productRouter.get('/list', productList);
productRouter.get('/id', productById);
productRouter.post('/stock', authStaffOrSeller, changeStock);
productRouter.get('/staff-dashboard', authUser, authorizeRoles('staff'), staffDashboard);
productRouter.delete('/:id', authStaffOrSeller, deleteProduct);
productRouter.put('/:id', authStaffOrSeller, updateProduct);

export default productRouter;