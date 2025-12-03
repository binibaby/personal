<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProfileChangeRequest;
use App\Models\NameUpdateRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Broadcast;
use App\Events\ProfileUpdateRequestApproved;
use App\Events\ProfileUpdateRequestRejected;

class ProfileUpdateRequestController extends Controller
{
    /**
     * Get all profile update requests
     */
    public function index(Request $request)
    {
        try {
            $query = ProfileChangeRequest::with(['user:id,name,email,phone', 'reviewer:id,name'])
                ->where('status', 'pending') // Only show pending requests
                ->orderBy('created_at', 'desc');

            // Apply status filter (but still only show pending by default)
            if ($request->has('status') && $request->status !== 'all' && $request->status !== 'pending') {
                $query->where('status', $request->status);
            }

            $requests = $query->get();

            // Check if this is an AJAX request
            if ($request->ajax() || $request->wantsJson()) {
                // Get stats for AJAX requests
                $stats = [
                    'total' => ProfileChangeRequest::where('status', 'pending')->count(),
                    'pending' => ProfileChangeRequest::where('status', 'pending')->count(),
                    'approved' => ProfileChangeRequest::where('status', 'approved')->count(),
                    'rejected' => ProfileChangeRequest::where('status', 'rejected')->count(),
                    'today' => ProfileChangeRequest::where('status', 'pending')->whereDate('created_at', today())->count(),
                    'this_week' => ProfileChangeRequest::where('status', 'pending')->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
                ];
                
                return response()->json([
                    'success' => true,
                    'requests' => $requests,
                    'stats' => $stats
                ]);
            }

            // Get stats for the view (only pending requests)
            $stats = [
                'total' => ProfileChangeRequest::where('status', 'pending')->count(),
                'pending' => ProfileChangeRequest::where('status', 'pending')->count(),
                'approved' => ProfileChangeRequest::where('status', 'approved')->count(),
                'rejected' => ProfileChangeRequest::where('status', 'rejected')->count(),
                'today' => ProfileChangeRequest::where('status', 'pending')->whereDate('created_at', today())->count(),
                'this_week' => ProfileChangeRequest::where('status', 'pending')->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            ];

            // Return the web view for regular requests with data
            return view('admin.profile-update-requests.index', compact('requests', 'stats'));
        } catch (\Exception $e) {
            if ($request->ajax() || $request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to fetch profile update requests: ' . $e->getMessage()
                ], 500);
            }
            
            return view('admin.profile-update-requests.index')->with('error', 'Failed to load requests');
        }
    }

    /**
     * Get a specific profile update request
     */
    public function show($id)
    {
        try {
            $request = ProfileChangeRequest::with(['user', 'reviewer'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'request' => $request
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch profile update request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Approve a profile update request
     */
    public function approve(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $profileRequest = ProfileChangeRequest::findOrFail($id);

            if ($profileRequest->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed.'
                ], 400);
            }

            // Update user profile with approved changes
            $user = User::findOrFail($profileRequest->user_id);
            
            // Update first name if changed
            if ($profileRequest->first_name && $profileRequest->first_name !== $profileRequest->old_first_name) {
                $user->first_name = $profileRequest->first_name;
            }
            
            // Update last name if changed
            if ($profileRequest->last_name && $profileRequest->last_name !== $profileRequest->old_last_name) {
                $user->last_name = $profileRequest->last_name;
            }
            
            // Update phone if changed
            if ($profileRequest->phone && $profileRequest->phone !== $profileRequest->old_phone) {
                $user->phone = $profileRequest->phone;
            }
            
            // Update hourly rate if changed (for pet sitters)
            if ($profileRequest->hourly_rate && $profileRequest->hourly_rate != $profileRequest->old_hourly_rate) {
                $user->hourly_rate = $profileRequest->hourly_rate;
            }

            // Update experience if changed (for pet sitters) - compare as numbers
            if ($profileRequest->experience !== null && (float)$profileRequest->experience != (float)($profileRequest->old_experience ?? 0)) {
                $user->experience = (string)$profileRequest->experience; // Store as string to match user table format
            }

            // Update the full name if first or last name changed
            if (($profileRequest->first_name && $profileRequest->first_name !== $profileRequest->old_first_name) || 
                ($profileRequest->last_name && $profileRequest->last_name !== $profileRequest->old_last_name)) {
                $user->name = trim(($profileRequest->first_name ?: $user->first_name) . ' ' . ($profileRequest->last_name ?: $user->last_name));
            }

            $user->save();

            // Create NameUpdateRequest record if name was changed
            if (($profileRequest->first_name && $profileRequest->first_name !== $profileRequest->old_first_name) || 
                ($profileRequest->last_name && $profileRequest->last_name !== $profileRequest->old_last_name)) {
                
                $oldName = trim(($profileRequest->old_first_name ?: $user->first_name) . ' ' . ($profileRequest->old_last_name ?: $user->last_name));
                $newName = trim(($profileRequest->first_name ?: $user->first_name) . ' ' . ($profileRequest->last_name ?: $user->last_name));
                
                NameUpdateRequest::create([
                    'user_id' => $user->id,
                    'old_name' => $oldName,
                    'new_name' => $newName,
                    'old_first_name' => $profileRequest->old_first_name ?: $user->first_name,
                    'new_first_name' => $profileRequest->first_name ?: $user->first_name,
                    'old_last_name' => $profileRequest->old_last_name ?: $user->last_name,
                    'new_last_name' => $profileRequest->last_name ?: $user->last_name,
                    'reason' => $profileRequest->reason,
                    'status' => 'approved',
                    'admin_notes' => $request->admin_notes ?: 'Approved via Profile Update Request',
                    'reviewed_by' => Auth::id(),
                    'reviewed_at' => now(),
                ]);
            }

            // Update request status
            $profileRequest->status = 'approved';
            $profileRequest->admin_notes = $request->admin_notes;
            $profileRequest->reviewed_by = Auth::id();
            $profileRequest->reviewed_at = now();
            $profileRequest->last_approved_at = now(); // Set the cooldown start time
            $profileRequest->save();

            // Create database notification for the user
            try {
                $user->notifications()->create([
                    'type' => 'profile_update_approved',
                    'title' => 'Profile Update Approved',
                    'message' => 'Your profile update request has been approved! Your changes are now live.',
                    'data' => json_encode([
                        'request_id' => $profileRequest->id,
                        'approved_fields' => $this->getApprovedFields($profileRequest),
                        'admin_notes' => $request->admin_notes,
                        'approved_at' => now()->toISOString(),
                    ])
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to create database notification for profile approval: ' . $e->getMessage());
            }

            // Dispatch real-time notification event (if broadcasting is available)
            try {
                broadcast(new ProfileUpdateRequestApproved($profileRequest, $user));
            } catch (\Exception $e) {
                // Log the error but don't fail the approval process
                \Log::warning('Failed to broadcast ProfileUpdateRequestApproved event: ' . $e->getMessage());
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Profile update request approved successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to approve request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject a profile update request
     */
    public function reject(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'admin_notes' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $profileRequest = ProfileChangeRequest::findOrFail($id);

            if ($profileRequest->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed.'
                ], 400);
            }

            // Update request status
            $profileRequest->status = 'rejected';
            $profileRequest->admin_notes = $request->admin_notes;
            $profileRequest->reviewed_by = Auth::id();
            $profileRequest->reviewed_at = now();
            $profileRequest->save();

            // Get user for notification
            $user = User::findOrFail($profileRequest->user_id);

            // Create NameUpdateRequest record for rejected name changes (for audit trail)
            if (($profileRequest->first_name && $profileRequest->first_name !== $profileRequest->old_first_name) || 
                ($profileRequest->last_name && $profileRequest->last_name !== $profileRequest->old_last_name)) {
                
                $oldName = trim(($profileRequest->old_first_name ?: $user->first_name) . ' ' . ($profileRequest->old_last_name ?: $user->last_name));
                $newName = trim(($profileRequest->first_name ?: $user->first_name) . ' ' . ($profileRequest->last_name ?: $user->last_name));
                
                NameUpdateRequest::create([
                    'user_id' => $user->id,
                    'old_name' => $oldName,
                    'new_name' => $newName,
                    'old_first_name' => $profileRequest->old_first_name ?: $user->first_name,
                    'new_first_name' => $profileRequest->first_name ?: $user->first_name,
                    'old_last_name' => $profileRequest->old_last_name ?: $user->last_name,
                    'new_last_name' => $profileRequest->last_name ?: $user->last_name,
                    'reason' => $profileRequest->reason,
                    'status' => 'rejected',
                    'admin_notes' => $request->admin_notes ?: 'Rejected via Profile Update Request',
                    'reviewed_by' => Auth::id(),
                    'reviewed_at' => now(),
                ]);
            }

            // Create database notification for the user
            try {
                $user->notifications()->create([
                    'type' => 'profile_update_rejected',
                    'title' => 'Profile Update Rejected',
                    'message' => 'Your profile update request has been rejected. Please email the admin at petsitconnectph@gmail.com for assistance.',
                    'data' => json_encode([
                        'request_id' => $profileRequest->id,
                        'rejected_fields' => $this->getApprovedFields($profileRequest),
                        'admin_notes' => $request->admin_notes,
                        'rejected_at' => now()->toISOString(),
                    ])
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to create database notification for profile rejection: ' . $e->getMessage());
            }

            // Dispatch real-time notification event (if broadcasting is available)
            try {
                broadcast(new ProfileUpdateRequestRejected($profileRequest, $user));
            } catch (\Exception $e) {
                // Log the error but don't fail the rejection process
                \Log::warning('Failed to broadcast ProfileUpdateRequestRejected event: ' . $e->getMessage());
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Profile update request rejected successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for profile update requests
     */
    public function getStats()
    {
        try {
            $stats = [
                'total' => ProfileChangeRequest::count(),
                'pending' => ProfileChangeRequest::where('status', 'pending')->count(),
                'approved' => ProfileChangeRequest::where('status', 'approved')->count(),
                'rejected' => ProfileChangeRequest::where('status', 'rejected')->count(),
                'today' => ProfileChangeRequest::whereDate('created_at', today())->count(),
                'this_week' => ProfileChangeRequest::whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            ];

            return response()->json([
                'success' => true,
                'stats' => $stats
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch statistics: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get list of approved fields for notification
     */
    private function getApprovedFields(ProfileChangeRequest $request)
    {
        $fields = [];
        
        if ($request->first_name !== $request->old_first_name) {
            $fields[] = 'First Name';
        }
        if ($request->last_name !== $request->old_last_name) {
            $fields[] = 'Last Name';
        }
        if ($request->phone !== $request->old_phone) {
            $fields[] = 'Phone';
        }
        if ($request->hourly_rate != $request->old_hourly_rate) {
            $fields[] = 'Hourly Rate';
        }
        // Compare experience as numbers
        if ((float)($request->experience ?? 0) != (float)($request->old_experience ?? 0)) {
            $fields[] = 'Years of Experience';
        }
        
        return $fields;
    }


}
