import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authStaffOrSeller = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
        const { sellerToken, userToken } = req.cookies;

        if (bearerToken) {
            const user = jwt.verify(bearerToken, process.env.JWT_SECRET);
            const databaseUser = await User.findById(user.id).select('role');
            if (databaseUser?.role === 'staff') {
                req.userId = user.id;
                req.userRole = databaseUser.role;
                return next();
            }
            return res.status(403).json({success: false, message: 'Forbidden'});
        }

        if (sellerToken) {
            try {
                const seller = jwt.verify(sellerToken, process.env.JWT_SECRET);
                if (seller.email === process.env.SELLER_EMAIL) {
                    req.userRole = 'admin';
                    return next();
                }
            } catch (sellerError) {
                // Fall through so a valid staff user token can still authenticate.
            }
        }

        if (userToken) {
            try {
                const user = jwt.verify(userToken, process.env.JWT_SECRET);
                const databaseUser = await User.findById(user.id).select('role');
                if (databaseUser && databaseUser.role === 'staff') {
                    req.userId = user.id;
                    req.userRole = databaseUser.role;
                    return next();
                }
            } catch (userError) {
                return res.status(401).json({success: false, message: 'Not Authorized'});
            }
        }

        return res.status(403).json({success: false, message: 'Forbidden'});
    } catch (error) {
        return res.status(401).json({success: false, message: 'Not Authorized'});
    }
};

export default authStaffOrSeller;