import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext.jsx'
import { dummyOrders } from '../assets/assets.js';
import toast from 'react-hot-toast';

const deliverySteps = ['Order Placed', 'Processing', 'Out for Delivery', 'Delivered'];
const pickupSteps = ['Order Placed', 'Processing', 'Ready for Pickup', 'Picked Up'];
const orderStatuses = ['Order Placed', 'Processing', 'Ready for Pickup', 'Picked Up', 'Out for Delivery', 'Delivered', 'Cancelled'];

function MyOrders() {
    const [myOrders, setMyOrders] = useState([]);
    const { currency, axios, user, products } = useAppContext();
    const [returnRequests, setReturnRequests] = useState([]);
    const [requestForm, setRequestForm] = useState(null);
    const [paymentRequest, setPaymentRequest] = useState(null);
    const [showPaymentPopup, setShowPaymentPopup] = useState(false);
    const cancellableStatuses = ['Order Placed', 'Processing', 'Ready for Pickup', 'Out for Delivery'];
    const [sortOption, setSortOption] = useState('newest');
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchMyOrders = async () => {
        try {
            const { data } = await axios.get('/api/order/user');
            if(data.success){
                setMyOrders(data.orders);
            }
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        if(user){
            fetchMyOrders();
            axios.get('/api/returns/user').then(({data}) => {
                if (data.success) setReturnRequests(data.requests);
            }).catch(() => {});
            const refreshTimer = setInterval(fetchMyOrders, 10000);
            return () => clearInterval(refreshTimer);
        }
    },[user]);

    const submitReturnRequest = async (event) => {
        event.preventDefault();
        try {
            const {data} = await axios.post('/api/returns', requestForm);
            if (!data.success) throw new Error(data.message);
            setReturnRequests((currentRequests) => [data.request, ...currentRequests]);
            setRequestForm(null);
            if (data.request.additionalAmount > 0) {
                setPaymentRequest(data.request);
                toast('Please confirm the additional exchange payment');
            } else {
                toast.success(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const startExchangePayment = () => {
        setShowPaymentPopup(true);
    };

    const confirmExchangePayment = async () => {
        try {
            const {data} = await axios.post(`/api/returns/${paymentRequest._id}/payment`);
            if (!data.success) throw new Error(data.message);
            setReturnRequests((currentRequests) => currentRequests.map((request) => (
                request._id === paymentRequest._id ? {...request, status: 'pending', paymentConfirmed: true} : request
            )));
            setPaymentRequest(null);
            setShowPaymentPopup(false);
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const cancelOrder = async (orderId) => {
        if (!window.confirm('Cancel this order?')) return;
        try {
            const { data } = await axios.post(`/api/order/${orderId}/cancel`);
            if (!data.success) throw new Error(data.message);
            setMyOrders((currentOrders) => currentOrders.map((order) => (
                order._id === orderId ? {...order, status: 'Cancelled'} : order
            )));
            toast.success('Order cancelled');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const confirmPayment = async (orderId) => {
        try {
            const { data } = await axios.post(`/api/order/${orderId}/confirm-payment`);
            if (!data.success) throw new Error(data.message);
            setMyOrders((currentOrders) => currentOrders.map((order) => (
                order._id === orderId ? {...order, isPaid: true, paymentConfirmedByCustomer: true} : order
            )));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const confirmPickup = async (orderId) => {
        try {
            const { data } = await axios.post(`/api/order/${orderId}/confirm-pickup`);
            if (!data.success) throw new Error(data.message);
            setMyOrders((currentOrders) => currentOrders.map((order) => (
                order._id === orderId ? {...order, status: 'Picked Up'} : order
            )));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

  return (
    <div className='mt-8 pb-8'>
        <div className='flex flex-col items-end w-max mb-8'>
            <p className='text-2xl font-medium uppercase'>My Orders</p>
            <div className='w-16 h-0.5 bg-primary-dull rounded-full'></div>
        </div>
        <div className='mb-5 flex flex-wrap items-center justify-between gap-3 max-w-4xl'>
            <p className='text-sm text-gray-500'>Filter and sort orders</p>
            <div className='flex flex-wrap gap-2'>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className='rounded border border-gray-300 px-3 py-2 text-sm outline-none'>
                <option value='All'>All statuses</option>
                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className='rounded border border-gray-300 px-3 py-2 text-sm outline-none'>
                <option value='newest'>Newest first</option>
                <option value='oldest'>Oldest first</option>
                <option value='amount-high'>Highest amount</option>
                <option value='amount-low'>Lowest amount</option>
            </select>
            </div>
        </div>
        {[...myOrders].filter((order) => statusFilter === 'All' || (order.status || 'Order Placed') === statusFilter).sort((firstOrder, secondOrder) => {
            if (sortOption === 'oldest') return new Date(firstOrder.createdAt) - new Date(secondOrder.createdAt);
            if (sortOption === 'amount-high') return secondOrder.amount - firstOrder.amount;
            if (sortOption === 'amount-low') return firstOrder.amount - secondOrder.amount;
            return new Date(secondOrder.createdAt) - new Date(firstOrder.createdAt);
        }).map((order) => (
            <div key={order._id} className='border border-gray-300 rounded-lg mb-10 p-4 py-5 max-w-4xl'>
                <p className='flex justify-between md:items-center text-gray-400 md:font-medium max-md:flex-col'>
                    <span>OrderId: {order._id}</span>
                    <span>Payment: {order.paymentType}</span>
                    <span>Total Amount: {currency}{order.amount}</span>
                </p>
                <div className='mt-4 rounded bg-gray-50 p-4 text-sm'>
                    <p className='font-medium text-gray-800'>Fulfillment: {order.fulfillmentMethod === 'pickup' ? 'Store Pickup' : 'Home Delivery'}</p>
                    {order.pickupDate && <p className='text-gray-500'>Pickup date: {new Date(order.pickupDate).toLocaleDateString()}</p>}
                    <div className='mt-4 grid grid-cols-5 gap-1'>
                        {(order.fulfillmentMethod === 'pickup' ? pickupSteps : deliverySteps).map((step, stepIndex, steps) => {
                            const currentIndex = order.status === 'Cancelled' ? -1 : steps.indexOf(order.status);
                            const isComplete = currentIndex >= stepIndex;
                            return <div key={step} className='text-center'>
                                <div className={`mx-auto h-3 w-3 rounded-full ${isComplete ? 'bg-primary-dull' : 'bg-gray-300'}`}></div>
                                <p className={`mt-1 text-[10px] ${isComplete ? 'text-gray-800' : 'text-gray-400'}`}>{step}</p>
                            </div>;
                        })}
                    </div>
                    {order.status === 'Cancelled' && <p className='mt-2 font-medium text-red-600'>Order cancelled</p>}
                    {order.paymentType === 'COD' && !order.isPaid && order.status !== 'Cancelled' && <button onClick={() => confirmPayment(order._id)} className='mt-3 rounded bg-primary px-3 py-1 text-white'>Confirm payment</button>}
                    {order.fulfillmentMethod === 'pickup' && order.status === 'Ready for Pickup' && order.isPaid && <button onClick={() => confirmPickup(order._id)} className='mt-3 rounded bg-primary px-3 py-1 text-white'>Confirm pickup</button>}
                    {cancellableStatuses.includes(order.status) && <button onClick={() => cancelOrder(order._id)} className='mt-3 rounded border border-red-300 px-3 py-1 text-red-600'>Cancel order</button>}
                </div>
                {order.items.map((item, index) => (
                    <div key={index} className={`relative bg-white text-gray-500/70 
                    ${order.items.length !== index + 1 && "border-b"} border-gray-300 flex flex-col 
                    md:flex-row md:items-center justify-between p-4 py-5 md:gap-16 w-full max-w-4xl`}>
                        <div className='flex items-center mb-4 md:mb-0'>
                            <div className='bg-primary/10 p-4 rounded-lg'>
                                {item.product?.images?.[0] && <img src={item.product.images[0]} alt="" className='w-16 h-16' />}
                            </div>
                            <div className='ml-4'>
                                <h2 className='text-xl font-medium text-gray-800'>{item.product?.name || 'Product no longer listed'}</h2>
                                <p>Category: {item.product?.category || 'Unavailable'}</p>
                            </div>
                        </div>
                        <div className='flex flex-col justify-center md:ml-8 mb-4 md:mb-0'>
                            <p>Quantity: {item.quantity || "1"}</p>
                            <p>Status: {order.status}</p>
                            <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <p className='text-primary-dull text-lg font-medium'>
                            Amount: {item.product ? `${currency}${item.product.offerPrice * item.quantity}` : 'Unavailable'}
                        </p>
                        {['Delivered', 'Picked Up'].includes(order.status) && item.product && !returnRequests.some((request) => request.orderId?._id === order._id && request.productId?._id === item.product._id) && <button onClick={() => setRequestForm({orderId: order._id, productId: item.product._id, quantity: item.quantity, type: 'return', replacementProductId: '', reason: ''})} className='rounded border border-primary px-3 py-1 text-primary-dull'>Return / Exchange</button>}
                    </div>
                ))}
                {requestForm?.orderId === order._id && <form onSubmit={submitReturnRequest} className='mt-3 space-y-2 rounded bg-gray-50 p-3 text-sm'>
                    <select value={requestForm.type} onChange={(event) => setRequestForm({...requestForm, type: event.target.value})} className='rounded border border-gray-300 px-2 py-1'>
                        <option value='return'>Return</option><option value='exchange'>Exchange</option>
                    </select>
                    {requestForm.type === 'exchange' && <select required value={requestForm.replacementProductId} onChange={(event) => setRequestForm({...requestForm, replacementProductId: event.target.value})} className='ml-2 rounded border border-gray-300 px-2 py-1'>
                        <option value=''>Replacement product</option>
                        {products.filter((product) => product.inStock).map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}
                    </select>}
                    {requestForm.type === 'exchange' && requestForm.replacementProductId && (() => {
                        const originalProduct = products.find((product) => product._id === requestForm.productId);
                        const replacementProduct = products.find((product) => product._id === requestForm.replacementProductId);
                        const originalAmount = (originalProduct?.offerPrice || 0) * requestForm.quantity;
                        const replacementAmount = (replacementProduct?.offerPrice || 0) * requestForm.quantity;
                        return <div className='mt-2 rounded border border-gray-200 bg-white p-2'>
                            <p>Previously paid: {currency}{originalAmount.toFixed(2)}</p>
                            <p>Replacement total: {currency}{replacementAmount.toFixed(2)}</p>
                            <p className='font-medium'>Additional payment: {currency}{Math.max(replacementAmount - originalAmount, 0).toFixed(2)}</p>
                        </div>;
                    })()}
                    <input required value={requestForm.reason} onChange={(event) => setRequestForm({...requestForm, reason: event.target.value})} placeholder='Reason' className='ml-2 rounded border border-gray-300 px-2 py-1' />
                    <button type='submit' className='ml-2 rounded bg-primary px-3 py-1 text-white'>Submit</button>
                    <button type='button' onClick={() => setRequestForm(null)} className='ml-2 rounded border px-3 py-1'>Cancel</button>
                </form>}
                {paymentRequest?.orderId?._id === order._id && <div className='mt-3 rounded border border-primary bg-primary/5 p-3 text-sm'>
                    <p className='font-medium'>Exchange payment breakdown</p>
                    <p>Previously paid: {currency}{paymentRequest.originalAmount.toFixed(2)}</p>
                    <p>Replacement total: {currency}{paymentRequest.replacementAmount.toFixed(2)}</p>
                    <p className='font-medium'>Pay now: {currency}{paymentRequest.additionalAmount.toFixed(2)}</p>
                    <button onClick={startExchangePayment} className='mt-2 rounded bg-primary px-3 py-1 text-white'>Pay difference and submit exchange</button>
                </div>}
            </div>
        ))}
        {showPaymentPopup && paymentRequest && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
            <div className='w-full max-w-sm rounded-lg bg-white p-6 shadow-xl'>
                <h2 className='text-lg font-medium'>Confirm dummy payment</h2>
                <p className='mt-3 text-sm text-gray-600'>Additional exchange amount</p>
                <p className='text-2xl font-semibold'>{currency}{paymentRequest.additionalAmount.toFixed(2)}</p>
                <p className='mt-2 text-sm text-gray-500'>This local test payment does not open Stripe.</p>
                <div className='mt-5 flex gap-2'>
                    <button onClick={confirmExchangePayment} className='rounded bg-primary px-3 py-2 text-white'>Confirm payment</button>
                    <button onClick={() => setShowPaymentPopup(false)} className='rounded border px-3 py-2'>Cancel</button>
                </div>
            </div>
        </div>}
    </div>
  )
}

export default MyOrders;