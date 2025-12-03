<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\NameUpdateRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class NameUpdateController extends Controller
{
    /**
     * Display the name update management page
     */
    public function index()
    {
        return view('admin.name-updates.index');
    }

    /**
     * Get all users for admin name update management (only users with name update requests)
     */
    public function getUsers(Request $request)
    {
        try {
            // Get users who have submitted name update requests OR profile change requests
            $query = User::select('id', 'name', 'first_name', 'last_name', 'email', 'phone', 'role', 'created_at', 'profile_image', 
                                 'experience', 'hourly_rate', 'bio', 'specialties', 'pet_breeds', 'selected_pet_types', 'address', 'status')
                ->where(function($q) {
                    $q->whereHas('nameUpdateRequests')
                      ->orWhereHas('profileChangeRequests');
                }); // Users with name update requests OR profile change requests

            // Apply search filter
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                      ->orWhere('email', 'LIKE', "%{$search}%")
                      ->orWhere('phone', 'LIKE', "%{$search}%")
                      ->orWhere('first_name', 'LIKE', "%{$search}%")
                      ->orWhere('last_name', 'LIKE', "%{$search}%");
                });
            }

            // Apply role filter
            if ($request->has('role') && $request->role !== 'all') {
                $query->where('role', $request->role);
            }

            $users = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'success' => true,
                'users' => $users
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch users: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user name by admin
     */
    public function updateUserName(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|integer|exists:users,id',
            'new_first_name' => 'required|string|max:255',
            'new_last_name' => 'required|string|max:255',
            'reason' => 'required|string|max:1000',
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

            $user = User::findOrFail($request->user_id);
            $oldName = $user->name;
            $oldFirstName = $user->first_name;
            $oldLastName = $user->last_name;

            $newFirstName = trim($request->new_first_name);
            $newLastName = trim($request->new_last_name);
            $newName = $newFirstName . ' ' . $newLastName;

            // Check if name actually changed
            if ($newName === $oldName) {
                return response()->json([
                    'success' => false,
                    'message' => 'The new name is the same as the current name.'
                ], 400);
            }

            // Update user name
            $user->first_name = $newFirstName;
            $user->last_name = $newLastName;
            $user->name = $newName;
            $user->save();

            // Create name update request record for audit trail
            NameUpdateRequest::create([
                'user_id' => $user->id,
                'old_name' => $oldName,
                'new_name' => $newName,
                'old_first_name' => $oldFirstName,
                'new_first_name' => $newFirstName,
                'old_last_name' => $oldLastName,
                'new_last_name' => $newLastName,
                'reason' => $request->reason,
                'status' => 'approved',
                'admin_notes' => $request->admin_notes,
                'reviewed_by' => Auth::id(),
                'reviewed_at' => now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'User name updated successfully',
                'user' => $user->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user name: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all name update requests
     */
    public function getNameUpdateRequests(Request $request)
    {
        try {
            $query = NameUpdateRequest::with(['user:id,name,email,phone', 'reviewer:id,name'])
                ->orderBy('created_at', 'desc');

            // Apply status filter
            if ($request->has('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            $requests = $query->get();

            return response()->json([
                'success' => true,
                'requests' => $requests
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch name update requests: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get name update requests for a specific user
     */
    public function getUserNameUpdateRequests($userId)
    {
        try {
            $nameRequests = NameUpdateRequest::where('user_id', $userId)
                ->with(['reviewer:id,name'])
                ->orderBy('created_at', 'desc')
                ->get();

            $profileRequests = \App\Models\ProfileChangeRequest::where('user_id', $userId)
                ->with(['reviewer:id,name'])
                ->orderBy('created_at', 'desc')
                ->get();

            // Combine and sort all requests by creation date
            $allRequests = collect()
                ->merge($nameRequests->map(function($request) {
                    return [
                        'id' => $request->id,
                        'type' => 'name_update',
                        'field_name' => 'Name',
                        'old_value' => $request->old_name,
                        'new_value' => $request->new_name,
                        'reason' => $request->reason,
                        'admin_notes' => $request->admin_notes,
                        'status' => $request->status,
                        'created_at' => $request->created_at,
                        'reviewer' => $request->reviewer
                    ];
                }))
                ->merge($profileRequests->flatMap(function($request) {
                    $results = [];
                    
                    // Handle multiple fields update
                    if ($request->field_name === 'multiple') {
                        // Create separate entries for each changed field
                        if ($request->first_name && $request->first_name !== $request->old_first_name) {
                            $results[] = [
                                'id' => $request->id . '_first_name',
                                'type' => 'profile_update',
                                'field_name' => 'First Name',
                                'old_value' => $request->old_first_name ?: 'Not set',
                                'new_value' => $request->first_name,
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                        
                        if ($request->last_name && $request->last_name !== $request->old_last_name) {
                            $results[] = [
                                'id' => $request->id . '_last_name',
                                'type' => 'profile_update',
                                'field_name' => 'Last Name',
                                'old_value' => $request->old_last_name ?: 'Not set',
                                'new_value' => $request->last_name,
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                        
                        if ($request->hourly_rate && $request->hourly_rate != $request->old_hourly_rate) {
                            $results[] = [
                                'id' => $request->id . '_hourly_rate',
                                'type' => 'profile_update',
                                'field_name' => 'Hourly Rate',
                                'old_value' => $request->old_hourly_rate ? '₱' . $request->old_hourly_rate . '/hour' : 'Not set',
                                'new_value' => '₱' . $request->hourly_rate . '/hour',
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                        
                        if ($request->phone && $request->phone !== $request->old_phone) {
                            $results[] = [
                                'id' => $request->id . '_phone',
                                'type' => 'profile_update',
                                'field_name' => 'Phone Number',
                                'old_value' => $request->old_phone ?: 'Not set',
                                'new_value' => $request->phone,
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                        
                        if ($request->experience && $request->experience != $request->old_experience) {
                            $oldExp = $request->old_experience ? $request->old_experience . ' years' : 'Not set';
                            $newExp = $request->experience . ' years';
                            $results[] = [
                                'id' => $request->id . '_experience',
                                'type' => 'profile_update',
                                'field_name' => 'Years of Experience',
                                'old_value' => $oldExp,
                                'new_value' => $newExp,
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                        
                        // Handle specialties/services changes
                        if ($request->specialties && $request->specialties !== $request->old_specialties) {
                            $oldSpecialties = $request->old_specialties ? (is_array($request->old_specialties) ? implode(', ', $request->old_specialties) : $request->old_specialties) : 'No services specified';
                            $newSpecialties = is_array($request->specialties) ? implode(', ', $request->specialties) : $request->specialties;
                            
                            $results[] = [
                                'id' => $request->id . '_specialties',
                                'type' => 'profile_update',
                                'field_name' => 'Services',
                                'old_value' => $oldSpecialties,
                                'new_value' => $newSpecialties,
                                'reason' => $request->reason,
                                'admin_notes' => $request->admin_notes,
                                'status' => $request->status,
                                'created_at' => $request->created_at,
                                'reviewer' => $request->reviewer
                            ];
                        }
                    } else {
                        // Handle single field updates
                        $fieldName = $request->getFieldDisplayName();
                        $oldValue = $request->old_value;
                        $newValue = $request->new_value;
                        
                        // Handle specific field mappings
                        if ($request->field_name === 'first_name') {
                            $oldValue = $request->old_first_name ?: 'Not set';
                            $newValue = $request->first_name;
                        } elseif ($request->field_name === 'last_name') {
                            $oldValue = $request->old_last_name ?: 'Not set';
                            $newValue = $request->last_name;
                        } elseif ($request->field_name === 'phone') {
                            $oldValue = $request->old_phone ?: 'Not set';
                            $newValue = $request->phone;
                        } elseif ($request->field_name === 'hourly_rate') {
                            $oldValue = $request->old_hourly_rate ? '₱' . $request->old_hourly_rate . '/hour' : 'Not set';
                            $newValue = $request->hourly_rate ? '₱' . $request->hourly_rate . '/hour' : 'Not set';
                        } elseif ($request->field_name === 'experience') {
                            $oldValue = $request->old_experience ? $request->old_experience . ' years' : 'Not set';
                            $newValue = $request->experience ? $request->experience . ' years' : 'Not set';
                        } elseif ($request->field_name === 'bio') {
                            $oldValue = $request->old_value ?: 'No bio provided';
                            $newValue = $request->new_value ?: 'No bio provided';
                        } elseif ($request->field_name === 'specialties') {
                            $oldValue = $request->old_value ? (is_array($request->old_value) ? implode(', ', $request->old_value) : $request->old_value) : 'No services specified';
                            $newValue = $request->new_value ? (is_array($request->new_value) ? implode(', ', $request->new_value) : $request->new_value) : 'No services specified';
                        }
                        
                        $results[] = [
                            'id' => $request->id,
                            'type' => 'profile_update',
                            'field_name' => $fieldName,
                            'old_value' => $oldValue,
                            'new_value' => $newValue,
                            'reason' => $request->reason,
                            'admin_notes' => $request->admin_notes,
                            'status' => $request->status,
                            'created_at' => $request->created_at,
                            'reviewer' => $request->reviewer
                        ];
                    }
                    
                    return $results;
                }))
                ->sortByDesc('created_at')
                ->values();

            return response()->json([
                'success' => true,
                'requests' => $allRequests
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch user change history: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Approve a name update request
     */
    public function approveRequest(Request $request, $id)
    {
        try {
            $nameUpdateRequest = NameUpdateRequest::findOrFail($id);

            if ($nameUpdateRequest->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed.'
                ], 400);
            }

            DB::beginTransaction();

            // Update user name
            $user = User::findOrFail($nameUpdateRequest->user_id);
            $user->first_name = $nameUpdateRequest->new_first_name;
            $user->last_name = $nameUpdateRequest->new_last_name;
            $user->name = $nameUpdateRequest->new_name;
            $user->save();

            // Update request status
            $nameUpdateRequest->status = 'approved';
            $nameUpdateRequest->admin_notes = $request->admin_notes;
            $nameUpdateRequest->reviewed_by = Auth::id();
            $nameUpdateRequest->reviewed_at = now();
            $nameUpdateRequest->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Name update request approved successfully'
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
     * Reject a name update request
     */
    public function rejectRequest(Request $request, $id)
    {
        try {
            $nameUpdateRequest = NameUpdateRequest::findOrFail($id);

            if ($nameUpdateRequest->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed.'
                ], 400);
            }

            $nameUpdateRequest->status = 'rejected';
            $nameUpdateRequest->admin_notes = $request->admin_notes;
            $nameUpdateRequest->reviewed_by = Auth::id();
            $nameUpdateRequest->reviewed_at = now();
            $nameUpdateRequest->save();

            return response()->json([
                'success' => true,
                'message' => 'Name update request rejected successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject request: ' . $e->getMessage()
            ], 500);
        }
    }
}
