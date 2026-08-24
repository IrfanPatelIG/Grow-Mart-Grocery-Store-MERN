import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import connectDB from './configs/db.js';
import 'dotenv/config';
import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import connectCloudinary from './configs/cloudinary.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import orderRouter from './routes/orderRoute.js';
import returnRouter from './routes/returnRoute.js';
import { startAutomaticDeliveryScheduler, stripeWebhooks } from './controllers/orderController.js';

const app = express();

const port = process.env.PORT || 8000;
await connectDB();
await connectCloudinary();
startAutomaticDeliveryScheduler();

// Allow multiple origins
const allowedOrigins = [
    'http://localhost:5173',
    'https://grow-mart-grocery-store.vercel.app'
];
app.post('/stripe', express.raw({type: 'application/json'}), stripeWebhooks);

// Middleware Configuration
app.use(express.json()); 
app.use(cookieParser());
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin); // dynamically set origin
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});


app.get('/', (req, res) => res.send('API is working!'));
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/order', orderRouter);
app.use('/api/returns', returnRouter);

app.listen(port, "0.0.0.0", () => {
    console.log(`PORT connected on ${port}`);
})