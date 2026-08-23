import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { assets } from '../../assets/assets.js';
import toast from 'react-hot-toast';

function Orders() {
    const { currency, axios, isSeller } = useAppContext();
  const [orders, setOrders] = useState([]);
    const [sortOption, setSortOption] = useState('newest');
    const [statusFilter, setStatusFilter] = useState('All');
    const orderStatuses = ['Order Placed', 'Processing', 'Ready for Pickup', 'Picked Up', 'Out for Delivery', 'Delivered', 'Cancelled'];
    const nextStatuses = {
        'Order Placed': ['Processing', 'Cancelled'],
        'Processing': ['Ready for Pickup', 'Out for Delivery', 'Cancelled'],
        'Ready for Pickup': ['Cancelled'],
        'Out for Delivery': ['Delivered', 'Cancelled']
    };

  const fetchOrders = async () => {
    try{
        const { data } = await axios.get('/api/order/seller');
        if(data.success){
            setOrders(data.orders);
        }
        else{
            toast.error(data.message);
        }
    }
    catch(error){
        toast.error(error.message);
    }
  }

  useEffect(() => {
    fetchOrders();
        const refreshTimer = setInterval(fetchOrders, 10000);
        return () => clearInterval(refreshTimer);
  }, []);

    const updateStatus = async (order, status) => {
        try {
            const { data } = await axios.patch(`/api/order/${order._id}/status`, { status });
            if (!data.success) {
                throw new Error(data.message);
            }
            setOrders((currentOrders) => currentOrders.map((currentOrder) => (
                currentOrder._id === order._id ? {...currentOrder, status} : currentOrder
            )));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const toggleAutomaticDelivery = async (order) => {
        try {
            const { data } = await axios.patch(`/api/order/${order._id}/automatic-delivery`, {
                paused: !order.autoDeliveryPaused
            });
            if (!data.success) throw new Error(data.message);
            setOrders((currentOrders) => currentOrders.map((currentOrder) => (
                currentOrder._id === order._id ? data.order : currentOrder
            )));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

    const stopAutomaticDelivery = async (order) => {
        if (!window.confirm('Stop automatic delivery for this order permanently?')) return;
        try {
            const { data } = await axios.patch(`/api/order/${order._id}/automatic-delivery`, { action: 'stop' });
            if (!data.success) throw new Error(data.message);
            setOrders((currentOrders) => currentOrders.map((currentOrder) => (
                currentOrder._id === order._id ? data.order : currentOrder
            )));
            toast.success(data.message);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        }
    };

  return (
    <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll'>
        <div className="md:p-10 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Orders List</h2>
            <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm outline-none">
                <option value="All">All statuses</option>
                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm outline-none">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount-high">Highest amount</option>
                <option value="amount-low">Lowest amount</option>
            </select>
            </div>
            </div>
            {[...orders].filter((order) => statusFilter === 'All' || (order.status || 'Order Placed') === statusFilter).sort((firstOrder, secondOrder) => {
                if (sortOption === 'oldest') return new Date(firstOrder.createdAt) - new Date(secondOrder.createdAt);
                if (sortOption === 'amount-high') return secondOrder.amount - firstOrder.amount;
                if (sortOption === 'amount-low') return firstOrder.amount - secondOrder.amount;
                return new Date(secondOrder.createdAt) - new Date(firstOrder.createdAt);
            }).map((order) => (
                <div key={order._id} className="flex flex-col md:items-center md:flex-row gap-5 justify-between p-5 max-w-4xl rounded-md border border-gray-300">
                    <div className="flex gap-5 max-w-80">
                        <img className="w-12 h-12 object-cover" src={assets.box_icon} alt="boxIcon" />
                        <div>
                            {order.items.map((item, index) => (
                                <div key={index} className="flex flex-col">
                                    <p className="font-medium">
                                        {item.product?.name || "Product no longer listed"} {" "} <span className='text-primary'>x {item.quantity}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="text-sm md:text-base text-black/60">
                        {order.fulfillmentMethod === 'pickup' ? <p className='font-medium text-black/80'>Store Pickup</p> : <>
                        <p className='text-black/80'>{order.address?.firstName} {order.address?.lastName}</p>
                        <p>{order.address?.street}, {order.address?.city} </p>
                        <p>{order.address?.state}, {order.address?.zipcode}, {order.address?.country}</p>
                        <p></p>
                        <p>{order.address?.phone}</p>
                        </>}
                    </div>
                    <p className="font-medium text-lg my-auto">{currency}{order.amount}</p>
                    <div className="flex flex-col text-sm md:text-base text-black/60">
                        <p>Method: {order.paymentType}</p>
                        <p>Fulfillment: {order.fulfillmentMethod === 'pickup' ? 'Store pickup' : 'Delivery'}</p>
                        {order.pickupDate && <p>Pickup date: {new Date(order.pickupDate).toLocaleDateString()}</p>}
                        <p>Status: {order.status}</p>
                        <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                        <p>Payment: {order.isPaid ? "Paid" : "Pending"}</p>
                        {isSeller && order.autoDeliveryEnabled !== false && !['Delivered', 'Picked Up', 'Cancelled'].includes(order.status) && <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => toggleAutomaticDelivery(order)} className="rounded border border-gray-300 px-2 py-1 text-left">
                                {order.autoDeliveryPaused ? 'Resume automatic delivery' : 'Pause automatic delivery'}
                            </button>
                            <button type="button" onClick={() => stopAutomaticDelivery(order)} className="rounded border border-red-300 px-2 py-1 text-red-600">
                                Stop automatic delivery
                            </button>
                        </div>}
                        {!['Delivered', 'Picked Up', 'Cancelled'].includes(order.status) && <select value="" onChange={(event) => updateStatus(order, event.target.value)} className="mt-2 rounded border border-gray-300 bg-white px-2 py-1">
                            <option value="">Update status</option>
                            {(nextStatuses[order.status] || []).filter((status) => (
                                status !== 'Ready for Pickup' || order.fulfillmentMethod === 'pickup'
                            )).filter((status) => (
                                status !== 'Out for Delivery' || order.fulfillmentMethod !== 'pickup'
                            )).map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>}
                    </div>
                </div>
            ))}
        </div>
    </div>
  )
}

export default Orders
