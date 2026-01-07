<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WeeklyAvailability;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    /**
     * Update pet sitter location
     */
    public function updateLocation(Request $request)
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

        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'address' => 'nullable|string|max:500',
            'is_online' => 'boolean',
        ]);

        $user = $request->user();
        
        if (!$user || $user->role !== 'pet_sitter') {
            return response()->json([
                'success' => false,
                'message' => 'Only pet sitters can share their location'
            ], 403);
        }

        // Generate address from coordinates if not provided
        $address = $request->address;
        if (!$address) {
            $address = $this->generateAddressFromCoordinates($request->latitude, $request->longitude);
        }

        $locationData = [
            'user_id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'address' => $address,
            'specialties' => $user->specialties ?: ['General Pet Care'],
            'experience' => $user->experience ?: '1 year',
            'pet_types' => $user->selected_pet_types ?: ['dogs', 'cats'],
            'selected_breeds' => $user->pet_breeds ? $this->formatBreedNames($user->pet_breeds) : ['All breeds welcome'],
            'hourly_rate' => $user->hourly_rate ?: 25,
            'rating' => 4.5, // Default rating
            'reviews' => 0, // Default reviews
            'bio' => $user->bio ?: 'Professional pet sitter ready to help!',
            'is_online' => $request->boolean('is_online', true),
            'last_seen' => now()->toISOString(),
            'updated_at' => now()->toISOString(),
            'profile_image' => $user->profile_image,
            'followers' => $user->followers ?? 0,
            'following' => $user->following ?? 0,
        ];

        // Store location data in cache with 5-minute expiration
        $cacheKey = "sitter_location_{$user->id}";
        Cache::put($cacheKey, $locationData, 300); // 5 minutes

        // Also store in a global sitters list (only if online)
        $sittersKey = 'active_sitters';
        $activeSitters = Cache::get($sittersKey, []);
        
        if ($locationData['is_online']) {
            // Only add to active sitters if online
            $activeSitters[$user->id] = $locationData;
        } else {
            // Remove from active sitters if offline
            unset($activeSitters[$user->id]);
        }
        
        Cache::put($sittersKey, $activeSitters, 300);

        Log::info('📍 Pet sitter location updated', [
            'user_id' => $user->id,
            'name' => $user->name,
            'location' => [
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                'address' => $request->address
            ],
            'is_online' => $request->boolean('is_online', true)
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Location updated successfully',
            'location' => $locationData
        ]);
    }

    /**
     * Get nearby pet sitters
     */
    public function getNearbySitters(Request $request)
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

        $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius_km' => 'nullable|numeric|min:0.1|max:50',
        ]);

        $userLat = $request->latitude;
        $userLon = $request->longitude;
        $radiusKm = $request->input('radius_km', 2);

        // Get all active sitters from cache
        $sittersKey = 'active_sitters';
        $activeSitters = Cache::get($sittersKey, []);
        
        // Debug logging for cached sitter data
        \Log::info('🔍 LocationController - Cached sitters found:', [
            'count' => count($activeSitters),
            'sitters' => array_map(function($sitter) {
                return [
                    'user_id' => $sitter['user_id'] ?? 'N/A',
                    'name' => $sitter['name'] ?? 'N/A',
                    'is_online' => $sitter['is_online'] ?? false
                ];
            }, $activeSitters)
        ]);

        $nearbySitters = [];
        $addedSitterIds = []; // Track added sitter IDs to prevent duplicates

        foreach ($activeSitters as $sitterData) {
            if (!$sitterData['is_online']) continue;

            // Skip if we've already added this sitter
            if (in_array($sitterData['user_id'], $addedSitterIds)) {
                continue;
            }

            $distance = $this->calculateDistance(
                $userLat,
                $userLon,
                $sitterData['latitude'],
                $sitterData['longitude']
            );

            if ($distance <= $radiusKm) {
                // Get latest user data from database to ensure we have the most up-to-date profile
                $user = User::find($sitterData['user_id']);
                
                // Skip suspended or banned users - they should not appear in find sitter map
                if ($user && ($user->status === 'suspended' || $user->status === 'banned')) {
                    continue;
                }
                
                // Debug logging for user lookup
                \Log::info('🔍 LocationController - User lookup debug:', [
                    'sitter_user_id' => $sitterData['user_id'],
                    'user_found' => $user ? 'YES' : 'NO',
                    'user_status' => $user ? $user->status : 'N/A',
                    'user_profile_image' => $user ? $user->profile_image : 'N/A',
                    'user_name' => $user ? $user->name : 'N/A'
                ]);
                
                // Get verification status for the sitter
                $verification = $user ? $user->verifications()->where('verification_status', 'approved')->first() : null;
                $isVerified = $verification ? true : false;
                $verificationStatus = $verification ? $verification->verification_status : 'pending';
                $isLegitSitter = $verification ? $verification->is_legit_sitter : false;

                // Get actual rating from database (same as popup uses)
                $actualRating = $user ? $user->getAverageRating() : ($sitterData['rating'] ?? 0);
                $actualReviews = $user ? $user->reviews()->count() : ($sitterData['reviews'] ?? 0);

                // Use database data if available, otherwise fallback to cached data
                $sitterInfo = $user ? [
                    'id' => $sitterData['user_id'],
                    'userId' => $sitterData['user_id'],
                    'name' => $user->name ?: $sitterData['name'],
                    'email' => $user->email ?: $sitterData['email'],
                    'location' => [
                        'latitude' => $sitterData['latitude'],
                        'longitude' => $sitterData['longitude'],
                        'address' => $sitterData['address'],
                    ],
                    'specialties' => $user->specialties ?: $sitterData['specialties'],
                    'experience' => $user->experience ?: $sitterData['experience'],
                    'petTypes' => $user->selected_pet_types ?: $sitterData['pet_types'],
                    'selectedBreeds' => ($user->pet_breeds && count($user->pet_breeds) > 0) ? $this->formatBreedNames($user->pet_breeds) : $this->formatBreedNames($sitterData['selected_breeds']),
                    'hourlyRate' => $user->hourly_rate ?: $sitterData['hourly_rate'],
                    'maxPets' => $user->max_pets ?? $sitterData['max_pets'] ?? 10,
                    'rating' => $actualRating, // Use actual rating from database
                    'reviews' => $actualReviews, // Use actual review count from database
                    'bio' => $user->bio ?: $sitterData['bio'],
                    'isOnline' => $sitterData['is_online'],
                    'lastSeen' => $sitterData['last_seen'],
                    'distance' => round($distance, 1) . ' km',
                    'profile_image' => $user->profile_image,
                    'profile_image_url' => $user->profile_image ? (
                        str_starts_with($user->profile_image, 'http') 
                            ? $user->profile_image 
                            : asset('storage/' . $user->profile_image)
                    ) : null,
                    'images' => $user->profile_image ? [$user->profile_image] : null,
                    'certificates' => $user->certificates ? json_decode($user->certificates, true) : [],
                    'followers' => $user->followers ?? 0,
                    'following' => $user->following ?? 0,
                    // Verification status
                    'isVerified' => $isVerified,
                    'verificationStatus' => $verificationStatus,
                    'isLegitSitter' => $isLegitSitter
                ] : [
                    'id' => $sitterData['user_id'],
                    'userId' => $sitterData['user_id'],
                    'name' => $sitterData['name'],
                    'email' => $sitterData['email'],
                    'location' => [
                        'latitude' => $sitterData['latitude'],
                        'longitude' => $sitterData['longitude'],
                        'address' => $sitterData['address'],
                    ],
                    'specialties' => $sitterData['specialties'],
                    'experience' => $sitterData['experience'],
                    'petTypes' => $sitterData['pet_types'],
                    'selectedBreeds' => ($sitterData['selected_breeds'] && count($sitterData['selected_breeds']) > 0) ? $this->formatBreedNames($sitterData['selected_breeds']) : ['All breeds welcome'],
                    'hourlyRate' => $sitterData['hourly_rate'],
                    'maxPets' => $sitterData['max_pets'] ?? 10,
                    'rating' => $sitterData['rating'] ?? 0, // Fallback to cached rating if available
                    'reviews' => $sitterData['reviews'] ?? 0, // Fallback to cached review count if available
                    'bio' => $sitterData['bio'],
                    'isOnline' => $sitterData['is_online'],
                    'lastSeen' => $sitterData['last_seen'],
                    'distance' => round($distance, 1) . ' km',
                    'profile_image' => null,
                    'images' => null,
                    'certificates' => [],
                    'followers' => 0,
                    'following' => 0,
                    // Verification status - default to not verified for cached data
                    'isVerified' => false,
                    'verificationStatus' => 'pending',
                    'isLegitSitter' => false
                ];

                $nearbySitters[] = $sitterInfo;
                $addedSitterIds[] = $sitterData['user_id']; // Mark this sitter as added
            }
        }

        // Sort by distance
        usort($nearbySitters, function($a, $b) {
            $distA = floatval(str_replace(' km', '', $a['distance']));
            $distB = floatval(str_replace(' km', '', $b['distance']));
            return $distA <=> $distB;
        });

        Log::info('🔍 Nearby sitters requested', [
            'user_location' => ['latitude' => $userLat, 'longitude' => $userLon],
            'radius_km' => $radiusKm,
            'found_sitters' => count($nearbySitters)
        ]);

        return response()->json([
            'success' => true,
            'sitters' => $nearbySitters,
            'count' => count($nearbySitters),
            'radius_km' => $radiusKm
        ]);
    }

    /**
     * Update sitter status (alias for setOnlineStatus)
     */
    public function updateStatus(Request $request)
    {
        return $this->setOnlineStatus($request);
    }

    /**
     * Set sitter online/offline status
     */
    public function setOnlineStatus(Request $request)
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

        $request->validate([
            'is_online' => 'required|boolean',
        ]);

        $user = $request->user();
        
        if (!$user || $user->role !== 'pet_sitter') {
            return response()->json([
                'success' => false,
                'message' => 'Only pet sitters can update their status'
            ], 403);
        }

        $isOnline = $request->boolean('is_online');

        // Update the sitter's online status in cache
        $cacheKey = "sitter_location_{$user->id}";
        $locationData = Cache::get($cacheKey);
        
        if ($locationData) {
            $locationData['is_online'] = $isOnline;
            $locationData['last_seen'] = now()->toISOString();
            $locationData['updated_at'] = now()->toISOString();
            
            // Ensure profile image is included
            if (!isset($locationData['profile_image'])) {
                $locationData['profile_image'] = $user->profile_image;
            }
            
            Cache::put($cacheKey, $locationData, 300);
            
            // Update in global sitters list
            $sittersKey = 'active_sitters';
            $activeSitters = Cache::get($sittersKey, []);
            
            if ($isOnline) {
                // If going online, add/update in active sitters list
                $activeSitters[$user->id] = $locationData;
                
                // When sitter comes online, restore their availability data from database/local storage
                $this->restoreSitterAvailabilityData($user->id);
            } else {
                // If going offline, remove from active sitters list entirely
                unset($activeSitters[$user->id]);
                
                // Also clear availability data when going offline
                $availabilityKey = "sitter_availability_{$user->id}";
                $weeklyAvailabilityKey = "sitter_weekly_availability_{$user->id}";
                Cache::forget($availabilityKey);
                Cache::forget($weeklyAvailabilityKey);
                
                Log::info('🧹 Cleared availability data for offline sitter', [
                    'user_id' => $user->id,
                    'availability_key' => $availabilityKey,
                    'weekly_availability_key' => $weeklyAvailabilityKey
                ]);
            }
            
            Cache::put($sittersKey, $activeSitters, 300);
        }

        Log::info('👤 Pet sitter status updated', [
            'user_id' => $user->id,
            'name' => $user->name,
            'is_online' => $isOnline
        ]);

        return response()->json([
            'success' => true,
            'message' => $isOnline ? 'Now online' : 'Now offline',
            'is_online' => $isOnline
        ]);
    }

    /**
     * Get sitter availability
     */
    public function getSitterAvailability(Request $request, $sitterId)
    {
        // Set CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        try {
            // Get real availability from cache (stored when sitter sets availability)
            $availabilityKey = "sitter_availability_{$sitterId}";
            $availabilityData = Cache::get($availabilityKey, []);
            
            // Convert to the expected format
            $availabilities = [];
            foreach ($availabilityData as $date => $timeRanges) {
                $availabilities[] = [
                    'date' => $date,
                    'timeRanges' => $timeRanges
                ];
            }

            // Sort by date
            usort($availabilities, function($a, $b) {
                return strcmp($a['date'], $b['date']);
            });

            Log::info('📅 Sitter availability requested', [
                'sitter_id' => $sitterId,
                'availability_count' => count($availabilities),
                'raw_data' => $availabilityData
            ]);

            return response()->json([
                'success' => true,
                'availabilities' => $availabilities,
                'sitter_id' => $sitterId
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error getting sitter availability', [
                'sitter_id' => $sitterId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get sitter availability',
                'availabilities' => []
            ], 500);
        }
    }

    /**
     * Save sitter availability
     */
    public function saveSitterAvailability(Request $request)
    {
        // Set CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        $user = $request->user();
        
        if (!$user || $user->role !== 'pet_sitter') {
            return response()->json([
                'success' => false,
                'message' => 'Only pet sitters can save availability'
            ], 403);
        }

        $request->validate([
            'availabilities' => 'required|array',
            'availabilities.*.date' => 'required|date',
            'availabilities.*.timeRanges' => 'required|array',
            'availabilities.*.timeRanges.*.startTime' => 'required|string',
            'availabilities.*.timeRanges.*.endTime' => 'required|string',
        ]);

        try {
            $availabilities = $request->input('availabilities');
            
            // Convert array format to key-value format for storage
            $availabilityData = [];
            foreach ($availabilities as $availability) {
                $availabilityData[$availability['date']] = $availability['timeRanges'];
            }

            // Store in cache
            $availabilityKey = "sitter_availability_{$user->id}";
            Cache::put($availabilityKey, $availabilityData, 86400 * 30); // Store for 30 days

            Log::info('📅 Sitter availability saved', [
                'user_id' => $user->id,
                'name' => $user->name,
                'availability_count' => count($availabilityData)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Availability saved successfully',
                'availabilities' => $availabilities
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error saving sitter availability', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save availability'
            ], 500);
        }
    }

    /**
     * Generate address from coordinates
     */
    private function generateAddressFromCoordinates($latitude, $longitude)
    {
        try {
            // Use a simple reverse geocoding approach
            // For now, return coordinates as a readable format
            return number_format($latitude, 4) . ', ' . number_format($longitude, 4);
        } catch (\Exception $e) {
            Log::error('Failed to generate address from coordinates: ' . $e->getMessage());
            return number_format($latitude, 4) . ', ' . number_format($longitude, 4);
        }
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        $R = 6371; // Earth's radius in kilometers
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat/2) * sin($dLat/2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2) * sin($dLon/2);
        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        $distance = $R * $c; // Distance in kilometers
        return $distance;
    }

    /**
     * Convert breed IDs to readable names
     */
    private function formatBreedNames($breeds)
    {
        if (!$breeds || !is_array($breeds)) {
            return $breeds;
        }

        $breedMapping = [
            // Dog breeds
            'labrador' => 'Labrador Retriever',
            'golden' => 'Golden Retriever',
            'german-shepherd' => 'German Shepherd',
            'bulldog' => 'Bulldog',
            'beagle' => 'Beagle',
            'poodle' => 'Poodle',
            'rottweiler' => 'Rottweiler',
            'yorkshire' => 'Yorkshire Terrier',
            'boxer' => 'Boxer',
            'dachshund' => 'Dachshund',
            // Cat breeds
            'persian' => 'Persian',
            'siamese' => 'Siamese',
            'maine-coon' => 'Maine Coon',
            'ragdoll' => 'Ragdoll',
            'british-shorthair' => 'British Shorthair',
            'abyssinian' => 'Abyssinian',
            'russian-blue' => 'Russian Blue',
            'bengal' => 'Bengal',
            'sphynx' => 'Sphynx',
            'scottish-fold' => 'Scottish Fold',
        ];

        return array_map(function($breed) use ($breedMapping) {
            // If we have a mapping for this ID, use the readable name
            if (isset($breedMapping[$breed])) {
                return $breedMapping[$breed];
            }
            // Otherwise, return the original value (it might already be a readable name)
            return $breed;
        }, $breeds);
    }

    /**
     * Convert 12-hour time format to 24-hour format for comparison
     */
    private function convertTo24Hour($timeString)
    {
        // Clean the time string - remove extra spaces and normalize
        $timeString = trim($timeString);
        
        Log::info('🕐 Converting time string', [
            'original' => $timeString,
            'cleaned' => $timeString,
            'length' => strlen($timeString)
        ]);
        
        // Try to parse using DateTime for more reliable parsing
        try {
            // Handle 12-hour format with AM/PM
            $time = \DateTime::createFromFormat('g:i A', $timeString);
            if ($time === false) {
                // Try alternative format
                $time = \DateTime::createFromFormat('h:i A', $timeString);
            }
            
            if ($time !== false) {
                $hour = (int)$time->format('H');
                $minute = (int)$time->format('i');
                $result = $hour * 60 + $minute;
                
                Log::info('🕐 DateTime parsing successful', [
                    'hour' => $hour,
                    'minute' => $minute,
                    'resultMinutes' => $result
                ]);
                
                return $result;
            }
        } catch (Exception $e) {
            Log::warning('🕐 DateTime parsing failed', [
                'error' => $e->getMessage(),
                'timeString' => $timeString
            ]);
        }
        
        // Fallback to regex parsing
        if (preg_match('/(\d{1,2}):(\d{2})\s*(AM|PM)/i', $timeString, $matches)) {
            $hour = (int)$matches[1];
            $minute = (int)$matches[2];
            $period = strtoupper(trim($matches[3]));
            
            Log::info('🕐 Regex 12-hour format matched', [
                'hour' => $hour,
                'minute' => $minute,
                'period' => $period
            ]);
            
            if ($period === 'PM' && $hour !== 12) {
                $hour += 12;
            } elseif ($period === 'AM' && $hour === 12) {
                $hour = 0;
            }
            
            $result = $hour * 60 + $minute;
            Log::info('🕐 Regex conversion result', [
                'finalHour' => $hour,
                'resultMinutes' => $result
            ]);
            
            return $result;
        }
        
        // If already in 24-hour format (HH:MM)
        if (preg_match('/(\d{1,2}):(\d{2})/', $timeString, $matches)) {
            $hour = (int)$matches[1];
            $minute = (int)$matches[2];
            $result = $hour * 60 + $minute;
            
            Log::info('🕐 24-hour format matched', [
                'hour' => $hour,
                'minute' => $minute,
                'resultMinutes' => $result
            ]);
            
            return $result;
        }
        
        Log::warning('🕐 No time format matched', [
            'timeString' => $timeString
        ]);
        
        return 0; // Default fallback
    }

    /**
     * Convert minutes since midnight back to time format for debugging
     */
    private function formatMinutesToTime($minutes)
    {
        $hours = floor($minutes / 60);
        $mins = $minutes % 60;
        return sprintf('%02d:%02d', $hours, $mins);
    }

    /**
     * Get weekly availability for a sitter
     */
    public function getWeeklyAvailability($sitterId)
    {
        try {
            // Get from database
            $availabilities = WeeklyAvailability::where('sitter_id', $sitterId)
                ->orderBy('start_date', 'asc')
                ->get()
                ->map(function ($availability) {
                    return [
                        'id' => $availability->id,
                        'weekId' => $availability->week_id,
                        'startDate' => $availability->start_date->format('Y-m-d'),
                        'endDate' => $availability->end_date->format('Y-m-d'),
                        'startTime' => $availability->start_time->format('H:i'),
                        'endTime' => $availability->end_time->format('H:i'),
                        'isWeekly' => $availability->is_weekly,
                        'createdAt' => $availability->created_at->toISOString()
                    ];
                })
                ->toArray();

            Log::info('📅 Weekly availability requested for sitter', [
                'sitter_id' => $sitterId,
                'availabilities_count' => count($availabilities)
            ]);

            return response()->json([
                'success' => true,
                'availabilities' => $availabilities
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting weekly availability: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get weekly availability: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Save weekly availability for a sitter
     */
    public function saveWeeklyAvailability(Request $request)
    {
        try {
            $user = Auth::user();
            
            if (!$user || $user->role !== 'pet_sitter') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only pet sitters can save availability'
                ], 403);
            }

            $request->validate([
                'availabilities' => 'required|array',
                'availabilities.*.weekId' => 'required|string',
                'availabilities.*.startDate' => 'required|date',
                'availabilities.*.endDate' => 'required|date|after_or_equal:availabilities.*.startDate',
                'availabilities.*.startTime' => 'required|string',
                'availabilities.*.endTime' => 'required|string',
                'availabilities.*.isWeekly' => 'required|boolean'
            ]);

            // Custom validation for time comparison
            foreach ($request->availabilities as $index => $availability) {
                $startTime = $availability['startTime'];
                $endTime = $availability['endTime'];
                
                // Convert time strings to comparable format
                $startTime24 = $this->convertTo24Hour($startTime);
                $endTime24 = $this->convertTo24Hour($endTime);
                
                Log::info('🕐 Time validation debug', [
                    'index' => $index,
                    'startTime' => $startTime,
                    'endTime' => $endTime,
                    'startTime24' => $startTime24,
                    'endTime24' => $endTime24,
                    'startTime24_formatted' => $this->formatMinutesToTime($startTime24),
                    'endTime24_formatted' => $this->formatMinutesToTime($endTime24),
                    'isValid' => $startTime24 < $endTime24
                ]);
                
                if ($startTime24 >= $endTime24) {
                    return response()->json([
                        'success' => false,
                        'message' => "The end time must be after the start time for availability {$index}. Start: {$startTime} ({$this->formatMinutesToTime($startTime24)}), End: {$endTime} ({$this->formatMinutesToTime($endTime24)})"
                    ], 422);
                }
            }

            $availabilities = $request->availabilities;
            $sitterId = $user->id;

            // Clear existing weekly availability for this sitter
            WeeklyAvailability::where('sitter_id', $sitterId)->delete();

            // Store weekly availability in database
            $savedAvailabilities = [];
            foreach ($availabilities as $availability) {
                $savedAvailability = WeeklyAvailability::create([
                    'sitter_id' => $sitterId,
                    'week_id' => $availability['weekId'],
                    'start_date' => $availability['startDate'],
                    'end_date' => $availability['endDate'],
                    'start_time' => $availability['startTime'],
                    'end_time' => $availability['endTime'],
                    'is_weekly' => $availability['isWeekly']
                ]);
                $savedAvailabilities[] = $savedAvailability;
            }

            // Also update cache for faster access
            $cacheKey = "sitter_weekly_availability_{$sitterId}";
            Cache::put($cacheKey, $availabilities, now()->addDays(30));

            Log::info('📅 Weekly availability saved for sitter', [
                'sitter_id' => $sitterId,
                'availabilities_count' => count($savedAvailabilities)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Weekly availability saved successfully',
                'availabilities' => $availabilities
            ]);

        } catch (\Exception $e) {
            Log::error('Error saving weekly availability: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save weekly availability: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get sitter's availability status (online/offline)
     */
    public function getSitterAvailabilityStatus($sitterId)
    {
        try {
            // Add CORS headers
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
            header('Access-Control-Allow-Credentials: true');
            
            // Handle preflight OPTIONS request
            if (request()->isMethod('OPTIONS')) {
                return response()->json(['success' => true], 200);
            }

            // Check if sitter exists
            $sitter = User::where('id', $sitterId)
                ->where('role', 'pet_sitter')
                ->first();

            if (!$sitter) {
                return response()->json([
                    'success' => false,
                    'message' => 'Sitter not found'
                ], 404);
            }

            // Check if sitter is online by looking at the cache
            $cacheKey = "sitter_location_{$sitterId}";
            $locationData = Cache::get($cacheKey);

            $isOnline = false;
            if ($locationData) {
                // Check if the location data is recent (within last 5 minutes)
                $lastUpdate = $locationData['updated_at'] ?? null;
                if ($lastUpdate) {
                    $lastUpdateTime = \Carbon\Carbon::parse($lastUpdate);
                    $isOnline = $lastUpdateTime->isAfter(now()->subMinutes(5));
                }
            }

            Log::info('📊 Sitter availability status checked', [
                'sitter_id' => $sitterId,
                'is_online' => $isOnline,
                'has_location_data' => !is_null($locationData)
            ]);

            return response()->json([
                'success' => true,
                'is_online' => $isOnline,
                'sitter_id' => $sitterId,
                'checked_at' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting sitter availability status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get sitter availability status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restore availability data endpoint (called by frontend)
     */
    public function restoreAvailabilityData(Request $request)
    {
        // Set CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        $user = $request->user();
        
        if (!$user || $user->role !== 'pet_sitter') {
            return response()->json([
                'success' => false,
                'message' => 'Only pet sitters can restore availability data'
            ], 403);
        }

        $request->validate([
            'availabilities' => 'nullable|array',
            'availabilities.*.date' => 'required|date',
            'availabilities.*.timeRanges' => 'required|array',
            'availabilities.*.timeRanges.*.startTime' => 'required|string',
            'availabilities.*.timeRanges.*.endTime' => 'required|string',
        ]);

        try {
            $availabilities = $request->input('availabilities', []);
            
            // Convert array format to key-value format for storage
            $availabilityData = [];
            foreach ($availabilities as $availability) {
                $availabilityData[$availability['date']] = $availability['timeRanges'];
            }

            // Store in cache
            $availabilityKey = "sitter_availability_{$user->id}";
            Cache::put($availabilityKey, $availabilityData, 86400 * 30); // Store for 30 days

            Log::info('📅 Availability data restored for sitter', [
                'user_id' => $user->id,
                'name' => $user->name,
                'availability_count' => count($availabilityData)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Availability data restored successfully',
                'availabilities' => $availabilities
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error restoring availability data', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to restore availability data'
            ], 500);
        }
    }

    /**
     * Restore sitter availability data when they come online
     */
    private function restoreSitterAvailabilityData($sitterId)
    {
        try {
            Log::info('🔄 Restoring availability data for online sitter', [
                'sitter_id' => $sitterId
            ]);

            // Try to restore from weekly availability database first (more persistent)
            $weeklyAvailabilities = WeeklyAvailability::where('sitter_id', $sitterId)
                ->orderBy('start_date', 'asc')
                ->get();

            if ($weeklyAvailabilities->count() > 0) {
                // Convert weekly availability to daily availability format
                $availabilityData = [];
                
                foreach ($weeklyAvailabilities as $weekly) {
                    // Generate daily availability for each day in the weekly range
                    $startDate = \Carbon\Carbon::parse($weekly->start_date);
                    $endDate = \Carbon\Carbon::parse($weekly->end_date);
                    
                    $currentDate = $startDate->copy();
                    while ($currentDate->lte($endDate)) {
                        $dateString = $currentDate->format('Y-m-d');
                        
                        // Only add future dates (not past dates)
                        if ($currentDate->isFuture() || $currentDate->isToday()) {
                            $availabilityData[$dateString] = [
                                [
                                    'id' => "weekly-{$weekly->id}-{$dateString}",
                                    'startTime' => $weekly->start_time->format('g:i A'),
                                    'endTime' => $weekly->end_time->format('g:i A')
                                ]
                            ];
                        }
                        
                        $currentDate->addDay();
                    }
                }
                
                // Store in cache
                $availabilityKey = "sitter_availability_{$sitterId}";
                Cache::put($availabilityKey, $availabilityData, 86400 * 30); // Store for 30 days
                
                Log::info('✅ Restored weekly availability data for sitter', [
                    'sitter_id' => $sitterId,
                    'availability_count' => count($availabilityData)
                ]);
            } else {
                // If no weekly availability, try to restore from any existing cache
                // This handles cases where availability was set but not saved to database
                $availabilityKey = "sitter_availability_{$sitterId}";
                $existingData = Cache::get($availabilityKey, []);
                
                if (empty($existingData)) {
                    Log::info('ℹ️ No availability data to restore for sitter', [
                        'sitter_id' => $sitterId
                    ]);
                } else {
                    Log::info('✅ Restored existing availability data for sitter', [
                        'sitter_id' => $sitterId,
                        'availability_count' => count($existingData)
                    ]);
                }
            }

        } catch (\Exception $e) {
            Log::error('❌ Error restoring sitter availability data', [
                'sitter_id' => $sitterId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Mark availability as full for a specific date
     */
    public function markAvailabilityAsFull(Request $request)
    {
        // Set CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        $user = $request->user();
        
        if (!$user || $user->role !== 'pet_sitter') {
            return response()->json([
                'success' => false,
                'message' => 'Only pet sitters can mark availability as full'
            ], 403);
        }

        $request->validate([
            'date' => 'required|date',
            'is_full' => 'required|boolean'
        ]);

        try {
            $date = $request->input('date');
            $isFull = $request->input('is_full');

            // Store the full status in cache with a specific key
            $fullStatusKey = "sitter_availability_full_{$user->id}_{$date}";
            
            // Debug: Log the cache key creation
            Log::info('🔍 DATE_FULL cache key creation:', [
                'user_id' => $user->id,
                'date' => $date,
                'cache_key' => $fullStatusKey,
                'is_full' => $isFull
            ]);
            
            if ($isFull) {
                Cache::put($fullStatusKey, [
                    'date' => $date,
                    'is_full' => true,
                    'marked_at' => now()->toISOString(),
                    'sitter_id' => $user->id,
                    'sitter_name' => $user->name
                ], 86400 * 7); // Store for 7 days

                Log::info('📝 Availability marked as full', [
                    'sitter_id' => $user->id,
                    'sitter_name' => $user->name,
                    'date' => $date
                ]);

                // Send notifications to pet owners who might be interested
                $this->notifyPetOwnersAvailabilityFull($user, $date);

            } else {
                // Remove the full status
                Cache::forget($fullStatusKey);
                
                Log::info('📝 Availability full status removed', [
                    'sitter_id' => $user->id,
                    'sitter_name' => $user->name,
                    'date' => $date
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => $isFull ? 'Availability marked as full successfully' : 'Availability full status removed successfully',
                'date' => $date,
                'is_full' => $isFull
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error marking availability as full', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to mark availability as full'
            ], 500);
        }
    }

    /**
     * Check if a specific date is marked as full for a sitter
     */
    public function checkDateFull(Request $request, $sitterId, $date)
    {
        // Set CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        
        // Handle preflight OPTIONS request
        if ($request->isMethod('OPTIONS')) {
            return response()->json(['success' => true], 200);
        }

        try {
            // Validate the date format
            $parsedDate = \Carbon\Carbon::parse($date);
            
            // Check if the sitter has marked this date as full
            $fullStatusKey = "sitter_availability_full_{$sitterId}_{$date}";
            $isMarkedAsFull = Cache::has($fullStatusKey);
            
            // Debug: Log all cache keys to see what's available
            $allKeys = Cache::getStore()->getRedis()->keys('*sitter_availability_full*');
            Log::info('🔍 All full status cache keys:', $allKeys);
            
            Log::info('🔍 Checking date full status', [
                'sitter_id' => $sitterId,
                'date' => $date,
                'is_full' => $isMarkedAsFull
            ]);

            return response()->json([
                'success' => true,
                'is_full' => $isMarkedAsFull,
                'date' => $date,
                'sitter_id' => $sitterId
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error checking date full status', [
                'sitter_id' => $sitterId,
                'date' => $date,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to check date full status',
                'is_full' => false
            ], 500);
        }
    }

    /**
     * Notify pet owners when availability is marked as full
     */
    private function notifyPetOwnersAvailabilityFull($sitter, $date)
    {
        try {
            // Get all pet owners who have shown interest in this sitter
            // For now, we'll get all pet owners, but in a real app you'd filter by:
            // - Users who have viewed this sitter's profile
            // - Users who have this sitter in their favorites
            // - Users who have previously booked with this sitter
            
            $petOwners = \App\Models\User::where('role', 'pet_owner')
                ->where('id', '!=', $sitter->id)
                ->get();

            $dateFormatted = \Carbon\Carbon::parse($date)->format('M j, Y');
            
            foreach ($petOwners as $petOwner) {
                // Store notification in database
                \App\Models\Notification::create([
                    'user_id' => $petOwner->id,
                    'type' => 'availability_full',
                    'title' => 'Sitter Availability Update',
                    'message' => "{$sitter->name} has marked {$dateFormatted} as full and is no longer accepting new bookings for that day.",
                    'data' => json_encode([
                        'sitter_id' => $sitter->id,
                        'sitter_name' => $sitter->name,
                        'date' => $date,
                        'date_formatted' => $dateFormatted
                    ]),
                    'is_read' => false
                ]);

                // Send real-time notification via WebSocket/Pusher
                try {
                    broadcast(new \App\Events\NotificationSent([
                        'user_id' => $petOwner->id,
                        'type' => 'availability_full',
                        'title' => 'Sitter Availability Update',
                        'message' => "{$sitter->name} has marked {$dateFormatted} as full and is no longer accepting new bookings for that day.",
                        'data' => [
                            'sitter_id' => $sitter->id,
                            'sitter_name' => $sitter->name,
                            'date' => $date,
                            'date_formatted' => $dateFormatted
                        ]
                    ]));
                } catch (\Exception $e) {
                    Log::error('Failed to send real-time notification for availability full', [
                        'user_id' => $petOwner->id,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            Log::info('📢 Notifications sent for availability full', [
                'sitter_id' => $sitter->id,
                'date' => $date,
                'notifications_sent' => $petOwners->count()
            ]);

        } catch (\Exception $e) {
            Log::error('❌ Error sending availability full notifications', [
                'sitter_id' => $sitter->id,
                'date' => $date,
                'error' => $e->getMessage()
            ]);
        }
    }
}
