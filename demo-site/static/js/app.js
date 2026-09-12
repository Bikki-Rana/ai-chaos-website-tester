/**
 * Demo Site — Client-side JavaScript
 * 
 * BUG-004 is in this file: applyPromoCode is called from cart.html
 * but is NOT defined here. This will throw a ReferenceError in the browser.
 * 
 * The function validatePromoCode IS defined (different name) — intentional bug.
 */

function validatePromoCode(code) {
    if (code === 'CHAOS10') {
        document.getElementById('promo-result').textContent = '10% discount applied!';
        document.getElementById('promo-result').style.color = '#2e7d32';
    } else {
        document.getElementById('promo-result').textContent = 'Invalid promo code.';
        document.getElementById('promo-result').style.color = '#c62828';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        // Reads count rendered from session
    }
});
