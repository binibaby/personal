<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\ProfileChangeRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Broadcast;

class ProfileUpdateRequestController extends Controller
{
    /**
     * Submit a profile update request
     */
    public function submitRequest(Request $request)
    {
        // Add CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        $user = Auth::user();
        
        $validator = Validator::make($request->all(), [
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'hourly_rate' => 'sometimes|numeric|min:0|max:9999999.99',
            'experience' => 'sometimes|numeric|min:0|max:100',
            'reason' => 'required|string|max:1000',
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

        // Check if user already has a pending request
        $existingRequest = ProfileChangeRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if ($existingRequest) {
            return response()->json([
                'success' => false,
                'message' => 'You already have a pending profile update request. Please wait for admin review.'
            ], 400);
        }

        // Check if user is in cooldown period
        $cooldownCheck = ProfileChangeRequest::isUserInCooldown($user->id);
        if (!$cooldownCheck['can_request']) {
            $daysRemaining = $cooldownCheck['days_remaining'];
            $cooldownEndsAt = $cooldownCheck['cooldown_ends_at']->format('M d, Y');
            
            return response()->json([
                'success' => false,
                'message' => "You cannot request profile changes for {$daysRemaining} more days. You can request changes again after {$cooldownEndsAt}.",
                'cooldown_info' => [
                    'in_cooldown' => true,
                    'days_remaining' => $daysRemaining,
                    'cooldown_ends_at' => $cooldownEndsAt
                ]
            ], 400);
        }

            // Determine which fields are being updated
            $updatedFields = [];
            $oldValues = [];
            $newValues = [];

            if ($request->has('first_name') && $request->first_name !== $user->first_name) {
                $updatedFields[] = 'first_name';
                $oldValues['first_name'] = $user->first_name;
                $newValues['first_name'] = $request->first_name;
            }

            if ($request->has('last_name') && $request->last_name !== $user->last_name) {
                $updatedFields[] = 'last_name';
                $oldValues['last_name'] = $user->last_name;
                $newValues['last_name'] = $request->last_name;
            }

            if ($request->has('phone') && $request->phone !== $user->phone) {
                $updatedFields[] = 'phone';
                $oldValues['phone'] = $user->phone;
                $newValues['phone'] = $request->phone;
            }

            if ($request->has('hourly_rate') && $request->hourly_rate != $user->hourly_rate) {
                $updatedFields[] = 'hourly_rate';
                $oldValues['hourly_rate'] = $user->hourly_rate;
                $newValues['hourly_rate'] = $request->hourly_rate;
            }

            // Check experience change - normalize values for comparison (handle null/empty)
            // Convert to numeric for proper comparison and storage
            $currentExperience = $user->experience ? (float)$user->experience : null;
            $newExperience = null;
            
            if ($request->has('experience') && $request->experience !== '' && $request->experience !== null) {
                $newExperience = (float)$request->experience;
                // Compare as numbers to handle decimal values properly
                if ($newExperience != $currentExperience) {
                    $updatedFields[] = 'experience';
                    $oldValues['experience'] = $currentExperience;
                    $newValues['experience'] = $newExperience;
                }
            }

            if (empty($updatedFields)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No changes detected. Please modify at least one field.'
                ], 400);
            }

            // Create the profile change request
            $profileRequest = ProfileChangeRequest::create([
                'user_id' => $user->id,
                'field_name' => count($updatedFields) > 1 ? 'multiple' : $updatedFields[0],
                'first_name' => $request->first_name ?? $user->first_name,
                'last_name' => $request->last_name ?? $user->last_name,
                'phone' => $request->phone ?? $user->phone,
                'hourly_rate' => $request->hourly_rate ?? $user->hourly_rate,
                'experience' => $request->has('experience') ? ($newExperience !== null ? $newExperience : null) : ($user->experience ?: null),
                'old_first_name' => $oldValues['first_name'] ?? $user->first_name,
                'old_last_name' => $oldValues['last_name'] ?? $user->last_name,
                'old_phone' => $oldValues['phone'] ?? $user->phone,
                'old_hourly_rate' => $oldValues['hourly_rate'] ?? $user->hourly_rate,
                'old_experience' => $oldValues['experience'] ?? ($user->experience ?: null),
                'old_value' => json_encode($oldValues),
                'new_value' => json_encode($newValues),
                'reason' => $request->reason,
                'status' => 'pending',
            ]);

            // Send real-time notification to admins
            $this->notifyAdminsNewRequest($profileRequest);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Your update request has been submitted. Please wait for the admin to examine and approve your changes.',
                'request_id' => $profileRequest->id
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get user's profile update requests
     */
    public function getUserRequests(Request $request)
    {
        $user = Auth::user();
        
        $requests = ProfileChangeRequest::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'requests' => $requests
        ]);
    }

    /**
     * Check if user has pending request
     */
    public function checkPendingRequest(Request $request)
    {
        $user = Auth::user();
        
        $pendingRequest = ProfileChangeRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        // Check cooldown status
        $cooldownCheck = ProfileChangeRequest::isUserInCooldown($user->id);

        return response()->json([
            'success' => true,
            'has_pending_request' => $pendingRequest !== null,
            'request' => $pendingRequest,
            'cooldown_info' => $cooldownCheck
        ]);
    }

    /**
     * Notify admins about new profile update request
     */
    private function notifyAdminsNewRequest(ProfileChangeRequest $request)
    {
        try {
            // Get all admin users
            $admins = User::where('is_admin', true)->get();
            
            foreach ($admins as $admin) {
                // Create notification for admin
                $admin->notifications()->create([
                    'type' => 'profile_update_request',
                    'title' => 'New Profile Update Request',
                    'message' => "User {$request->user->name} has submitted a profile update request.",
                    'data' => [
                        'request_id' => $request->id,
                        'user_id' => $request->user_id,
                        'user_name' => $request->user->name,
                        'fields' => $this->getUpdatedFields($request),
                    ]
                ]);
            }

            // Broadcast real-time notification
            Broadcast::event('profile-update-request', [
                'request' => $request->load('user'),
                'message' => "New profile update request from {$request->user->name}",
                'timestamp' => now()->toISOString()
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to notify admins about profile update request: ' . $e->getMessage());
        }
    }

    /**
     * Get list of updated fields for display
     */
    private function getUpdatedFields(ProfileChangeRequest $request)
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
