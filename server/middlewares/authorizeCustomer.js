import User from '../models/User.js';

const authorizeCustomer = async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).select('role');
        if (!user || (user.role || 'customer') !== 'customer') {
            return res.status(403).json({success: false, message: 'Staff accounts cannot purchase products'});
        }
        next();
    } catch (error) {
        res.status(500).json({success: false, message: 'Unable to authorize customer'});
    }
};

export default authorizeCustomer;
