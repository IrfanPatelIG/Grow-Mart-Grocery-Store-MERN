import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Seller Login : /api/seller/login
export const sellerLogin = async (req, res) => {
    try{
        const { email, password } = req.body;
        if(password === process.env.SELLER_PASSWORD && email === process.env.SELLER_EMAIL){
            const token = jwt.sign({email}, process.env.JWT_SECRET, {expiresIn: '7d'});
            res.cookie('sellerToken', token, {
                httpOnly: true,  
                secure: process.env.NODE_ENV === 'production', 
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
                maxAge: 7 * 24 * 60 * 60 * 1000, 
            });
            return res.json({success: true, message: "Logged In!"});
        }
        else{
            return res.json({success: false, message: "Invalid Credentials!"});
        }
    }catch(error){
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

// Check Seller Auth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
    try {
        return res.json({success: true});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message}); 
    }
}

// Check Seller Logout : /api/seller/logout
export  const sellerLogout = async (req, res) => {
    try {
        res.clearCookie('sellerToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        return res.json({success: true, message: 'Admin Logged Out!'});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

// List database staff users : /api/seller/staff
export const listStaff = async (req, res) => {
    try {
        const staff = await User.find({role: 'staff'}).select('_id name email role').sort({name: 1});
        return res.json({success: true, staff});
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({success: false, message: 'Unable to fetch staff'});
    }
};

// Demote a staff user to customer : /api/seller/staff/:id/demote
export const demoteStaff = async (req, res) => {
    try {
        const staff = await User.findOneAndUpdate(
            {_id: req.params.id, role: 'staff'},
            {role: 'customer'},
            {new: true}
        ).select('_id name email role');
        if (!staff) {
            return res.status(404).json({success: false, message: 'Staff user not found'});
        }
        return res.json({success: true, message: 'Staff user demoted to customer', user: staff});
    } catch (error) {
        console.log(error.message);
        return res.status(400).json({success: false, message: 'Unable to demote staff user'});
    }
};
