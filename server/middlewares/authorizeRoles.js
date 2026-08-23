import User from '../models/User.js';

const authorizeRoles = (...allowedRoles) => async (req, res, next) => {
    try {
        if (!req.userId) {
            return res.status(401).json({success: false, message: 'Not Authorized'});
        }

        const user = await User.findById(req.userId).select('role');
        if (!user || !allowedRoles.includes(user.role || 'customer')) {
            return res.status(403).json({success: false, message: 'Forbidden'});
        }

        req.userRole = user.role || 'customer';
        next();
    } catch (error) {
        res.status(500).json({success: false, message: 'Unable to authorize user'});
    }
};

export default authorizeRoles;