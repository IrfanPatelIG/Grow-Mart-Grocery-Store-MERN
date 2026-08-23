import express from 'express';
import { register, login, isAuth, logout, updateName, changePassword, updateProfileImage } from '../controllers/userController.js';
import authUser from '../middlewares/authUser.js';
import { upload } from '../configs/multer.js';

import authorizeRoles from '../middlewares/authorizeRoles.js';

const userRouter = express.Router();


userRouter.get(
  '/staff-test',
  authUser,
  authorizeRoles('staff'),
  (req, res) => res.json({ success: true, role: req.userRole })
);

userRouter.post('/register', register);
userRouter.post('/login', login);
userRouter.get('/is-auth', authUser, isAuth);
userRouter.put('/profile/name', authUser, updateName);
userRouter.put('/profile/password', authUser, changePassword);
userRouter.put('/profile/image', authUser, upload.single('image'), updateProfileImage);
userRouter.get('/logout', logout);


export default userRouter;
