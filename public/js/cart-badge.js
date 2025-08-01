// Cart Badge Management
class CartBadge {
    constructor() {
        this.badge = document.getElementById('cart-count-badge');
        this.init();
    }

    init() {
        // Load cart count when page loads
        this.updateCartCount();
        
        // Set up periodic refresh (optional - every 30 seconds)
        setInterval(() => {
            this.updateCartCount();
        }, 30000);
    }

    async updateCartCount() {
        try {
            const response = await fetch('/cart/count', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.setBadgeCount(data.count);
            } else {
                console.error('Failed to get cart count:', data.message);
                this.setBadgeCount(0);
            }
        } catch (error) {
            console.error('Error fetching cart count:', error);
            // Don't show badge if there's an error (user might not be logged in)
            this.setBadgeCount(0);
        }
    }

    setBadgeCount(count) {
        if (!this.badge) return;

        const numCount = parseInt(count) || 0;
        
        if (numCount > 0) {
            this.badge.textContent = numCount > 99 ? '99+' : numCount.toString();
            
            // Add high-count class for numbers > 99
            if (numCount > 99) {
                this.badge.classList.add('high-count');
            } else {
                this.badge.classList.remove('high-count');
            }
            
            // Show badge with animation
            this.badge.classList.remove('hide');
            this.badge.classList.add('show', 'animate');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                this.badge.classList.remove('animate');
            }, 300);
        } else {
            this.badge.classList.remove('show', 'high-count');
            this.badge.classList.add('hide');
        }
    }

    // Method to manually refresh cart count (call this after adding/removing items)
    refresh() {
        this.updateCartCount();
    }
}

// Initialize cart badge when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if the badge element exists (user is logged in)
    if (document.getElementById('cart-count-badge')) {
        window.cartBadge = new CartBadge();
    }
});

// Global function to update cart count (can be called from other scripts)
function updateCartBadge() {
    if (window.cartBadge) {
        window.cartBadge.refresh();
    }
}