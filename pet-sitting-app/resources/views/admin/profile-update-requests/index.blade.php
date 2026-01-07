@extends('admin.layouts.app')

@section('content')
<div class="space-y-8">
    <!-- Page Header -->
    <div class="relative overflow-hidden rounded-2xl shadow-2xl" style="background: linear-gradient(135deg, #8b5cf6, #a855f7, #ec4899, #f97316);">
        <div class="absolute inset-0 bg-black opacity-10"></div>
        <div class="relative px-8 py-8">
    <div class="flex items-center justify-between">
                <div class="text-white">
                    <h1 class="text-3xl font-bold mb-2">Profile Update Requests 📝</h1>
                    <p class="text-indigo-100 text-lg">Review and manage user profile update requests</p>
                    <div class="flex items-center mt-4 space-x-6">
                        <div class="flex items-center text-indigo-100">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            <span class="text-sm">Profile Management</span>
                        </div>
                        <div class="flex items-center text-indigo-100">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-sm">Real-time Updates</span>
                        </div>
                    </div>
        </div>
                <div class="hidden md:block">
                    <div class="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Action Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center space-x-4">
            <h2 class="text-xl font-semibold text-gray-900">Profile Request Actions</h2>
        </div>
        <div class="flex items-center space-x-3">
            <button id="refreshButton" onclick="loadRequests()" class="bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 text-indigo-700 px-4 py-2 rounded-xl border border-indigo-200 transition-all duration-200 flex items-center shadow-sm hover:shadow-md">
                <svg id="refreshIcon" class="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span id="refreshText">Refresh</span>
            </button>
            <button id="exportRequests" class="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-4 py-2 rounded-xl transition-all duration-200 flex items-center shadow-lg hover:shadow-xl">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Export Data
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="rounded-2xl shadow-xl border-4 border-purple-600 hover:shadow-2xl hover:scale-105 transition-all duration-300 p-6" style="background: linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6);">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-14 h-14 bg-white bg-opacity-30 rounded-xl flex items-center justify-center shadow-lg">
                        <svg class="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-white drop-shadow-lg">Total Requests</p>
                    <p id="totalRequests" class="text-3xl font-bold text-white drop-shadow-lg">-</p>
                </div>
            </div>
        </div>

        <div class="rounded-2xl shadow-xl border-4 border-orange-600 hover:shadow-2xl hover:scale-105 transition-all duration-300 p-6" style="background: linear-gradient(135deg, #f97316, #f59e0b, #eab308);">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-14 h-14 bg-white bg-opacity-30 rounded-xl flex items-center justify-center shadow-lg">
                        <svg class="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-white drop-shadow-lg">Pending</p>
                    <p id="pendingRequests" class="text-3xl font-bold text-white drop-shadow-lg">-</p>
                </div>
            </div>
        </div>

        <div class="rounded-2xl shadow-xl border-4 border-green-600 hover:shadow-2xl hover:scale-105 transition-all duration-300 p-6" style="background: linear-gradient(135deg, #10b981, #059669, #0d9488);">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-14 h-14 bg-white bg-opacity-30 rounded-xl flex items-center justify-center shadow-lg">
                        <svg class="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-white drop-shadow-lg">Approved</p>
                    <p id="approvedRequests" class="text-3xl font-bold text-white drop-shadow-lg">-</p>
                </div>
            </div>
        </div>

        <div class="rounded-2xl shadow-xl border-4 border-red-600 hover:shadow-2xl hover:scale-105 transition-all duration-300 p-6" style="background: linear-gradient(135deg, #ef4444, #f43f5e, #ec4899);">
            <div class="flex items-center">
                <div class="flex-shrink-0">
                    <div class="w-14 h-14 bg-white bg-opacity-30 rounded-xl flex items-center justify-center shadow-lg">
                        <svg class="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                </div>
                <div class="ml-4">
                    <p class="text-sm font-medium text-white drop-shadow-lg">Rejected</p>
                    <p id="rejectedRequests" class="text-3xl font-bold text-white drop-shadow-lg">-</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 hover-lift p-6">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"></path>
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">Filter Requests</h3>
                    <p class="text-sm text-gray-600">Search and filter profile update requests</p>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label for="statusFilter" class="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                <select id="statusFilter" onchange="filterRequests()" 
                        class="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                    <option value="all">All Requests</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
            
            <div class="flex-1">
                <label for="searchInput" class="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                    <input type="text" id="searchInput" onkeyup="filterRequests()"
                           class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                           placeholder="Search by user name or email...">
                </div>
            </div>
        </div>
    </div>

    <!-- Requests Table -->
    <div class="bg-gradient-to-br from-indigo-50 to-purple-100 rounded-2xl shadow-lg border border-indigo-200 hover-lift">
        <div class="px-6 py-4 border-b border-indigo-200 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-t-2xl">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-indigo-800">Profile Update Requests</h3>
                    <p class="text-sm text-indigo-600">Review and manage user profile update requests</p>
                </div>
            </div>
        </div>
        
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested Changes</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody id="requestsTableBody" class="bg-white divide-y divide-gray-200">
                    <!-- Requests will be loaded here -->
                </tbody>
            </table>
        </div>

        <!-- Loading State -->
        <div id="loadingState" class="text-center py-8">
            <div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-gray-500 bg-white">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading requests...
            </div>
        </div>

        <!-- Empty State -->
        <div id="emptyState" class="text-center py-8 hidden">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No requests found</h3>
            <p class="mt-1 text-sm text-gray-500">No profile update requests match your criteria.</p>
        </div>
    </div>
</div>

<!-- Request Details Modal -->
<div id="requestDetailsModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50">
    <div class="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div class="mt-3">
            <!-- Modal Header -->
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-medium text-gray-900">Request Details</h3>
                <button onclick="closeRequestDetailsModal()" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <div id="requestDetailsContent">
                <!-- Request details will be populated here -->
            </div>
        </div>
    </div>
</div>

<script>
let allRequests = @json($requests ?? []);
let filteredRequests = [...allRequests];

// Load requests on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Panel: DOM Content Loaded');
    console.log('Admin Panel: Initializing with requests:', allRequests);
    console.log('Admin Panel: Number of initial requests:', allRequests.length);
    console.log('Admin Panel: Stats:', @json($stats ?? []));
    
    // Hide loading state since data is already loaded from the server
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.add('hidden');
    }
    
    // Data is already loaded from the server - render immediately
    console.log('Admin Panel: About to render initial requests');
    renderRequests();
    loadStats();
    
    // Start auto-refresh every 5 seconds
    console.log('Admin Panel: Starting auto-refresh');
    startAutoRefresh();
});

// Auto-refresh functionality
let refreshInterval;

function startAutoRefresh() {
    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Show auto-refresh indicator
    const indicator = document.getElementById('autoRefreshIndicator');
    if (indicator) {
        indicator.classList.remove('hidden');
    }
    
    // Set up new interval to refresh every 5 seconds
    refreshInterval = setInterval(() => {
        console.log('Admin Panel: Auto-refreshing data...');
        loadRequests();
    }, 5000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    
    // Hide auto-refresh indicator
    const indicator = document.getElementById('autoRefreshIndicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}


// Load requests via AJAX
async function loadRequests() {
    const refreshButton = document.getElementById('refreshButton');
    const refreshIcon = document.getElementById('refreshIcon');
    const refreshText = document.getElementById('refreshText');
    
    try {
        console.log('Admin Panel: Loading requests via AJAX...');
        
        // Show loading state
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (refreshIcon) {
            refreshIcon.classList.add('animate-spin');
        }
        if (refreshText) {
            refreshText.textContent = 'Refreshing...';
        }
        
        const response = await fetch('/admin/profile-update-requests', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
            },
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Admin Panel: Full response:', data);
        
        if (data.success) {
            console.log('Admin Panel: Received requests:', data.requests.length);
            console.log('Admin Panel: Requests data:', data.requests);
            allRequests = data.requests;
            filteredRequests = [...allRequests];
            renderRequests();
            loadStatsFromData(data.stats);
        } else {
            console.error('Admin Panel: Error loading requests:', data.message);
        }
    } catch (error) {
        console.error('Admin Panel: Error loading requests:', error);
    } finally {
        // Reset loading state
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (refreshIcon) {
            refreshIcon.classList.remove('animate-spin');
        }
        if (refreshText) {
            refreshText.textContent = 'Refresh';
        }
    }
}

function loadStatsFromData(stats) {
    console.log('Admin Panel: Loading stats from data:', stats);
    
    try {
        const totalEl = document.getElementById('totalRequests');
        const pendingEl = document.getElementById('pendingRequests');
        const approvedEl = document.getElementById('approvedRequests');
        const rejectedEl = document.getElementById('rejectedRequests');
        const todayEl = document.getElementById('todayRequests');
        const weekEl = document.getElementById('weekRequests');
        
        if (totalEl) totalEl.textContent = stats.total || 0;
        if (pendingEl) pendingEl.textContent = stats.pending || 0;
        if (approvedEl) approvedEl.textContent = stats.approved || 0;
        if (rejectedEl) rejectedEl.textContent = stats.rejected || 0;
        if (todayEl) todayEl.textContent = stats.today || 0;
        if (weekEl) weekEl.textContent = stats.this_week || 0;
    } catch (error) {
        console.error('Admin Panel: Error loading stats:', error);
    }
}

function loadStats() {
    // Stats are already loaded from the server
    const stats = @json($stats ?? []);
    console.log('Admin Panel: Loading stats:', stats);
    
    try {
        // Always try to load stats, even if empty
        const totalEl = document.getElementById('totalRequests');
        const pendingEl = document.getElementById('pendingRequests');
        const approvedEl = document.getElementById('approvedRequests');
        const rejectedEl = document.getElementById('rejectedRequests');
        const todayEl = document.getElementById('todayRequests');
        const weekEl = document.getElementById('weekRequests');
        
        if (totalEl) totalEl.textContent = stats.total || 0;
        if (pendingEl) pendingEl.textContent = stats.pending || 0;
        if (approvedEl) approvedEl.textContent = stats.approved || 0;
        if (rejectedEl) rejectedEl.textContent = stats.rejected || 0;
        if (todayEl) todayEl.textContent = stats.today || 0;
        if (weekEl) weekEl.textContent = stats.this_week || 0;
    } catch (error) {
        console.error('Admin Panel: Error loading stats:', error);
        // Set default values if there's an error
        const totalEl = document.getElementById('totalRequests');
        const pendingEl = document.getElementById('pendingRequests');
        const approvedEl = document.getElementById('approvedRequests');
        const rejectedEl = document.getElementById('rejectedRequests');
        
        if (totalEl) totalEl.textContent = '0';
        if (pendingEl) pendingEl.textContent = '0';
        if (approvedEl) approvedEl.textContent = '0';
        if (rejectedEl) rejectedEl.textContent = '0';
    }
}

function filterRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    console.log('Admin Panel: Filtering requests, allRequests:', allRequests.length);
    
    filteredRequests = allRequests.filter(request => {
        const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
        const matchesSearch = !searchQuery || 
            request.user.name.toLowerCase().includes(searchQuery) ||
            request.user.email.toLowerCase().includes(searchQuery);
        
        return matchesStatus && matchesSearch;
    });
    
    console.log('Admin Panel: Filtered requests:', filteredRequests.length);
    renderRequests();
}

function renderRequests() {
    console.log('Admin Panel: Rendering requests, allRequests:', allRequests);
    console.log('Admin Panel: Rendering requests, filteredRequests:', filteredRequests);
    
    const tbody = document.getElementById('requestsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (!tbody) {
        console.error('Admin Panel: requestsTableBody element not found');
        return;
    }
    
    // Use allRequests if filteredRequests is empty
    const requestsToRender = filteredRequests.length > 0 ? filteredRequests : allRequests;
    console.log('Admin Panel: Requests to render:', requestsToRender.length);
    console.log('Admin Panel: Requests to render data:', requestsToRender);
    
    if (requestsToRender.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
        }
        return;
    }
    
    if (emptyState) {
        emptyState.classList.add('hidden');
    }
    
    tbody.innerHTML = requestsToRender.map(request => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                        <div class="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
                            <span class="text-sm font-medium text-white">
                                ${request.user.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${request.user.name}</div>
                        <div class="text-sm text-gray-500">${request.user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">
                    ${getRequestedChanges(request)}
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900 max-w-xs truncate">${request.reason}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(request.status)}">
                    ${getStatusText(request.status)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${formatDate(request.created_at)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewRequestDetails(${request.id})" 
                        class="text-orange-600 hover:text-orange-900 mr-2">
                    View
                </button>
                ${request.status === 'pending' ? `
                    <button onclick="approveRequest(${request.id})" 
                            class="text-green-600 hover:text-green-900 mr-2">
                        Approve
                    </button>
                    <button onclick="rejectRequest(${request.id})" 
                            class="text-red-600 hover:text-red-900">
                        Reject
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function getRequestedChanges(request) {
    const changes = [];
    
    if (request.first_name !== request.old_first_name) {
        changes.push(`First Name: "${request.old_first_name}" → "${request.first_name}"`);
    }
    if (request.last_name !== request.old_last_name) {
        changes.push(`Last Name: "${request.old_last_name}" → "${request.last_name}"`);
    }
    if (request.phone !== request.old_phone) {
        changes.push(`Phone: "${request.old_phone || 'Not set'}" → "${request.phone}"`);
    }
    if (request.hourly_rate != request.old_hourly_rate) {
        changes.push(`Hourly Rate: "₱${request.old_hourly_rate || 'Not set'}" → "₱${request.hourly_rate}"`);
    }
    if (request.experience != request.old_experience) {
        const oldExp = request.old_experience ? `${request.old_experience} years` : 'Not set';
        const newExp = request.experience ? `${request.experience} years` : 'Not set';
        changes.push(`Years of Experience: "${oldExp}" → "${newExp}"`);
    }
    if (request.max_pets != request.old_max_pets) {
        const oldMaxPets = request.old_max_pets !== null && request.old_max_pets !== undefined ? `${request.old_max_pets}` : '10';
        const newMaxPets = request.max_pets !== null && request.max_pets !== undefined ? `${request.max_pets}` : 'Not set';
        changes.push(`Max Pets: "${oldMaxPets}" → "${newMaxPets}"`);
    }
    
    return changes.length > 0 ? changes.join('<br>') : 'No changes';
}

function getStatusClass(status) {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'approved': return 'bg-green-100 text-green-800';
        case 'rejected': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'pending': return 'Pending';
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        default: return status;
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

function viewRequestDetails(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    document.getElementById('requestDetailsContent').innerHTML = `
        <div class="space-y-6">
            <!-- User Info -->
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="text-lg font-medium text-gray-900 mb-3">User Information</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="text-sm font-medium text-gray-500">Name:</span>
                        <p class="text-sm text-gray-900">${request.user.name}</p>
                    </div>
                    <div>
                        <span class="text-sm font-medium text-gray-500">Email:</span>
                        <p class="text-sm text-gray-900">${request.user.email}</p>
                    </div>
                    <div>
                        <span class="text-sm font-medium text-gray-500">Phone:</span>
                        <p class="text-sm text-gray-900">${request.user.phone || 'Not set'}</p>
                    </div>
                    <div>
                        <span class="text-sm font-medium text-gray-500">Request Date:</span>
                        <p class="text-sm text-gray-900">${formatDate(request.created_at)}</p>
                    </div>
                </div>
            </div>

            <!-- Current vs Requested Changes -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <h4 class="text-lg font-medium text-gray-900 mb-3">Requested Changes</h4>
                <div class="space-y-3">
                    ${getDetailedChanges(request)}
                </div>
            </div>

            <!-- Reason -->
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <h4 class="text-lg font-medium text-gray-900 mb-3">Reason</h4>
                <p class="text-sm text-gray-700">${request.reason}</p>
            </div>

            <!-- Admin Notes -->
            ${request.admin_notes ? `
                <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 class="text-lg font-medium text-gray-900 mb-3">Admin Notes</h4>
                    <p class="text-sm text-gray-700">${request.admin_notes}</p>
                </div>
            ` : ''}

            <!-- Actions -->
            ${request.status === 'pending' ? `
                <div class="flex justify-end space-x-3">
                    <button onclick="rejectRequest(${request.id})" 
                            class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700">
                        Reject
                    </button>
                    <button onclick="approveRequest(${request.id})" 
                            class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">
                        Approve
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('requestDetailsModal').classList.remove('hidden');
}

function getDetailedChanges(request) {
    const changes = [];
    
    if (request.first_name !== request.old_first_name) {
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">First Name:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">${request.old_first_name || 'Not set'}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">${request.first_name}</span>
                </div>
            </div>
        `);
    }
    
    if (request.last_name !== request.old_last_name) {
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">Last Name:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">${request.old_last_name || 'Not set'}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">${request.last_name}</span>
                </div>
            </div>
        `);
    }
    
    if (request.phone !== request.old_phone) {
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">Phone:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">${request.old_phone || 'Not set'}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">${request.phone}</span>
                </div>
            </div>
        `);
    }
    
    if (request.hourly_rate != request.old_hourly_rate) {
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">Hourly Rate:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">₱${request.old_hourly_rate || 'Not set'}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">₱${request.hourly_rate}</span>
                </div>
            </div>
        `);
    }
    
    if (request.experience != request.old_experience) {
        const oldExp = request.old_experience ? `${request.old_experience} years` : 'Not set';
        const newExp = request.experience ? `${request.experience} years` : 'Not set';
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">Years of Experience:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">${oldExp}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">${newExp}</span>
                </div>
            </div>
        `);
    }
    
    if (request.max_pets != request.old_max_pets) {
        const oldMaxPets = request.old_max_pets !== null && request.old_max_pets !== undefined ? `${request.old_max_pets}` : '10';
        const newMaxPets = request.max_pets !== null && request.max_pets !== undefined ? `${request.max_pets}` : 'Not set';
        changes.push(`
            <div class="flex justify-between items-center py-2 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-500">Max Pets:</span>
                <div class="text-sm text-gray-900">
                    <span class="text-red-600">${oldMaxPets}</span>
                    <span class="mx-2">→</span>
                    <span class="text-green-600">${newMaxPets}</span>
                </div>
            </div>
        `);
    }
    
    return changes.length > 0 ? changes.join('') : '<p class="text-sm text-gray-500">No changes requested</p>';
}

function closeRequestDetailsModal() {
    document.getElementById('requestDetailsModal').classList.add('hidden');
}

async function approveRequest(requestId) {
    if (!confirm('Are you sure you want to approve this request?')) return;
    
    try {
        const response = await fetch(`/admin/profile-update-requests/${requestId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                admin_notes: 'Approved by admin'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Request approved successfully!');
            closeRequestDetailsModal();
            // Reload page immediately to show updated data
            window.location.reload();
        } else {
            showError(data.message || 'Failed to approve request.');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        showError('Failed to approve request. Please try again.');
    }
}

async function rejectRequest(requestId) {
    const adminNotes = prompt('Please provide a reason for rejection:');
    if (!adminNotes) return;
    
    try {
        const response = await fetch(`/admin/profile-update-requests/${requestId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                admin_notes: adminNotes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Request rejected successfully!');
            closeRequestDetailsModal();
            // Reload page immediately to show updated data
            window.location.reload();
        } else {
            showError(data.message || 'Failed to reject request.');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        showError('Failed to reject request. Please try again.');
    }
}

function refreshRequests() {
    // Reload the page to get fresh data from server
    window.location.reload();
}

function setupRealTimeUpdates() {
    // Disabled to prevent interference with server-side data
    // Real-time updates can cause data to disappear and reappear
    // setInterval(() => {
    //     loadRequests();
    //     loadStats();
    // }, 30000);
}


function showSuccess(message) {
    // Simple alert for now - you can replace with a proper notification system
    alert(message);
}

function showError(message) {
    // Simple alert for now - you can replace with a proper notification system
    alert('Error: ' + message);
}
</script>
@endsection
