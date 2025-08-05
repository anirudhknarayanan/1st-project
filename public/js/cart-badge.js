
class CartBadge {
    constructor() {
        this.badge = document.getElementById('cart-count-badge');
        this.init();
    }

    init() {
        
        this.updateCartCount();
        
        
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
            
            this.setBadgeCount(0);
        }
    }

    setBadgeCount(count) {
        if (!this.badge) return;

        const numCount = parseInt(count) || 0;
        
        if (numCount > 0) {
            this.badge.textContent = numCount > 99 ? '99+' : numCount.toString();
            
            
            if (numCount > 99) {
                this.badge.classList.add('high-count');
            } else {
                this.badge.classList.remove('high-count');
            }
            
    
            this.badge.classList.remove('hide');
            this.badge.classList.add('show', 'animate');
            
            
            setTimeout(() => {
                this.badge.classList.remove('animate');
            }, 300);
        } else {
            this.badge.classList.remove('show', 'high-count');
            this.badge.classList.add('hide');
        }
    }


    refresh() {
        this.updateCartCount();
    }
}


document.addEventListener('DOMContentLoaded', function() {
    
    if (document.getElementById('cart-count-badge')) {
        window.cartBadge = new CartBadge();
    }
});


function updateCartBadge() {
    if (window.cartBadge) {
        window.cartBadge.refresh();
    }
}