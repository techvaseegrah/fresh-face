'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
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
    CheckCircle2,
    CalendarOff
} from 'lucide-react';


// --- StatCard component with updated progress bar color ---
const StatCard = ({ icon, title, value, subtext, gradient }: { icon: React.ReactNode, title: string, value: string | number, subtext: string, gradient: string }) => {
    const formatDuration = (minutes: number): string => {
        if (isNaN(minutes) || minutes < 0) return "0h 0m";
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    if (title === "Monthly Hours") {
        const [achieved, required] = (value as string).split('/').map(Number);
        const percentage = required > 0 ? (achieved / required) * 100 : 0;
        return (
            <div className="bg-white p-5 rounded-xl shadow-md border border-gray-100 h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                         <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${gradient} text-white`}>{icon}</div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">{title}</p>
                            <p className="text-xl font-bold text-gray-800">{formatDuration(achieved)} / <span className="text-gray-500">{formatDuration(required)}</span></p>
                        </div>
                    </div>
                </div>
                <div>
                     <p className="text-xs text-gray-400 mb-1">{subtext}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white p-5 rounded-xl shadow-md border border-gray-100 flex items-start gap-4 h-full`}>
            <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${gradient} text-white`}>{icon}</div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{title}</p>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-400">{subtext}</p>
            </div>
        </div>
    );
};


// --- (Helper function remains unchanged) ---
const getStatusChip = (status: string) => {
    const baseClasses = "px-2.5 py-1 text-xs font-semibold rounded-full capitalize tracking-wide";
    if (status === 'Approved' || status === 'approved') {
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>;
    }
    if (status === 'Rejected' || status === 'rejected') {
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>;
    }
    return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
};


export default function StaffDashboardPage() {
    const { data: session, status } = useSession();
    const [dashboardData, setDashboardData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!session?.user?.tenantId) return;

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
        return <div className="flex items-center justify-center h-screen bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-teal-600" /></div>;
    }

    if (error) {
        return <div className="text-red-700 bg-red-100 p-4 rounded-lg flex items-center gap-3"><AlertCircle size={20}/> {error}</div>;
    }

    const cardVariants: Variants = {
        hover: {
            y: -5,
            transition: {
                type: "spring",
                stiffness: 300,
            }
        }
    };
    
    const cardContainerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    return (
        <div className="space-y-8 p-4 sm:p-6 bg-gray-50 min-h-screen">
             {/* --- MODIFIED: New vibrant header color, no animation --- */}
             <div className="relative bg-gradient-to-br from-teal-500 to-cyan-600 p-8 rounded-2xl shadow-lg overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-white/10 rounded-full"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-white/10 rounded-full"></div>
                 <div className="relative z-10">
                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                        Welcome back, {session?.user?.name}!
                        <motion.span
                            animate={{ rotate: [0, 15, -10, 15, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                            style={{ display: 'inline-block' }}
                        >
                            👋
                        </motion.span>
                    </h1>
                    <p className="mt-2 text-lg text-cyan-100">Here's a snapshot of your performance and schedule.</p>
                </div>
            </div>

            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                variants={cardContainerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* --- MODIFIED: Updated gradient colors for stat cards --- */}
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard
                        icon={<CalendarIcon size={24}/>}
                        title="Today's Appointments"
                        value={dashboardData?.todaysAppointments?.length || 0}
                        subtext="Upcoming services today"
                        gradient="bg-gradient-to-br from-cyan-500 to-blue-500"
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard
                        icon={<Clock size={24}/>}
                        title="Today's Shift"
                        value={dashboardData?.attendance?.todayShift || "N/A"}
                        subtext="Current scheduled shift"
                        gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard
                        icon={<Target size={24}/>}
                        title="Performance"
                        value={`₹${dashboardData?.performance?.totalSales?.toLocaleString() || 0}`}
                        subtext={`${dashboardData?.performance?.customerCount || 0} customers served`}
                        gradient="bg-gradient-to-br from-green-500 to-emerald-500"
                    />
                </motion.div>
                <motion.div variants={cardVariants} whileHover="hover">
                    <StatCard
                        icon={<Gift size={24}/>}
                        title="Incentive Earned"
                        value={`₹${dashboardData?.incentives?.totalEarned?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || 0}`}
                        subtext="Total for this month"
                        gradient="bg-gradient-to-br from-rose-500 to-pink-500"
                    />
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* --- MODIFIED: Removed hover animation from this card --- */}
                 <motion.div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md border border-gray-100">
                     <div className="flex justify-between items-center mb-4">
                         <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800"><CalendarCheck/> Today's Schedule</h2>
                         <Link href="/my-appointments" className="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">
                            View All
                         </Link>
                    </div>
                     <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                        {dashboardData?.todaysAppointments?.length > 0 ? (
                            dashboardData.todaysAppointments.map((apt: any) => (
                                <motion.div key={apt._id} className="p-4 bg-gray-50 border-l-4 border-teal-500 rounded-r-lg" whileHover={{ scale: 1.02, x: 5, backgroundColor: "#f0fdfa" }}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-900">{apt.customerName}</p>
                                            <p className="text-sm text-gray-600 line-clamp-1">{apt.services}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <p className="font-semibold text-teal-700">{apt.time}</p>
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${apt.status === 'Appointment' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{apt.status}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 py-16">
                                <Scissors className="mx-auto h-16 w-16 text-gray-300" />
                                <p className="mt-4 text-lg font-medium">No appointments scheduled for today.</p>
                                <p className="text-sm">Enjoy your clear schedule!</p>
                            </div>
                        )}
                    </div>
                </motion.div>
                
                <div className="space-y-8">
                    <motion.div variants={cardVariants} whileHover="hover">
                        <StatCard
                            icon={<Users size={24}/>}
                            title="Monthly Hours"
                            value={`${dashboardData?.attendance?.achievedMinutes || 0}/${dashboardData?.attendance?.requiredMinutes || 0}`}
                            subtext="Achieved vs. Target hours"
                            gradient="bg-gradient-to-br from-purple-500 to-indigo-600"
                        />
                    </motion.div>

                    {/* --- MODIFIED: Removed hover animation from this card --- */}
                    <motion.div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><Wallet/> Advance History</h2>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                           {dashboardData?.advances?.history?.length === 0 ? <p className="text-center text-gray-500 py-6 text-sm">No advance requests found.</p> :
                                dashboardData?.advances?.history.map((adv: any) => (
                                    <motion.div key={adv._id} className="p-3 bg-gray-50 rounded-lg" whileHover={{ backgroundColor: "#f3f4f6" }}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-gray-800">₹{adv.amount.toLocaleString()}</span>
                                            {getStatusChip(adv.status)}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(adv.requestDate).toLocaleDateString()}</p>
                                    </motion.div>
                                ))
                            }
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div className="bg-white p-6 rounded-xl shadow-md border border-gray-100" variants={cardVariants} whileHover="hover">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800"><CalendarOff/> Leave History</h2>
                        <Link href="/leave" className="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors flex-shrink-0">
                            View All
                        </Link>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                       {dashboardData?.leaveRequests?.length === 0 ? <p className="text-center text-gray-500 py-10 text-sm">No leave requests found.</p> :
                            dashboardData?.leaveRequests.map((req: any) => (
                                <motion.div key={req._id} className="p-3 bg-gray-50 rounded-lg" whileHover={{ backgroundColor: "#f3f4f6" }}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm text-gray-800">{req.leaveType}</span>
                                        {getStatusChip(req.status)}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                    </p>
                                </motion.div>
                            ))
                        }
                    </div>
                </motion.div>

                <motion.div className="bg-white p-6 rounded-xl shadow-md border border-gray-100" variants={cardVariants} whileHover="hover">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-800"><FileText/> Salary History</h2>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                       {dashboardData?.salaries?.length === 0 ? <p className="text-center text-gray-500 py-10 text-sm">No salary records found.</p> :
                            dashboardData?.salaries.map((sal: any) => (
                                <motion.div key={sal._id} className="p-3 bg-gray-50 rounded-lg" whileHover={{ backgroundColor: "#f3f4f6" }}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-gray-800">{sal.month.name} {sal.year}</p>
                                            <div className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
                                                {sal.isPaid ? <CheckCircle2 size={14} /> : <Clock size={14} className="text-orange-500"/>}
                                                <span className={sal.isPaid ? "" : "text-orange-500"}>
                                                    {sal.isPaid && sal.paidDate ? `Paid on ${new Date(sal.paidDate).toLocaleDateString()}` : 'Processed'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="font-bold text-lg text-gray-900">₹{sal.netSalary.toLocaleString()}</span>
                                    </div>
                                </motion.div>
                            ))
                       }
                    </div>
                </motion.div>
            </div>
        </div>
    );
}