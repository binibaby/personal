<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ProfileController extends Controller
{
    /**
     * Get the authenticated user's profile
     */
    public function show(Request $request)
    {
        $user = Auth::user();
        
        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->first_name . ' ' . $user->last_name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'profile_image' => $user->profile_image,
                'profile_image_url' => $user->profile_image ? (
                    str_starts_with($user->profile_image, 'http') 
                        ? $user->profile_image 
                        : asset('storage/' . $user->profile_image)
                ) : null,
                'phone' => $user->phone,
                'address' => $user->address,
                'age' => $user->age,
                'gender' => $user->gender,
                'bio' => $user->bio,
                'hourly_rate' => $user->hourly_rate,
                'experience' => $user->experience,
                'max_pets' => $user->max_pets,
                'specialties' => $user->specialties,
                'selected_pet_types' => $user->selected_pet_types,
                'pet_breeds' => $user->pet_breeds,
                'email_verified' => $user->email_verified,
                'phone_verified' => $user->phone_verified,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
            ]
        ]);
    }

    /**
     * Update the authenticated user's profile
     */
    public function update(Request $request)
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
            'name' => 'sometimes|string|max:255',
            'first_name' => 'sometimes|string|max:255',
            'last_name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|string|max:20',
            'address' => 'sometimes|string|max:500',
            'age' => 'sometimes|integer|min:1|max:120',
            'gender' => 'sometimes|string|in:male,female,other',
            'bio' => 'sometimes|string|max:1000',
            'hourly_rate' => 'sometimes|numeric|min:0|max:9999999.99',
            'experience' => 'sometimes|string|max:255',
            'specialties' => 'sometimes|array',
            'specialties.*' => 'string|max:255',
            'selected_pet_types' => 'sometimes|array',
            'selected_pet_types.*' => 'string|max:255',
            'pet_breeds' => 'sometimes|array',
            'pet_breeds.*' => 'string|max:255',
            'profile_image' => 'sometimes|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Update user profile
            if ($request->has('name')) {
                $nameParts = explode(' ', $request->name, 2);
                $user->first_name = $nameParts[0];
                $user->last_name = isset($nameParts[1]) ? $nameParts[1] : '';
            }
            
            if ($request->has('first_name')) {
                $user->first_name = $request->first_name;
            }
            
            if ($request->has('last_name')) {
                $user->last_name = $request->last_name;
            }
            
            // Update the name field if first_name or last_name changed
            if ($request->has('first_name') || $request->has('last_name')) {
                $user->name = trim($user->first_name . ' ' . $user->last_name);
            }
            
            if ($request->has('email')) {
                $user->email = $request->email;
            }
            
            if ($request->has('phone')) {
                $user->phone = $request->phone;
            }
            
            if ($request->has('address')) {
                $user->address = $request->address;
            }
            
            if ($request->has('age')) {
                $user->age = $request->age;
            }
            
            if ($request->has('gender')) {
                $user->gender = $request->gender;
            }
            
            if ($request->has('bio')) {
                $user->bio = $request->bio;
            }
            
            if ($request->has('hourly_rate')) {
                $user->hourly_rate = $request->hourly_rate;
            }
            
            if ($request->has('experience')) {
                $user->experience = $request->experience;
            }
            
            if ($request->has('specialties')) {
                $user->specialties = $request->specialties;
            }
            
            if ($request->has('selected_pet_types')) {
                $user->selected_pet_types = $request->selected_pet_types;
            }
            
            if ($request->has('pet_breeds')) {
                $user->pet_breeds = $request->pet_breeds;
            }
            
            if ($request->has('profile_image')) {
                $profileImage = $request->profile_image;
                // Clean up profile image - remove full URL if present
                if (str_starts_with($profileImage, 'http')) {
                    // Extract storage path from full URL
                    $urlParts = explode('/storage/', $profileImage);
                    if (count($urlParts) > 1) {
                        $profileImage = $urlParts[1];
                    }
                }
                $user->profile_image = $profileImage;
            }

            $user->save();

            // Clear location cache to ensure updated data is reflected
            if ($user->role === 'pet_sitter') {
                $cacheKey = "sitter_location_{$user->id}";
                $locationData = Cache::get($cacheKey);
                
                if ($locationData) {
                    // Update the cached location data with the new name
                    $locationData['name'] = $user->name;
                    $locationData['first_name'] = $user->first_name;
                    $locationData['last_name'] = $user->last_name;
                    $locationData['email'] = $user->email;
                    $locationData['bio'] = $user->bio;
                    $locationData['hourly_rate'] = $user->hourly_rate;
                    $locationData['experience'] = $user->experience;
                    $locationData['specialties'] = $user->specialties;
                    $locationData['selected_pet_types'] = $user->selected_pet_types;
                    $locationData['pet_breeds'] = $user->pet_breeds;
                    $locationData['profile_image'] = $user->profile_image;
                    $locationData['certificates'] = $user->certificates;
                    
                    // Update the cache with the new data
                    Cache::put($cacheKey, $locationData, 300); // 5 minutes
                    
                    // Also update the active sitters cache
                    $activeSitters = Cache::get('active_sitters', []);
                    foreach ($activeSitters as &$sitter) {
                        if ($sitter['user_id'] == $user->id) {
                            $sitter['name'] = $user->name;
                            $sitter['first_name'] = $user->first_name;
                            $sitter['last_name'] = $user->last_name;
                            $sitter['email'] = $user->email;
                            $sitter['bio'] = $user->bio;
                            $sitter['hourly_rate'] = $user->hourly_rate;
                            $sitter['experience'] = $user->experience;
                            $sitter['specialties'] = $user->specialties;
                            $sitter['selected_pet_types'] = $user->selected_pet_types;
                            $sitter['pet_breeds'] = $user->pet_breeds;
                            $sitter['profile_image'] = $user->profile_image;
                            $sitter['certificates'] = $user->certificates;
                            break;
                        }
                    }
                    Cache::put('active_sitters', $activeSitters, 300); // 5 minutes
                    
                    \Log::info('🔄 Updated sitter cache with new profile data', [
                        'user_id' => $user->id,
                        'old_name' => $locationData['name'] ?? 'N/A',
                        'new_name' => $user->name
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Profile updated successfully',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->first_name . ' ' . $user->last_name,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'profile_image' => $user->profile_image,
                    'profile_image_url' => $user->profile_image ? (
                        str_starts_with($user->profile_image, 'http') 
                            ? $user->profile_image 
                            : asset('storage/' . $user->profile_image)
                    ) : null,
                    'phone' => $user->phone,
                    'address' => $user->address,
                    'age' => $user->age,
                    'gender' => $user->gender,
                    'bio' => $user->bio,
                    'hourly_rate' => $user->hourly_rate,
                    'experience' => $user->experience,
                    'specialties' => $user->specialties,
                    'selected_pet_types' => $user->selected_pet_types,
                    'pet_breeds' => $user->pet_breeds,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update profile',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update only the user's bio
     */
    public function updateBio(Request $request)
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
            'bio' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user->bio = $request->bio;
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Bio updated successfully',
                'user' => [
                    'id' => $user->id,
                    'bio' => $user->bio,
                    'updated_at' => $user->updated_at,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update bio',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload profile image
     */
    public function uploadImage(Request $request)
    {
        $user = Auth::user();
        
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Delete old profile image if exists
            if ($user->profile_image && Storage::disk('public')->exists($user->profile_image)) {
                Storage::disk('public')->delete($user->profile_image);
            }

            // Store new image
            $imagePath = $request->file('image')->store('profile_images', 'public');
            
            // Update user profile image
            $user->profile_image = $imagePath;
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Profile image uploaded successfully',
                'profile_image' => $imagePath,
                'full_url' => asset('storage/' . $imagePath)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload image',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Save certificates for a sitter
     */
    public function saveCertificates(Request $request)
    {
        $user = Auth::user();
        
        // Check if certificates field exists in request (even if empty array)
        if (!$request->has('certificates')) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => ['certificates' => ['The certificates field is required.']]
            ], 422);
        }
        
        // Accept certificates as array, allowing empty arrays (for when all certificates are deleted)
        // Use 'present' instead of 'required' to allow empty arrays
        $validator = Validator::make($request->all(), [
            'certificates' => 'present|array',
        ]);

        // Only validate individual certificate fields if certificates array is not empty
        if (!empty($request->certificates) && is_array($request->certificates) && count($request->certificates) > 0) {
            $certificateValidator = Validator::make($request->all(), [
                'certificates.*.name' => 'required|string|max:255',
                'certificates.*.image' => 'required|string',
                'certificates.*.date' => 'required|string',
                'certificates.*.issuer' => 'required|string|max:255',
            ]);
            
            if ($certificateValidator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $certificateValidator->errors()
                ], 422);
            }
        }

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Update user certificates - allow empty array (when all certificates are deleted)
            // Ensure we always save as JSON, even if empty array
            $certificatesData = is_array($request->certificates) ? $request->certificates : [];
            $user->certificates = !empty($certificatesData) ? json_encode($certificatesData) : json_encode([]);
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Certificates saved successfully',
                'certificates' => $request->certificates
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save certificates',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get certificates for a sitter
     */
    public function getCertificates(Request $request)
    {
        $user = Auth::user();
        
        try {
            $certificates = $user->certificates ? json_decode($user->certificates, true) : [];

            return response()->json([
                'success' => true,
                'certificates' => $certificates
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get certificates',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload certificate image to server
     */
    public function uploadCertificateImage(Request $request)
    {
        $user = Auth::user();
        
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120', // 5MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Store certificate image
            $imagePath = $request->file('image')->store('certificate_images', 'public');
            
            return response()->json([
                'success' => true,
                'message' => 'Certificate image uploaded successfully',
                'image_path' => $imagePath,
                'full_url' => asset('storage/' . $imagePath)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload certificate image',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}