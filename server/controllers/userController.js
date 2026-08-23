import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';

const getSafeUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role || 'customer',
    profileImage: user.profileImage || "",
    cartItems: user.cartItems || {}
});

const isValidName = (name) => {
    const trimmedName = name?.trim();
    return trimmedName && trimmedName.length >= 2 && trimmedName.length <= 50;
};

const isValidPassword = (password) => {
    return typeof password === "string" && password.length >= 6;
};

// Register User : /api/user/register
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if(!name || !email || !password){
            return res.json({success: false, message: 'Missing Details'});
        }
        if(!isValidName(name)){
            return res.status(400).json({success: false, message: "Name must be 2 to 50 characters"});
        }
        if(!isValidPassword(password)){
            return res.status(400).json({success: false, message: "Password must be at least 6 characters"});
        }
        
        const existingUser = await User.findOne({email: email.toLowerCase().trim()});
        if(existingUser)
            return res.json({success: false, message: "User Already Exists"});
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });
        
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});

        res.cookie('userToken', token, {
            httpOnly: true,  // Prevent JavaScript to access cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CSRF Production
            maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie expiration time
            path: '/'
        })
        return res.json({success: true, token, user: getSafeUser(user)});
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to register user"});
    }
}

// Login User : /api/user/login

export const login = async (req, res) => {
    try {
        const {email, password} = req.body;
        if(!email || !password){
            return res.json({success: false, message: "Email and Password are required"});
        }
        const user = await User.findOne({email: email.toLowerCase().trim()});
        if(!user){
            return res.json({success: false, message: "Invalid Email or Password"});
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch)
            return res.json({success: false, message: "Invalid Email or Password"});

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '7d'});
        res.cookie('userToken', token, {
            httpOnly: true,  
            secure: process.env.NODE_ENV === 'production', 
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/' 
        });
        return res.json({success: true, token, user: getSafeUser(user)});

    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to login"});       
    }
}

// Check Auth : /api/user/is-auth
export const isAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({success: true, user});
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to fetch user"}); 
    }
}

// Update User Name : /api/user/profile/name
export const updateName = async (req, res) => {
    try {
        const { name } = req.body;
        if(!isValidName(name)){
            return res.status(400).json({success: false, message: "Name must be 2 to 50 characters"});
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            {name: name.trim()},
            {new: true}
        ).select("-password");

        if(!user){
            return res.status(404).json({success: false, message: "User not found"});
        }

        return res.json({success: true, message: "Name updated", user});
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to update name"});
    }
}

// Change User Password : /api/user/profile/password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if(!currentPassword || !newPassword){
            return res.status(400).json({success: false, message: "Current and new password are required"});
        }
        if(!isValidPassword(newPassword)){
            return res.status(400).json({success: false, message: "New password must be at least 6 characters"});
        }

        const user = await User.findById(req.userId);
        if(!user){
            return res.status(404).json({success: false, message: "User not found"});
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if(!isMatch){
            return res.status(400).json({success: false, message: "Current password is incorrect"});
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.json({success: true, message: "Password changed successfully"});
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to change password"});
    }
}

// Update Profile Image : /api/user/profile/image
export const updateProfileImage = async (req, res) => {
    try {
        if(!req.file){
            return res.status(400).json({success: false, message: "Profile image is required"});
        }

        const result = await cloudinary.uploader.upload(req.file.path, {resource_type: 'image'});
        const user = await User.findByIdAndUpdate(
            req.userId,
            {profileImage: result.secure_url},
            {new: true}
        ).select("-password");

        if(!user){
            return res.status(404).json({success: false, message: "User not found"});
        }

        return res.json({success: true, message: "Profile image updated", user});
    } catch (error) {
        console.log(error.message);
        res.status(500).json({success: false, message: "Unable to update profile image"});
    }
}

// Check User Logout : /api/user/logout
export  const logout = async (req, res) => {
    try {
        res.clearCookie('userToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/' 
        });
        return res.json({success: true, message: 'Logged Out!'});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message});
    }
}

