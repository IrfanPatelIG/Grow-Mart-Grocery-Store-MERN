import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../../context/AppContext.jsx';

function ReturnRequests({staffOnly = false}) {
  const { axios } = useAppContext();
  const apiBase = staffOnly ? '/api/returns/staff' : '/api/returns/admin';
  const reviewSuffix = staffOnly ? 'staff-review' : 'admin-review';
  const reminderSuffix = staffOnly ? 'staff-remind-payment' : 'admin-remind-payment';
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const {data} = await axios.get(apiBase);
      if (!data.success) throw new Error(data.message);
      setRequests(data.requests);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const timer = setInterval(fetchRequests, 10000);
    return () => clearInterval(timer);
  }, [apiBase]);

  const reviewRequest = async (requestId, status) => {
    try {
      const {data} = await axios.patch(`/api/returns/${requestId}/${reviewSuffix}`, {status});
      if (!data.success) throw new Error(data.message);
      setRequests((currentRequests) => currentRequests.map((request) => (
        request._id === requestId ? {...request, status} : request
      )));
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const remindPayment = async (requestId) => {
    try {
      const {data} = await axios.patch(`/api/returns/${requestId}/${reminderSuffix}`);
      if (!data.success) throw new Error(data.message);
      setRequests((currentRequests) => currentRequests.map((request) => (
        request._id === requestId ? data.request : request
      )));
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  return <main className='no-scrollbar flex-1 overflow-y-scroll p-4 md:p-10'>
    <div className='max-w-5xl space-y-4'>
      <h2 className='text-lg font-medium'>Return and Exchange Requests</h2>
      <div className='divide-y divide-gray-100 rounded-md border border-gray-200 bg-white'>
        {isLoading ? <p className='p-5 text-sm text-gray-500'>Loading requests...</p> : requests.length === 0 ? <p className='p-5 text-sm text-gray-500'>No requests found.</p> : requests.map((request) => (
          <div key={request._id} className='flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between'>
            <div>
              <p className='font-medium'>{request.type === 'exchange' ? 'Exchange' : 'Return'}: {request.productId?.name || 'Product unavailable'}</p>
              <p className='text-sm text-gray-500'>Customer: {request.userId?.name || request.userId?.email || 'Unknown'} | Quantity: {request.quantity}</p>
              <p className='text-sm text-gray-500'>Reason: {request.reason}</p>
              {request.type === 'exchange' && <p className='text-sm text-gray-500'>Payment difference: {request.additionalAmount > 0 ? request.additionalAmount : 0} ({request.paymentConfirmed ? 'Paid' : 'Not paid'})</p>}
              <p className='text-sm text-gray-500'>Status: {request.status}</p>
            </div>
            {request.status === 'awaiting_payment' && <button type='button' onClick={() => remindPayment(request._id)} className='rounded border border-primary px-3 py-2 text-sm text-primary-dull'>Resend payment request</button>}
            {request.status === 'pending' && <div className='flex gap-2'>
              <button type='button' onClick={() => reviewRequest(request._id, 'approved')} className='rounded bg-primary px-3 py-2 text-sm text-white'>Approve</button>
              <button type='button' onClick={() => reviewRequest(request._id, 'rejected')} className='rounded border border-red-300 px-3 py-2 text-sm text-red-600'>Reject</button>
            </div>}
          </div>
        ))}
      </div>
    </div>
  </main>;
}

export default ReturnRequests;
