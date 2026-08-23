import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets.js'
import { useAppContext } from '../context/AppContext.jsx'
import toast from 'react-hot-toast'

function Profile() {
    const { user, setUser, axios, navigate, fetchUser } = useAppContext();
    const [name, setName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewImage, setPreviewImage] = useState('');
    const [loadingAction, setLoadingAction] = useState('');

    useEffect(() => {
        if(user){
            setName(user.name || '');
            setPreviewImage(user.profileImage || '');
        }
    }, [user]);

    useEffect(() => {
        if(user === null){
            navigate('/');
        }
    }, [user, navigate]);

    const updateLocalUser = (updatedUser) => {
        setUser(updatedUser);
        setName(updatedUser.name || '');
        setPreviewImage(updatedUser.profileImage || '');
    }

    const handleNameSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if(trimmedName.length < 2 || trimmedName.length > 50){
            return toast.error('Name must be 2 to 50 characters');
        }

        try {
            setLoadingAction('name');
            const { data } = await axios.put('/api/user/profile/name', {name: trimmedName});
            if(data.success){
                updateLocalUser(data.user);
                toast.success(data.message);
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoadingAction('');
        }
    }

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if(newPassword.length < 6){
            return toast.error('New password must be at least 6 characters');
        }
        if(newPassword !== confirmPassword){
            return toast.error('New passwords do not match');
        }

        try {
            setLoadingAction('password');
            const { data } = await axios.put('/api/user/profile/password', {
                currentPassword,
                newPassword
            });
            if(data.success){
                toast.success(data.message);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoadingAction('');
        }
    }

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if(!file){
            return;
        }
        if(!file.type.startsWith('image/')){
            return toast.error('Please select an image file');
        }
        setSelectedImage(file);
        setPreviewImage(URL.createObjectURL(file));
    }

    const handleImageSubmit = async (e) => {
        e.preventDefault();
        if(!selectedImage){
            return toast.error('Please choose a profile image');
        }

        try {
            setLoadingAction('image');
            const formData = new FormData();
            formData.append('image', selectedImage);
            const { data } = await axios.put('/api/user/profile/image', formData);
            if(data.success){
                updateLocalUser(data.user);
                setSelectedImage(null);
                await fetchUser();
                toast.success(data.message);
            }else{
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoadingAction('');
        }
    }

    if(!user){
        return (
            <div className='flex items-center justify-center min-h-[50vh]'>
                <p className='text-gray-500'>Loading profile...</p>
            </div>
        )
    }

    return (
        <div className='mt-10 pb-12 max-w-5xl'>
            <div className='flex flex-col items-end w-max mb-8'>
                <p className='text-2xl font-medium uppercase'>My Profile</p>
                <div className='w-16 h-0.5 bg-primary-dull rounded-full'></div>
            </div>

            <div className='grid lg:grid-cols-[320px_1fr] gap-6'>
                <form onSubmit={handleImageSubmit} className='border border-gray-300 rounded-md p-5 h-max'>
                    <p className='text-lg font-medium mb-4'>Profile Picture</p>
                    <div className='flex flex-col items-center gap-4'>
                        <img
                            src={previewImage || assets.profile_icon}
                            alt='profile'
                            className='w-32 h-32 rounded-full object-cover border border-gray-300 bg-gray-100'
                        />
                        <label className='w-full text-center cursor-pointer border border-gray-300 rounded px-4 py-2 hover:border-primary transition'>
                            Choose Image
                            <input type='file' accept='image/*' onChange={handleImageChange} hidden />
                        </label>
                        <button
                            disabled={loadingAction === 'image'}
                            className='w-full bg-primary text-white py-2 rounded hover:bg-primary-dull transition disabled:opacity-60 cursor-pointer'
                        >
                            {loadingAction === 'image' ? 'Uploading...' : 'Update Picture'}
                        </button>
                    </div>
                </form>

                <div className='space-y-6'>
                    <form onSubmit={handleNameSubmit} className='border border-gray-300 rounded-md p-5'>
                        <p className='text-lg font-medium mb-4'>Account Details</p>
                        <div className='grid md:grid-cols-2 gap-4'>
                            <div>
                                <label className='text-sm text-gray-600'>Name</label>
                                <input
                                    type='text'
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className='w-full mt-1 px-3 py-2 border border-gray-300 rounded outline-primary'
                                    required
                                />
                            </div>
                            <div>
                                <label className='text-sm text-gray-600'>Email</label>
                                <input
                                    type='email'
                                    value={user.email}
                                    disabled
                                    className='w-full mt-1 px-3 py-2 border border-gray-200 rounded bg-gray-100 text-gray-500'
                                />
                            </div>
                        </div>
                        <button
                            disabled={loadingAction === 'name'}
                            className='mt-5 px-6 py-2 bg-primary text-white rounded hover:bg-primary-dull transition disabled:opacity-60 cursor-pointer'
                        >
                            {loadingAction === 'name' ? 'Saving...' : 'Save Name'}
                        </button>
                    </form>

                    <form onSubmit={handlePasswordSubmit} className='border border-gray-300 rounded-md p-5'>
                        <p className='text-lg font-medium mb-4'>Change Password</p>
                        <div className='grid md:grid-cols-3 gap-4'>
                            <div>
                                <label className='text-sm text-gray-600'>Current Password</label>
                                <input
                                    type='password'
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className='w-full mt-1 px-3 py-2 border border-gray-300 rounded outline-primary'
                                    required
                                />
                            </div>
                            <div>
                                <label className='text-sm text-gray-600'>New Password</label>
                                <input
                                    type='password'
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className='w-full mt-1 px-3 py-2 border border-gray-300 rounded outline-primary'
                                    required
                                />
                            </div>
                            <div>
                                <label className='text-sm text-gray-600'>Confirm New Password</label>
                                <input
                                    type='password'
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className='w-full mt-1 px-3 py-2 border border-gray-300 rounded outline-primary'
                                    required
                                />
                            </div>
                        </div>
                        <button
                            disabled={loadingAction === 'password'}
                            className='mt-5 px-6 py-2 bg-primary text-white rounded hover:bg-primary-dull transition disabled:opacity-60 cursor-pointer'
                        >
                            {loadingAction === 'password' ? 'Updating...' : 'Change Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Profile
