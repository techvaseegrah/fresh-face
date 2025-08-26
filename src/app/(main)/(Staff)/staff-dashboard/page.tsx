'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
// --- MODIFIED: Imported Variants type from framer-motion ---
import { motion, Variants } from 'framer-motion';
import { 
    Loader2, 
    Wallet, 
    CalendarCheck, 
    BarChart2, 
    IndianRupee, 
    FileText, 
    AlertCircle, 
    Clock, 
    Target, 
    Gift, 
    Calendar as CalendarIcon, 
    Users, 
    Scissors,
    CheckCircle2
} from 'lucide-react';

// --- (The StatCard component remains unchanged) ---
const StatCard = ({ icon, title, value, subtext }: { icon: React.ReactNode, title: string, value: string | number, subtext: string }) => {
    const formatDuration = (minutes: number): string => {
        if (isNaN(minutes) || minutes < 0) return "0h 0m";
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    if (title === "Monthly Hours") {
        const [achieved, required] = (value as string).split('/').map(Number);
        return (
            <div className="bg-white p-5 rounded-xl shadow-sm border">
                <div className="flex items-center gap-4 mb-2">
                    <div className="flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">{icon}</div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">{title}</p>
                        <p className="text-xl font-bold text-gray-800">{formatDuration(achieved)} / <span className="text-gray-500">{formatDuration(required)}</span></p>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${required > 0 ? (achieved / required) * 100 : 0}%` }}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-600">{icon}</div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{subtext}</p>
            </div>
        </div>
    );
};


export default function StaffDashboardPage() {
    const { data: session, status } = useSession();
    const [dashboardData, setDashboardData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!session?.user?.tenantId) {
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/stafflogin-dashboard', {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-tenant-id': session.user.tenantId, 
                    },
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Failed to load dashboard data');
                }
                const data = await res.json();
                setDashboardData(data.data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (status === 'authenticated') {
            fetchData();
        }
    }, [status, session]); 

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
        return <div className="text-red-600 bg-red-50 p-4 rounded-md flex items-center gap-2"><AlertCircle/> {error}</div>;
    }

    // --- MODIFIED: Explicitly typed the variants object ---
    const cardVariants: Variants = {
        hover: {
            scale: 1.03,
            transition: {
                type: "spring",
                stiffness: 300,
            }
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    Welcome back, {session?.user?.name}! 
                    <motion.span
                        animate={{ rotate: [0, 15, -10, 15, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                        style={{ display: 'inline-block' }}
                    >
                        👋
                    </motion.span>
                </h1>
                <p className="mt-1 text-md text-gray-600">Here's an overview of your activity this month.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard 
                        icon={<CalendarIcon size={24}/>} 
                        title="Today's Appointments" 
                        value={dashboardData?.todaysAppointments?.length || 0} 
                        subtext="Upcoming services today" 
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard 
                        icon={<Clock size={24}/>} 
                        title="Today's Shift" 
                        value={dashboardData?.attendance?.todayShift || "N/A"} 
                        subtext="Current scheduled shift" 
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard 
                        icon={<Target size={24}/>} 
                        title="Performance" 
                        value={`₹${dashboardData?.performance?.totalSales?.toLocaleString() || 0}`}
                        subtext={`${dashboardData?.performance?.customerCount || 0} customers served`}
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard 
                        icon={<Gift size={24}/>} 
                        title="Incentive Earned" 
                        value={`₹${dashboardData?.incentives?.totalEarned?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || 0}`}
                        subtext="Total for this month" 
                    />
                </motion.div>
            </div>
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <motion.div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border" variants={cardVariants} whileHover="hover">
                    <div className="flex justify-between items-center mb-4">
                         <h2 className="text-xl font-semibold flex items-center gap-2"><CalendarCheck/> Today's Schedule</h2>
                         <Link href="/my-appointments" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                            View All
                         </Link>
                    </div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {dashboardData?.todaysAppointments?.length > 0 ? (
                            dashboardData.todaysAppointments.map((apt: any) => (
                                <motion.div key={apt._id} className="p-4 bg-indigo-50/70 border-l-4 border-indigo-400 rounded-r-lg" whileHover={{ backgroundColor: "#e0e7ff" }}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-800">{apt.customerName}</p>
                                            <p className="text-xs text-gray-500 line-clamp-1">{apt.services}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-semibold text-indigo-700">{apt.time}</p>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${apt.status === 'Appointment' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{apt.status}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 py-10">
                                <Scissors className="mx-auto h-12 w-12 text-gray-300" />
                                <p className="mt-2 font-medium">No appointments today.</p>
                                <p className="text-sm">Your schedule is clear!</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                <div className="lg:col-span-2 grid grid-cols-1 gap-8">
                    <motion.div variants={cardVariants} whileHover="hover">
                        <StatCard 
                            icon={<Users size={24}/>} 
                            title="Monthly Hours" 
                            value={`${dashboardData?.attendance?.achievedMinutes || 0}/${dashboardData?.attendance?.requiredMinutes || 0}`}
                            subtext="Achieved vs. Target hours for the month" 
                        />
                    </motion.div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <motion.div className="bg-white p-6 rounded-xl shadow-sm border" variants={cardVariants} whileHover="hover">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Wallet/> Advance History</h2>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                               {dashboardData?.advances?.history?.length === 0 ? <p className="text-center text-gray-500 py-10">No advance requests found.</p> :
                                    dashboardData?.advances?.history.map((adv: any) => (
                                        <motion.div key={adv._id} className="p-3 bg-gray-50 rounded-md" whileHover={{ backgroundColor: "#f3f4f6" }}>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold">₹{adv.amount.toLocaleString()}</span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${adv.status === 'approved' ? 'bg-green-100 text-green-800' : adv.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{adv.status}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{new Date(adv.requestDate).toLocaleDateString()}</p>
                                        </motion.div>
                                    ))
                                }
                            </div>
                        </motion.div>

                        <motion.div className="bg-white p-6 rounded-xl shadow-sm border" variants={cardVariants} whileHover="hover">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><FileText/> Salary History</h2>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                               {dashboardData?.salaries?.length === 0 ? <p className="text-center text-gray-500 py-10">No salary records found.</p> :
                                    dashboardData?.salaries.map((sal: any) => (
                                        <motion.div key={sal._id} className="p-3 bg-gray-50 rounded-md" whileHover={{ backgroundColor: "#f3f4f6" }}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">{sal.month.name} {sal.year}</p>
                                                    {sal.isPaid && sal.paidDate ? (
                                                        <div className="flex items-center gap-1 text-xs text-green-600">
                                                            <CheckCircle2 size={12} />
                                                            <span>Paid on {new Date(sal.paidDate).toLocaleDateString()}</span>
                                                        </div>
                                                    ) : (
                                                        <p className={`text-xs ${sal.isPaid ? 'text-green-600' : 'text-orange-500'}`}>
                                                            {sal.isPaid ? 'Paid' : 'Processed'}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="font-bold text-lg">₹{sal.netSalary.toLocaleString()}</span>
                                            </div>
                                        </motion.div>
                                    ))
                               }
                            </div>
                        </motion.div>
                     </div>
                </div>
            </div>
        </div>
    );
}