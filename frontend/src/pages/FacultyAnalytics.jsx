import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Users, BookOpen, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

const data = [
    { name: 'Mon', workload: 6, prediction: 6 },
    { name: 'Tue', workload: 8, prediction: 7 },
    { name: 'Wed', workload: 4, prediction: 5 },
    { name: 'Thu', workload: 9, prediction: 8 },
    { name: 'Fri', workload: 5, prediction: 6 },
];

const FacultyAnalytics = () => {
    return (
        <div className="p-6 space-y-6 bg-[#03050C] min-h-screen text-white">
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center"
            >
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Predictive Analytics
                    </h1>
                    <p className="text-slate-400">AI-driven faculty workload & substitution insights</p>
                </div>
                <div className="flex gap-3">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        AI System Active
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Avg Workload', value: '18h/wk', icon: Clock, color: 'text-blue-400' },
                    { label: 'Active Faculty', value: '42', icon: Users, color: 'text-purple-400' },
                    { label: 'Substitutions', value: '12', icon: BookOpen, color: 'text-amber-400' },
                    { label: 'Predicted Gaps', value: '4', icon: AlertTriangle, color: 'text-red-400' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
                    >
                        <div className="flex justify-between items-start">
                            <stat.icon className={stat.color} size={24} />
                            <TrendingUp size={16} className="text-slate-500" />
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-sm text-slate-400">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Workload Distribution */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
                >
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-400" />
                        Weekly Workload Trend
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorWork" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="workload" stroke="#6366f1" fillOpacity={1} fill="url(#colorWork)" />
                                <Area type="monotone" dataKey="prediction" stroke="#ec4899" fill="transparent" strokeDasharray="5 5" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Faculty Health Index */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
                >
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Bot size={18} className="text-purple-400" />
                        AI Performance Score
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    cursor={{ fill: '#ffffff05' }}
                                />
                                <Bar dataKey="workload" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {/* Predicted Substitutions Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold">Recommended Substitutions</h3>
                    <button className="text-xs text-indigo-400 hover:underline">View All Recommendations</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-500 border-b border-white/10">
                                <th className="pb-4">Absent Faculty</th>
                                <th className="pb-4">Slot</th>
                                <th className="pb-4">AI Recommended Substitute</th>
                                <th className="pb-4">Match Score</th>
                                <th className="pb-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300">
                            {[
                                { absent: 'Dr. Sharma', slot: 'Mon 09:20', sub: 'Dr. Verma', score: '98%' },
                                { absent: 'Prof. Gupta', slot: 'Mon 11:10', sub: 'Mr. Khan', score: '92%' },
                                { absent: 'Dr. Patel', slot: 'Tue 10:20', sub: 'Dr. Reddy', score: '85%' },
                            ].map((row, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4">{row.absent}</td>
                                    <td className="py-4">{row.slot}</td>
                                    <td className="py-4 font-medium text-white">{row.sub}</td>
                                    <td className="py-4">
                                        <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold">
                                            {row.score}
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        <button className="px-3 py-1 bg-indigo-600 rounded-lg text-white text-xs hover:bg-indigo-500 transition-colors">
                                            Confirm
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default FacultyAnalytics;
