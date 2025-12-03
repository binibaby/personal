<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileChangeRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'field_name',
        'first_name',
        'last_name',
        'phone',
        'hourly_rate',
        'experience',
        'bio',
        'specialties',
        'old_value',
        'new_value',
        'old_first_name',
        'old_last_name',
        'old_phone',
        'old_hourly_rate',
        'old_experience',
        'old_bio',
        'old_specialties',
        'reason',
        'status',
        'admin_notes',
        'reviewed_by',
        'reviewed_at',
        'last_approved_at',
        'cooldown_days',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'last_approved_at' => 'datetime',
        'hourly_rate' => 'decimal:2',
        'old_hourly_rate' => 'decimal:2',
        'experience' => 'decimal:1',
        'old_experience' => 'decimal:1',
    ];

    // Relationships
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    // Helper methods
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    public function getFieldDisplayName(): string
    {
        return match($this->field_name) {
            'name' => 'Full Name',
            'first_name' => 'First Name',
            'last_name' => 'Last Name',
            'address' => 'Address',
            'phone' => 'Phone Number',
            'hourly_rate' => 'Hourly Rate',
            'experience' => 'Experience',
            'bio' => 'Bio',
            'specialties' => 'Services',
            'multiple' => 'Multiple Fields',
            default => ucfirst($this->field_name)
        };
    }

    /**
     * Check if user is in cooldown period
     */
    public static function isUserInCooldown($userId): array
    {
        $lastApprovedRequest = self::where('user_id', $userId)
            ->where('status', 'approved')
            ->whereNotNull('last_approved_at')
            ->orderBy('last_approved_at', 'desc')
            ->first();

        if (!$lastApprovedRequest) {
            return ['in_cooldown' => false, 'can_request' => true];
        }

        $cooldownDays = $lastApprovedRequest->cooldown_days ?? 14;
        $cooldownEnd = $lastApprovedRequest->last_approved_at->addDays($cooldownDays);
        $now = now();

        if ($now->isBefore($cooldownEnd)) {
            $daysRemaining = $now->diffInDays($cooldownEnd, false);
            return [
                'in_cooldown' => true,
                'can_request' => false,
                'days_remaining' => $daysRemaining,
                'cooldown_ends_at' => $cooldownEnd
            ];
        }

        return ['in_cooldown' => false, 'can_request' => true];
    }

    public function getStatusBadgeColor(): string
    {
        return match($this->status) {
            'pending' => 'warning',
            'approved' => 'success',
            'rejected' => 'danger',
            default => 'secondary'
        };
    }
}