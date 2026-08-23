import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext.jsx";

function StaffManagement() {
  const { axios } = useAppContext();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data } = await axios.get("/api/seller/staff");
        if (!data.success) {
          throw new Error(data.message);
        }
        setStaff(data.staff);
      } catch (error) {
        toast.error(error.response?.data?.message || error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaff();
  }, [axios]);

  const demoteStaff = async (staffId) => {
    if (!window.confirm("Demote this staff user to customer?")) {
      return;
    }
    try {
      const { data } = await axios.patch(`/api/seller/staff/${staffId}/demote`);
      if (!data.success) {
        throw new Error(data.message);
      }
      setStaff((currentStaff) => currentStaff.filter((user) => user._id !== staffId));
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-scroll p-4 md:p-10">
      <div className="max-w-4xl space-y-4">
        <h2 className="text-lg font-medium">Staff Management</h2>
        <div className="overflow-hidden rounded-md border border-gray-500/20 bg-white">
          {isLoading ? (
            <p className="p-5 text-sm text-gray-500">Loading staff...</p>
          ) : staff.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No staff users found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {staff.map((staffUser) => (
                <div key={staffUser._id} className="flex items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{staffUser.name}</p>
                    <p className="truncate text-sm text-gray-500">{staffUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => demoteStaff(staffUser._id)}
                    className="shrink-0 cursor-pointer rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                  >
                    Demote to customer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default StaffManagement;