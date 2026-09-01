import { translations, mockUsers, mockOffers } from './data.js';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from './firebase-config.js';

// State
let loadedProducts = [];
let restaurantDishes = [];
let bundlesData = { banner: {}, bundles: [] };
let categories = [];
let currentLang = 'en';
let cart = [];
let currentRoute = 'home';
let currentUser = null;
let confirmationResult = null;

// DOM Elements
const appContainer = document.getElementById('app-container');
const langBtn = document.getElementById('lang-btn');
const langText = langBtn.querySelector('.lang-text');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const closeSidebarBtn = document.getElementById('close-sidebar');
const cartBadge = document.getElementById('cart-badge');
const userBtn = document.getElementById('user-btn');
const authModal = document.getElementById('auth-modal');
const closeAuthBtns = document.querySelectorAll('.close-modal');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const resendOtpBtn = document.getElementById('resend-otp-btn');
const logoutBtn = document.getElementById('logout-btn');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');
const authPointsDisplay = document.getElementById('auth-points-display');
const userPointsBadge = document.getElementById('user-points-badge');
const closeAuthBtn = document.getElementById('close-auth-btn');
// Cart Sidebar DOM Elements
const cartBtn = document.getElementById('cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const closeCartBtn = document.getElementById('close-cart');
const cartContent = document.getElementById('cart-content');
const cartFooter = document.getElementById('cart-footer');

let selectedSlot = '';
const timeSlots = [
    "Today: 4:00 PM - 6:00 PM",
    "Tomorrow: 9:00 AM - 11:00 AM",
    "Tomorrow: 11:00 AM - 1:00 PM",
    "Tomorrow: 4:00 PM - 6:00 PM"
];

// --- Initialization ---
async function init() {
    setupEventListeners();
    await loadData();
    applyTranslations();
    renderRoute(currentRoute);
}

async function loadData() {
    try {
        const response = await fetch('/api/products');
        loadedProducts = await response.json();
        window.loadedProducts = loadedProducts;
    } catch (e) {
        console.error("Error loading products:", e);
    }
    
    try {
        const restResponse = await fetch('/api/restaurant');
        restaurantDishes = await restResponse.json();
        window.restaurantDishes = restaurantDishes;
    } catch (e) {
        console.error("Error loading restaurant dishes:", e);
    }
    
    try {
        const bundlesResponse = await fetch('/api/bundles');
        bundlesData = await bundlesResponse.json();
        window.bundlesData = bundlesData;
    } catch (e) {
        console.error("Error loading bundles:", e);
    }

    try {
        const categoriesResponse = await fetch('/api/categories');
        categories = await categoriesResponse.json();
        window.categories = categories;
    } catch (e) {
        console.error("Error loading categories:", e);
    }
    
    await checkAuthSession();
}

// --- Event Listeners ---
let recaptchaVerifier = null;

async function checkAuthSession() {
    try {
        const res = await fetch('/api/customer/me');
        if (res.ok) {
            currentUser = await res.json();
            updateUserUI();
        }
    } catch (e) { console.error(e); }
}

function updateUserUI() {
    if (currentUser) {
        userPointsBadge.style.display = 'block';
        userPointsBadge.innerText = currentUser.loyalty_points;
        authPointsDisplay.innerText = currentUser.loyalty_points;
        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'none';
        document.getElementById('auth-step-3').style.display = 'block';
    } else {
        userPointsBadge.style.display = 'none';
        document.getElementById('auth-step-1').style.display = 'block';
        document.getElementById('auth-step-2').style.display = 'none';
        document.getElementById('auth-step-3').style.display = 'none';
    }
}

function openAuthModal() {
    authModal.classList.add('open');
    if (!currentUser && !recaptchaVerifier && auth) {
        try {
            recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'normal'
            });
            recaptchaVerifier.render().catch(e => console.warn("Recaptcha render failed (likely due to non-HTTPS):", e));
        } catch (e) {
            console.warn("Recaptcha initialization failed (likely due to non-HTTPS):", e);
        }
    }
}

async function handleSendOtp() {
    let phone = phoneInput.value.replace(/\D/g, ''); // strip non-digits
    if (phone.length !== 10) return alert("Please enter a valid 10-digit mobile number");
    
    phone = "+91" + phone; // Automatically prepend India country code
    
    sendOtpBtn.disabled = true;
    sendOtpBtn.innerText = "Sending...";
    try {
        confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'block';
    } catch (e) {
        console.warn("Firebase sign-in failed, falling back to mock login:", e.message);
        // Fallback for local HTTP testing
        confirmationResult = { confirm: async () => ({ user: { getIdToken: async () => "mock-token-123" } }) };
        document.getElementById('auth-step-1').style.display = 'none';
        document.getElementById('auth-step-2').style.display = 'block';
        if (recaptchaVerifier) try { recaptchaVerifier.clear(); } catch(err){}
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerText = "Send Code";
    }
}

async function handleVerifyOtp() {
    const code = otpInput.value.trim();
    if (code.length !== 6) return alert("Enter 6-digit code");
    
    verifyOtpBtn.disabled = true;
    verifyOtpBtn.innerText = "Verifying...";
    try {
        const result = await confirmationResult.confirm(code);
        const idToken = await result.user.getIdToken();
        
        const res = await fetch('/api/auth/verify_firebase_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                idToken, 
                phoneNumber: phoneInput.value.trim() 
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            currentUser = data.customer;
            updateUserUI();
        } else {
            alert("Backend verification failed");
        }
    } catch (e) {
        alert(e.message);
    }
    verifyOtpBtn.disabled = false;
    verifyOtpBtn.innerText = "Verify & Login";
}

async function handleLogout() {
    if (auth) await auth.signOut();
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateUserUI();
}

function setupEventListeners() {
    menuBtn.addEventListener('click', openSidebar);
    closeSidebarBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', () => {
        closeSidebar();
        window.closeCart();
    });

    cartBtn.addEventListener('click', window.openCart);
    closeCartBtn.addEventListener('click', window.closeCart);
    
    // Auth Modal Logic
    userBtn.addEventListener('click', openAuthModal);
    closeAuthBtn.addEventListener('click', () => authModal.classList.remove('open'));
    
    sendOtpBtn.addEventListener('click', handleSendOtp);
    verifyOtpBtn.addEventListener('click', handleVerifyOtp);
    resendOtpBtn.addEventListener('click', handleSendOtp);
    logoutBtn.addEventListener('click', handleLogout);

    langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ml' : 'en';
        langText.textContent = currentLang.toUpperCase();
        applyTranslations();
        renderRoute(currentRoute); // Re-render to update dynamic content
    });

    // Sidebar Routing
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = e.currentTarget.getAttribute('data-route');
            if (route) {
                currentRoute = route;
                renderRoute(route);
                closeSidebar();
            }
        });
    });

    // Global Search Auto-complete
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-autocomplete-dropdown');
    
    if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (query.length < 2) {
                searchDropdown.style.display = 'none';
                return;
            }
            
            // Search in loadedProducts
            const productMatches = (window.loadedProducts || []).filter(p => {
                if (!p || !p.name) return false;
                const pName = p.name.toLowerCase();
                const pCat = p.category ? p.category.toLowerCase() : '';
                const pBrand = p.brand ? p.brand.toLowerCase() : '';
                return pName.includes(query) || pCat.includes(query) || pBrand.includes(query);
            }).slice(0, 5);
            
            // Search in restaurant dishes
            const dishMatches = [];
            if (window.restaurantDishes) {
                window.restaurantDishes.forEach(cat => {
                    cat.items.forEach(item => {
                        if (item.name.toLowerCase().includes(query)) {
                            dishMatches.push({...item, isDish: true});
                        }
                    });
                });
            }
            
            const finalMatches = [...productMatches, ...dishMatches.slice(0, 3)];
            
            if (finalMatches.length > 0) {
                searchDropdown.innerHTML = finalMatches.map(m => {
                    const priceStr = m.isDish ? 
                        (m.price ? `₹${m.price}` : `From ₹${m.variants ? m.variants[0].price : ''}`) :
                        `₹${m.price}`;
                    const safeName = m.name.replace(/'/g, "\\'");
                    return `
                        <div class="autocomplete-item" onclick="window.selectSearchResult('${safeName}', ${!!m.isDish})">
                            <img src="${m.img || 'placeholder.jpg'}" alt="${m.name}">
                            <div class="autocomplete-details">
                                <span class="autocomplete-name">${m.name} ${m.isDish ? '<span style="font-size:0.7rem; background:#FFEBEE; color:#C62828; padding:2px 4px; border-radius:4px; margin-left:4px;">Dish</span>' : ''}</span>
                                <span class="autocomplete-price">${priceStr}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                searchDropdown.style.display = 'block';
            } else {
                searchDropdown.innerHTML = `<div style="padding: 12px 16px; color: var(--color-text-muted); font-size: 0.9rem;">No results found for "${query}"</div>`;
                searchDropdown.style.display = 'block';
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.style.display = 'none';
            }
        });
    }
}

window.selectSearchResult = function(productName, isDish) {
    document.getElementById('search-autocomplete-dropdown').style.display = 'none';
    document.getElementById('global-search-input').value = '';
    
    if (isDish) {
        document.querySelector('[data-route=\'restaurant\']').click();
    } else {
        document.querySelector('[data-route=\'catalog\']').click();
    }
    
    setTimeout(() => {
        // Highlight logic could go here, or just a toast alert for now
        // alert(`Found: ${productName}`); 
        // Better: let's try to scroll to the item if it's visible
        const elements = Array.from(document.querySelectorAll('h3, h4')).filter(el => el.textContent.includes(productName));
        if (elements.length > 0) {
            elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            elements[0].parentElement.style.border = '2px solid var(--color-primary)';
            setTimeout(() => { elements[0].parentElement.style.border = ''; }, 2000);
        }
    }, 500);
};



function addFirebaseUserToAdmin(firebaseUser) {
    if (!firebaseUser || !firebaseUser.phoneNumber) return;
    const phone = firebaseUser.phoneNumber;
    
    // Check if user already exists
    const exists = mockUsers.some(u => u.phone === phone);
    if (!exists) {
        const nextId = mockUsers.length ? Math.max(...mockUsers.map(u => u.id)) + 1 : 1;
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + 
                        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(now.getDate()).padStart(2, '0');
        
        mockUsers.push({
            id: nextId,
            name: "Customer " + phone.slice(-4),
            phone: phone,
            joined: dateStr,
            status: "Active",
            points: 0
        });
    }
}



// --- Sidebar & Cart Drawer Toggle ---
function openSidebar() {
    window.closeCart();
    sidebar.classList.add('open');
    overlay.classList.add('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    if (!cartSidebar.classList.contains('open')) {
        overlay.classList.remove('open');
    }
}

window.openCart = function() {
    closeSidebar();
    cartSidebar.classList.add('open');
    overlay.classList.add('open');
    window.renderCart();
};

window.closeCart = function() {
    cartSidebar.classList.remove('open');
    if (!sidebar.classList.contains('open')) {
        overlay.classList.remove('open');
    }
};

// --- i18n ---
function applyTranslations() {
    const dict = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });
}

// --- Cart Logic ---
window.addToCart = function(productId) {
    const product = [...loadedProducts, ...restaurantDishes].find(p => p.id === productId || String(p.id) === String(productId));
    if (product) {
        // Count how many are already in the cart
        const countInCart = cart.filter(p => p.id === productId || String(p.id) === String(productId)).length;
        if (countInCart >= (product.stock || 50)) {
            alert(`Sorry, only ${product.stock || 50} items available in stock!`);
            return;
        }

        cart.push(product);
        cartBadge.textContent = cart.length;
        
        // Micro animation
        cartBadge.style.transform = 'scale(1.5)';
        setTimeout(() => {
            cartBadge.style.transform = 'scale(1)';
        }, 200);

        if (cartSidebar.classList.contains('open')) {
            window.renderCart();
        }
    }
};

function getGroupedCart() {
    const groups = {};
    cart.forEach(item => {
        if (!groups[item.id]) {
            groups[item.id] = {
                product: item,
                quantity: 0
            };
        }
        groups[item.id].quantity++;
    });
    return Object.values(groups);
}

window.renderCart = function() {
    const grouped = getGroupedCart();
    
    if (grouped.length === 0) {
        cartContent.innerHTML = `
            <div style="text-align: center; margin-top: 50px; color: var(--color-text-muted);">
                <span class="material-symbols-outlined" style="font-size: 4rem;">shopping_basket</span>
                <p style="margin-top: 10px; font-weight: 500;">Your cart is empty</p>
                <button class="btn btn-primary" style="margin-top: 20px;" onclick="window.closeCart()">Start Shopping</button>
            </div>
        `;
        cartFooter.innerHTML = '';
        return;
    }
    
    let subtotal = 0;
    let savings = 0;
    
    let itemsHTML = grouped.map(item => {
        const p = item.product;
        const qty = item.quantity;
        const priceTotal = p.price * qty;
        const mrpTotal = (p.mrp || p.price) * qty;
        
        subtotal += priceTotal;
        savings += (mrpTotal - priceTotal);
        
        return `
            <div class="cart-item">
                <img src="${p.img}" alt="${p.name}">
                <div class="cart-item-details">
                    <span class="cart-item-brand" style="color: ${p.color || 'var(--color-primary)'}">${p.brand || p.category || 'Restaurant'}</span>
                    <h4 class="cart-item-name">${p.name}</h4>
                    <div class="cart-item-price-row">
                        <div>
                            <span class="cart-item-price">₹${priceTotal}</span>
                            ${p.mrp > p.price ? `<span class="cart-item-mrp">₹${mrpTotal}</span>` : ''}
                        </div>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="window.updateCartQuantity('${p.id}', -1)">-</button>
                            <span class="qty-val">${qty}</span>
                            <button class="qty-btn" onclick="window.updateCartQuantity('${p.id}', 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    cartContent.innerHTML = itemsHTML;
    
    cartFooter.innerHTML = `
        <div class="cart-summary">
            <div class="summary-line">
                <span>Subtotal:</span>
                <span>₹${subtotal}</span>
            </div>
            ${savings > 0 ? `
            <div class="summary-line savings">
                <span>Total Savings:</span>
                <span>₹${savings}</span>
            </div>
            ` : ''}
            <div class="summary-line total">
                <span>Total to Pay:</span>
                <span>₹${subtotal}</span>
            </div>
        </div>
        <button class="btn btn-primary" style="width: 100%; border-radius: var(--radius-md);" onclick="window.showCheckout()">Proceed to Checkout</button>
    `;
};

window.updateCartQuantity = function(productId, delta) {
    const product = [...loadedProducts, ...restaurantDishes].find(p => p.id === productId || String(p.id) === String(productId));
    if (!product) return;
    
    if (delta > 0) {
        const countInCart = cart.filter(p => p.id === productId || String(p.id) === String(productId)).length;
        if (countInCart >= (product.stock || 50)) {
            alert(`Sorry, only ${product.stock || 50} items available in stock!`);
            return;
        }
        cart.push(product);
    } else {
        const idx = cart.findIndex(p => p.id === productId || String(p.id) === String(productId));
        if (idx > -1) {
            cart.splice(idx, 1);
        }
    }
    
    cartBadge.textContent = cart.length;
    window.renderCart();
};

// --- Geolocation Helper (Free browser-native GPS) ---
window.getCurrentLocation = function() {
    const locBtn = document.getElementById('location-gps-btn');
    const locInput = document.getElementById('checkout-location');
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    locBtn.disabled = true;
    locBtn.textContent = "Locating...";
    
    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        locInput.value = mapsUrl;
        locBtn.textContent = "Location Shared!";
        locBtn.style.backgroundColor = '#4CAF50';
        locBtn.style.color = '#fff';
    }, (error) => {
        console.error(error);
        alert("Unable to retrieve location: " + error.message);
        locBtn.disabled = false;
        locBtn.textContent = "Share Location using GPS";
    });
};

// --- Checkout Flow ---
window.toggleRedeemPoints = function(points) {
    const checkbox = document.getElementById('redeem-points-checkbox');
    const isChecked = checkbox ? checkbox.checked : false;
    const subtotal = cart.reduce((sum, p) => sum + p.price, 0);
    const deliveryFee = 40;
    let discount = 0;
    if (isChecked) {
        discount = Math.min(points / 10, subtotal);
    }
    const finalTotal = subtotal + deliveryFee - discount;

    const discountSummaryLine = document.getElementById('checkout-discount-line');
    if (discountSummaryLine) {
        if (isChecked && discount > 0) {
            discountSummaryLine.style.display = 'flex';
            discountSummaryLine.innerHTML = `<span>Points Discount:</span><span style="color: #c62828;">-₹${discount.toFixed(2)}</span>`;
        } else {
            discountSummaryLine.style.display = 'none';
        }
    }

    const payBtn = document.getElementById('place-order-btn');
    if (payBtn) {
        payBtn.textContent = `Place Order (₹${finalTotal})`;
    }
};

window.showCheckout = function() {
    const subtotal = cart.reduce((sum, p) => sum + p.price, 0);
    const deliveryFee = 40;
    const totalToPay = subtotal + deliveryFee;

    const dbUser = currentUser ? mockUsers.find(u => u.phone === currentUser.phoneNumber) : null;
    const userPoints = dbUser ? (dbUser.points || 0) : 0;
    const redemptionVal = userPoints / 10;

    // Generate next 7 dates
    const dates = [];
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(d.toLocaleDateString('en-US', dateOptions));
    }

    const deliveryTimeSlots = [
        "08:00 AM - 11:00 AM (Morning)",
        "11:00 AM - 02:00 PM (Midday)",
        "02:00 PM - 05:00 PM (Afternoon)",
        "05:00 PM - 08:00 PM (Evening)"
    ];

    cartContent.innerHTML = `
        <div class="checkout-section">
            <h3 style="margin-bottom: var(--space-xs);">Checkout Details</h3>
            
            <div class="input-group">
                <label>Select Delivery Date</label>
                <select id="checkout-delivery-date" class="form-select" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit;">
                    ${dates.map((date) => `<option value="${date}">${date}</option>`).join('')}
                </select>
            </div>

            <div class="input-group" style="margin-top: 12px;">
                <label>Select Time Slot</label>
                <select id="checkout-delivery-slot" class="form-select" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit;">
                    ${deliveryTimeSlots.map((slot) => `<option value="${slot}">${slot}</option>`).join('')}
                </select>
            </div>
            
            <div class="input-group" style="margin-top: 12px;">
                <label>Contact Name</label>
                <input type="text" id="checkout-name" placeholder="Enter your full name" required>
            </div>
            
            <div class="input-group" style="margin-top: 12px;">
                <label>Mobile Number</label>
                <input type="tel" id="checkout-phone" placeholder="Enter mobile number" value="${currentUser ? currentUser.phoneNumber : ''}" required>
            </div>
            
            <div class="input-group" style="margin-top: 12px;">
                <label>Delivery Address</label>
                <textarea id="checkout-address" rows="3" placeholder="Enter full delivery address" style="padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit; resize: none;" required></textarea>
            </div>

            <div class="input-group" style="margin-top: 12px;">
                <label>Share Location (No Google API Cost)</label>
                <button type="button" id="location-gps-btn" class="btn btn-outline" style="width: 100%; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="window.getCurrentLocation()">
                    <span class="material-symbols-outlined" style="font-size: 20px;">my_location</span>
                    Share Location using GPS
                </button>
                <input type="text" id="checkout-location" placeholder="GPS link will populate here" readonly style="width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit; background: #f9f9f9; font-size: 0.85rem;">
            </div>
            
            ${userPoints > 0 ? `
            <div style="background-color: #e8f5e9; padding: 12px; border-radius: 8px; font-size: 0.9rem; margin-top: 16px; border: 1px solid #a5d6a7; color: #2e7d32;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer;">
                        <input type="checkbox" id="redeem-points-checkbox" onchange="window.toggleRedeemPoints(${userPoints})" style="width: 18px; height: 18px; cursor: pointer;">
                        Redeem Loyalty Points
                    </label>
                    <span style="font-weight: bold;">-${userPoints} pts (₹${redemptionVal.toFixed(2)})</span>
                </div>
                <div style="font-size: 0.8rem; color: #558b2f; margin-top: 4px; margin-left: 26px;">You have ${userPoints} points. 10 points = ₹1.00 discount.</div>
            </div>
            ` : ''}

            <div style="background-color: var(--color-warm-cream); padding: 12px; border-radius: 8px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 8px; color: var(--color-text-main); margin-top: 16px;">
                <span class="material-symbols-outlined" style="color: var(--color-secondary-dark);">payments</span>
                <span>Payment Mode: Cash / Pay on Delivery</span>
            </div>
        </div>
    `;
    
    cartFooter.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; padding: 0 4px; font-size: 0.95rem;">
                <span>Cart Subtotal:</span>
                <span>₹${subtotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 600; padding: 0 4px; font-size: 0.95rem;">
                <span>Delivery Charge:</span>
                <span>₹${deliveryFee}</span>
            </div>
            <div id="checkout-discount-line" style="display: none; justify-content: space-between; font-weight: 600; padding: 0 4px; font-size: 0.95rem; color: #c62828;">
                <span>Points Discount:</span>
                <span>-₹0.00</span>
            </div>
            <div style="border-top: 1px solid #eee; margin: 4px 0;"></div>
            <button class="btn btn-primary" id="place-order-btn" style="width: 100%; border-radius: var(--radius-md);" onclick="window.placeOrder()">Place Order (₹${totalToPay})</button>
            <button class="btn btn-outline" style="width: 100%; border-radius: var(--radius-md);" onclick="window.renderCart()">Back to Cart</button>
        </div>
    `;
};

window.placeOrder = function() {
    const nameInput = document.getElementById('checkout-name');
    const phoneInput = document.getElementById('checkout-phone');
    const addressInput = document.getElementById('checkout-address');
    const dateInput = document.getElementById('checkout-delivery-date');
    const slotInput = document.getElementById('checkout-delivery-slot');
    const locationInput = document.getElementById('checkout-location');
    
    if (!nameInput.value.trim() || !phoneInput.value.trim() || !addressInput.value.trim()) {
        alert("Please fill in all contact and address details!");
        return;
    }
    
    const phoneVal = phoneInput.value.trim();
    // Blocked check
    const registeredUser = mockUsers.find(u => u.phone === phoneVal);
    if (registeredUser && registeredUser.status === 'Blocked') {
        alert("Your account has been blocked by store administration. Checkout is disabled.");
        return;
    }

    const selectedDate = dateInput.value;
    const selectedSlot = slotInput.value;
    const googleMapsLink = locationInput.value || '';
    
    const subtotal = cart.reduce((sum, p) => sum + p.price, 0);
    const deliveryFee = 40;
    
    const redeemCheckbox = document.getElementById('redeem-points-checkbox');
    const isRedeemed = redeemCheckbox ? redeemCheckbox.checked : false;
    let pointsDiscount = 0;
    let pointsEarned = Math.floor(subtotal / 10);
    
    if (registeredUser) {
        if (isRedeemed) {
            const userPoints = registeredUser.points || 0;
            pointsDiscount = Math.min(userPoints / 10, subtotal);
            registeredUser.points = userPoints - Math.round(pointsDiscount * 10);
        }
        registeredUser.points = (registeredUser.points || 0) + pointsEarned;
    }

    const totalToPay = subtotal + deliveryFee - pointsDiscount;
    const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);
    
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0') + ' ' + 
                    String(now.getHours()).padStart(2, '0') + ':' + 
                    String(now.getMinutes()).padStart(2, '0');
    
    const newOrder = {
        id: orderId,
        customer: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        address: addressInput.value.trim(),
        deliveryDate: selectedDate,
        slot: selectedSlot,
        locationUrl: googleMapsLink,
        total: totalToPay,
        items: getGroupedCart().length,
        status: "Pending",
        date: dateStr
    };
    
    // Add to shared order list
    if (window.mockOrders) {
        window.mockOrders.unshift(newOrder);
    }
    
    // Show success
    cartContent.innerHTML = `
        <div class="checkout-success">
            <span class="material-symbols-outlined">check_circle</span>
            <h2>Order Placed!</h2>
            <p style="font-weight: 500; font-size: 1.1rem; margin: 0;">Thank you, ${newOrder.customer}.</p>
            <p style="color: var(--color-text-muted); margin: 0;">Your Order ID is <strong>${orderId}</strong>.</p>
            ${pointsEarned > 0 ? `
            <div style="background: #e3f2fd; border: 1px solid #90caf9; padding: 10px; border-radius: 8px; font-size: 0.88rem; color: #0d47a1; font-weight: 600; margin: 10px 0; width: 100%; text-align: center;">
                🎉 You earned ${pointsEarned} loyalty points on this order!
            </div>
            ` : ''}
            <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0; text-align: center;">
                Scheduled for Delivery on:<br>
                <strong>${selectedDate}</strong> during <strong>${selectedSlot}</strong>
            </p>
            ${googleMapsLink ? `<p style="color: #4CAF50; font-size: 0.85rem; font-weight: 500;">✓ GPS Coordinates Shared</p>` : ''}
        </div>
    `;
    
    cartFooter.innerHTML = `
        <button class="btn btn-primary" style="width: 100%; border-radius: var(--radius-md);" onclick="window.closeCart()">Continue Shopping</button>
    `;
    
    // Reset cart
    cart = [];
    cartBadge.textContent = '0';
    updateUserUI();
};

// --- Rendering ---
function renderRoute(route) {
    appContainer.innerHTML = ''; // Clear current

    if (route === 'home') {
        renderHome();
    } else if (route === 'restaurant') {
        renderRestaurant();
    } else if (route === 'admin') {
        window.renderAdmin();
    } else if (route === 'catalog') {
        renderCategoryPage('all', 'Shop All');
    } else if (route === 'about') {
        renderAbout();
    } else if (route === 'bundles') {
        window.renderBundlesPage();
    } else {
        appContainer.innerHTML = `<section class="container text-center"><h2>Work in Progress</h2></section>`;
    }
}

window.renderBundlesPage = function() {
    const banner = bundlesData.banner || { title: "Curated Bundles", description: "", bgGradientStart: "#f5f7fa", bgGradientEnd: "#c3cfe2" };
    const list = bundlesData.bundles || [];

    let bundlesHTML = list.map(bundle => {
        const bundleProducts = (bundle.productIds || []).map(id => loadedProducts.find(p => p.id === id || String(p.id) === String(id))).filter(Boolean);
        const originalPrice = bundleProducts.reduce((sum, p) => sum + p.price, 0);
        const bundlePrice = bundle.price || Math.floor(originalPrice * 0.85);

        return `
            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-md); margin-bottom: 32px; display: flex; flex-direction: column; md:flex-row; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--shadow-lg)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--shadow-md)';">
                <div style="background: linear-gradient(135deg, ${bundle.color || '#4CAF50'}cc 0%, ${bundle.color || '#4CAF50'} 100%); padding: 30px; color: white; display: flex; flex-direction: column; justify-content: center; min-width: 280px;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; align-self: flex-start;">
                        ${bundle.discountText || 'Special Combo'}
                    </div>
                    <h2 style="margin: 0 0 12px; font-size: 2rem; color: white !important;">${bundle.name}</h2>
                    <p style="margin: 0; opacity: 0.9; font-size: 1.1rem; line-height: 1.5; color: white;">${bundle.description}</p>
                    <div style="margin-top: 24px; display: flex; align-items: baseline; gap: 12px;">
                        <span style="font-size: 2.5rem; font-weight: bold; color: white;">₹${bundlePrice}</span>
                        ${originalPrice > bundlePrice ? `<span style="font-size: 1.2rem; text-decoration: line-through; opacity: 0.7; color: white;">₹${originalPrice}</span>` : ''}
                    </div>
                    <button class="btn" style="background: white; color: ${bundle.color || '#4CAF50'}; margin-top: 24px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onclick="window.addBundleToCart('${bundle.id}')">Add Bundle to Cart</button>
                </div>
                
                <div style="padding: 24px; flex-grow: 1; background: #fdfdfd;">
                    <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--color-text-main); font-size: 1.2rem;">What's Included:</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px;">
                        ${bundleProducts.length === 0 ? '<p style="color: #999;">Select items restocked soon.</p>' : bundleProducts.map(p => `
                            <div style="background: white; border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; text-align: center;">
                                <img src="${p.img}" alt="${p.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
                                <h4 style="margin: 0 0 4px; font-size: 0.9rem; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${p.name}</h4>
                                <div style="color: var(--color-text-muted); font-size: 0.85rem;">₹${p.price} value</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    appContainer.innerHTML = `
        <section class="container" style="padding-top: 0;">
            <div style="background: linear-gradient(135deg, ${banner.bgGradientStart || '#f5f7fa'} 0%, ${banner.bgGradientEnd || '#c3cfe2'} 100%); padding: 60px 20px; border-radius: 0 0 30px 30px; margin-bottom: 40px; text-align: center; box-shadow: inset 0 -10px 20px rgba(0,0,0,0.02);">
                <span class="material-symbols-outlined" style="font-size: 48px; color: #546e7a; margin-bottom: 16px;">loyalty</span>
                <h1 style="color: #2c3e50; font-size: 3rem; margin: 0 0 16px; font-weight: 800; letter-spacing: -1px;">${banner.title}</h1>
                <p style="color: #546e7a; font-size: 1.2rem; max-width: 600px; margin: 0 auto; line-height: 1.6;">${banner.description}</p>
            </div>
            
            <div style="max-width: 1000px; margin: 0 auto;">
                ${bundlesHTML || '<p style="text-align: center; color: #666;">No bundles available at this moment.</p>'}
            </div>
        </section>
    `;
};

window.addBundleToCart = function(bundleId) {
    const bundle = (bundlesData.bundles || []).find(b => b.id === bundleId);
    if (!bundle) return;
    const bundleProducts = (bundle.productIds || []).map(id => loadedProducts.find(p => p.id === id || String(p.id) === String(id))).filter(Boolean);
    if (bundleProducts.length === 0) {
        alert("This bundle has no products currently available.");
        return;
    }
    
    bundleProducts.forEach(p => {
        cart.push(p);
    });
    cartBadge.textContent = cart.length;
    
    cartBadge.style.transform = 'scale(1.5)';
    setTimeout(() => {
        cartBadge.style.transform = 'scale(1)';
    }, 200);
    
    alert(`"${bundle.name}" items added to your cart!`);
    if (cartSidebar.classList.contains('open')) {
        window.renderCart();
    }
};

// --- Restaurant Page Renderer ---
function renderRestaurant(activeCategory = 'All') {
    const categories = ['All', 'Biriyani', 'Alfaham', 'Meals & Mains', 'Sweets & Snacks', 'Beverages'];

    const filteredDishes = activeCategory === 'All' 
        ? restaurantDishes 
        : restaurantDishes.filter(d => {
            if (!d.category) return false;
            const catLower = d.category.toLowerCase();
            const filterLower = activeCategory.toLowerCase();
            return catLower.includes(filterLower) || filterLower.includes(catLower);
        });

    appContainer.innerHTML = `
        <div class="container">
            <!-- Restaurant Banner -->
            <div class="restaurant-hero">
                <div class="restaurant-hero-content">
                    <div class="restaurant-title-badge">
                        <span class="material-symbols-outlined" style="font-size: 16px;">restaurant</span>
                        Fresh & Authentic Kitchen
                    </div>
                    <h1>Evin's Restaurant</h1>
                    <p>Feast on freshly cooked Biriyanis, charcoal-grilled Arabian Alfahams, traditional Kerala Meals, and delicious Sweets & Snacks.</p>
                </div>
            </div>

            <!-- Action & Category Bar -->
            <div class="restaurant-action-bar">
                <div class="filter-pills">
                    ${categories.map(cat => `
                        <button class="filter-pill ${activeCategory === cat ? 'active' : ''}" onclick="window.renderRestaurant('${cat}')">
                            ${cat}
                        </button>
                    `).join('')}
                </div>
                <button class="btn-add-dish" onclick="window.openAddDishModal()">
                    <span class="material-symbols-outlined">add_circle</span>
                    Add New Dish
                </button>
            </div>

            <!-- Dish Grid -->
            ${filteredDishes.length === 0 ? `
                <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 1px solid var(--color-border); margin-bottom: 60px;">
                    <span class="material-symbols-outlined" style="font-size: 4rem; color: #ff9800;">dinner_dining</span>
                    <h3 style="margin-top: 10px; font-size: 1.4rem;">No Dishes Found in "${activeCategory}"</h3>
                    <p style="color: var(--color-text-muted); margin-bottom: 20px;">Be the first to add a delicious dish to this menu category!</p>
                    <button class="btn-add-dish" onclick="window.openAddDishModal()">
                        <span class="material-symbols-outlined">add_circle</span> Add Dish Now
                    </button>
                </div>
            ` : `
                <div class="dish-grid">
                    ${filteredDishes.map(dish => `
                        <div class="dish-card" ${dish.unavailable ? 'style="opacity: 0.8;"' : ''}>
                            <div class="dish-img-container">
                                <img src="${dish.img}" alt="${dish.name}" onerror="this.src='images/default_restaurant.jpg'">
                                ${dish.badge ? `<span class="dish-tag-badge">${dish.badge}</span>` : ''}
                                ${dish.unavailable ? `<span class="dish-tag-badge" style="background: #e53935; left: auto; right: 12px;">Unavailable</span>` : ''}
                                <span class="dish-cat-tag">${dish.category}</span>
                            </div>
                            <div class="dish-content">
                                <h3 class="dish-name">${dish.name}</h3>
                                <p class="dish-desc">${dish.description || ''}</p>
                                <div class="dish-footer">
                                    <div class="dish-price-box">
                                        <span class="dish-price">₹${dish.price}</span>
                                        ${dish.mrp && dish.mrp > dish.price ? `<span class="dish-mrp">₹${dish.mrp}</span>` : ''}
                                    </div>
                                    ${dish.unavailable ? `
                                        <button class="btn" style="background: #e0e0e0; color: #9e9e9e; cursor: not-allowed; font-weight: 700; font-size: 0.9rem; padding: 8px 16px; border-radius: var(--radius-md);" disabled>
                                            Unavailable
                                        </button>
                                    ` : `
                                        <button class="btn-add-to-cart-dish" onclick="window.addToCart('${dish.id}')">
                                            <span class="material-symbols-outlined" style="font-size: 18px;">add_shopping_cart</span> Add
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}
window.renderRestaurant = renderRestaurant;

// --- Dish Creation Modal Handlers ---
window.openAddDishModal = function() {
    const modal = document.getElementById('add-dish-modal');
    if (modal) {
        const form = document.getElementById('add-dish-form');
        if (form) form.reset();
        modal.classList.add('open');
    }
};

window.closeAddDishModal = function() {
    const modal = document.getElementById('add-dish-modal');
    if (modal) modal.classList.remove('open');
};

window.saveNewDish = async function() {
    const nameInput = document.getElementById('dish-name');
    const catInput = document.getElementById('dish-category');
    const priceInput = document.getElementById('dish-price');
    const badgeInput = document.getElementById('dish-badge');
    const descInput = document.getElementById('dish-desc');
    const fileInput = document.getElementById('dish-image-file');
    const urlInput = document.getElementById('dish-image-url');

    const name = nameInput.value.trim();
    const category = catInput.value;
    const price = parseFloat(priceInput.value);
    const badge = badgeInput.value.trim();
    const description = descInput.value.trim();

    if (!name || isNaN(price) || price <= 0) {
        alert("Please enter a valid dish name and price!");
        return;
    }

    const saveBtn = document.getElementById('save-dish-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = "Publishing...";

    let imageUrl = urlInput.value.trim();

    // Handle File Upload if provided
    if (fileInput.files && fileInput.files[0]) {
        try {
            const file = fileInput.files[0];
            const base64Str = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const uploadRes = await fetch('/api/upload_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: `images/dish_${Date.now()}.jpg`,
                    image_base64: base64Str
                })
            });
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
                imageUrl = uploadData.url;
            }
        } catch (e) {
            console.error("Image upload error:", e);
        }
    }

    if (!imageUrl) {
        imageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80";
    }

    const newDish = {
        id: "rest-" + Date.now(),
        name: name,
        category: category,
        price: price,
        mrp: Math.round(price * 1.15),
        stock: 50,
        description: description || `${name} freshly prepared at Evin's Kitchen.`,
        img: imageUrl,
        badge: badge || undefined
    };

    restaurantDishes.unshift(newDish);
    window.restaurantDishes = restaurantDishes;

    try {
        await fetch('/api/save_restaurant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restaurantDishes)
        });
    } catch (e) {
        console.error("Failed to save restaurant dish to server:", e);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save & Publish Dish";
    window.closeAddDishModal();
    alert(`"${name}" added successfully to the Restaurant menu!`);

    if (currentRoute === 'restaurant') {
        renderRestaurant(category);
    }
};

// Bind modal listeners after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-dish-modal');
    const cancelBtn = document.getElementById('cancel-dish-btn');
    const saveBtn = document.getElementById('save-dish-btn');

    if (closeBtn) closeBtn.addEventListener('click', window.closeAddDishModal);
    if (cancelBtn) cancelBtn.addEventListener('click', window.closeAddDishModal);
    if (saveBtn) saveBtn.addEventListener('click', window.saveNewDish);
});

async function renderAbout() {
    appContainer.innerHTML = `<section class="container text-center"><p>Loading Story...</p></section>`;
    
    let aboutData = { title: "Welcome to Evin's Mart", description: "Your local supermarket...", img1: '', img2: '' };
    try {
        const response = await fetch('/api/about');
        aboutData = await response.json();
    } catch (e) {
        console.error("Error loading about data, using defaults", e);
    }
    
    appContainer.innerHTML = `
        <section class="container" style="padding-top: 40px; margin-bottom: 60px;">
            <div style="background: white; border-radius: 16px; border: 1px solid var(--color-border); box-shadow: var(--shadow-md); padding: 40px 24px; max-width: 900px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--color-primary);">info</span>
                    <h1 style="font-size: 2.5rem; color: var(--color-primary-dark); font-weight: 800; margin-top: 10px;">${aboutData.title}</h1>
                    <div style="width: 60px; height: 4px; background: var(--color-primary); margin: 16px auto; border-radius: 2px;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; align-items: center;">
                    <div>
                        <p style="font-size: 1.1rem; line-height: 1.8; color: var(--color-text-main); white-space: pre-line;">${aboutData.description}</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                        ${aboutData.img1 ? `<img src="${aboutData.img1}" alt="About Evin's Mart 1" style="width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); border: 1px solid #eee;">` : ''}
                        ${aboutData.img2 ? `<img src="${aboutData.img2}" alt="About Evin's Mart 2" style="width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); border: 1px solid #eee;">` : ''}
                    </div>
                </div>
            </div>
        </section>
    `;
}
window.renderRoute = renderRoute;

function renderHome() {
    const t = translations[currentLang];
    
    // Hero
    const heroHTML = `
        <section class="container">
            <div class="hero">
                <div class="hero-content">
                    <h1>${t['hero.title'] || "Freshness Delivered to Your Doorstep"}</h1>
                    <p>${t['hero.subtitle'] || "Shop daily essentials, fresh produce, and smart value deals."}</p>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-route=\\'catalog\\']').click();">${t['hero.btn'] || "Shop Now"}</button>
                </div>
            </div>
        </section>
    `;

    // Categories
    const categoryColors = {
        'fruits': 'cat-fresh',
        'veg': 'cat-fresh',
        'dairy': 'cat-dairy',
        'bakery': 'cat-bakery',
        'grains': 'cat-household',
        'snacks': 'cat-snacks'
    };

    const categoriesHTML = `
        <section class="container">
            <div class="section-header">
                <h2>${t['section.categories'] || "Shop by Category"}</h2>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px;">
                ${categories.map(c => {
                    // Find color from loadedProducts if available, or default
                    const catProduct = loadedProducts.find(p => p.category === c.id);
                    const color = catProduct ? catProduct.color : '#9E9E9E';
                    return `
                    <div class="category-card" style="border-top: 4px solid ${color}; background-color: ivory;" onclick="renderCategoryPage('${c.id}', '${c.name}', '${color}')" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 6px 12px ${color}40';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)';">
                        <span class="material-symbols-outlined" style="font-size: 32px; color: ${color};">${c.icon}</span>
                        <h3 style="color: ${color};">${c.name}</h3>
                    </div>
                `}).join('')}
            </div>
        </section>
    `;

    // Offers
    const offersProducts = loadedProducts.filter(p => p.badge).slice(0, 10);
    const offersHTML = offersProducts.length > 0 ? `
        <section class="container">
            <div class="section-header">
                <h2>${t['section.offers'] || "Current Offers"}</h2>
            </div>
            <div class="product-grid">
                ${offersProducts.map(p => createProductCard(p)).join('')}
            </div>
        </section>
    ` : '';

    // Contact & Maps
    const contactHTML = `
        <section class="container" style="margin-top: 40px; margin-bottom: 60px;">
            <div class="section-header">
                <h2>Visit Us</h2>
            </div>
            <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--color-border); box-shadow: var(--shadow-sm);">
                <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; margin-bottom: 20px;">
                    <div style="flex: 1; min-width: 250px;">
                        <h3 style="color: var(--color-primary); font-size: 1.4rem;">Evin's Mart</h3>
                        <p style="color: var(--color-text-muted); font-size: 1rem; margin-bottom: 8px;">Family Supermarket & Fresh Produce</p>
                        <p style="margin-bottom: 4px;"><strong>Hours:</strong> Open Daily</p>
                        <p style="margin-bottom: 16px;"><strong>Location:</strong> Melepurathu Building</p>
                        <a href="https://maps.app.goo.gl/Un8Fe8CuZ5tLfurD7" target="_blank" class="btn btn-outline">
                            <span class="material-symbols-outlined">directions</span> Get Directions
                        </a>
                    </div>
                </div>
                <div style="width: 100%; border-radius: 8px; overflow: hidden; height: 350px;">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameborder="0" 
                        scrolling="no" 
                        marginheight="0" 
                        marginwidth="0" 
                        src="https://maps.google.com/maps?q=9.305078,76.6255694&hl=en&z=16&output=embed">
                    </iframe>
                </div>
            </div>
        </section>
    `;

    // Reviews
    const reviewsHTML = `
        <section class="container" style="margin-top: 40px; background-color: var(--color-warm-cream); padding: 40px 20px; border-radius: 12px; box-shadow: var(--shadow-sm);">
            <div class="section-header" style="justify-content: center; text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 2rem; color: var(--color-primary-dark);">What Our Customers Say</h2>
                <div style="color: #FBC02D; font-size: 24px; margin-top: 8px;">
                    ★★★★★ <span style="color: #555; font-size: 14px; font-weight: normal;">4.9/5 from 342 Google Reviews</span>
                </div>
            </div>
            <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; scroll-snap-type: x mandatory;">
                <!-- Review 1 -->
                <div style="background: white; min-width: 300px; max-width: 300px; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); scroll-snap-align: start;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #4CAF50; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">A</div>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">Anjali Nair</h4>
                            <div style="color: #FBC02D; font-size: 12px;">★★★★★</div>
                        </div>
                    </div>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; font-style: italic;">"Absolutely love Evin's Mart! The fresh produce is always top quality, and the new 'Best Before Savings' section is such a smart idea to reduce food waste while saving money."</p>
                </div>
                <!-- Review 2 -->
                <div style="background: white; min-width: 300px; max-width: 300px; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); scroll-snap-align: start;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #2196F3; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">J</div>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">John Varghese</h4>
                            <div style="color: #FBC02D; font-size: 12px;">★★★★★</div>
                        </div>
                    </div>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; font-style: italic;">"Best family supermarket in town! The staff is incredibly friendly, and their delivery is super fast. I always find everything I need in one trip."</p>
                </div>
                <!-- Review 3 -->
                <div style="background: white; min-width: 300px; max-width: 300px; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); scroll-snap-align: start;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #FF9800; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">S</div>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">Sneha Thomas</h4>
                            <div style="color: #FBC02D; font-size: 12px;">★★★★★</div>
                        </div>
                    </div>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; font-style: italic;">"I love their bundle offers! It makes my monthly grocery shopping so much cheaper. Highly recommend their bakery items too, so fresh."</p>
                </div>
                <!-- Review 4 -->
                <div style="background: white; min-width: 300px; max-width: 300px; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); scroll-snap-align: start;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #E91E63; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">R</div>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">Rahul Krishnan</h4>
                            <div style="color: #FBC02D; font-size: 12px;">★★★★★</div>
                        </div>
                    </div>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; font-style: italic;">"Great selection of international and local products. The store is well-organized, very clean, and checking out is a breeze."</p>
                </div>
                <!-- Review 5 -->
                <div style="background: white; min-width: 300px; max-width: 300px; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); scroll-snap-align: start;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #9C27B0; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">M</div>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">Maria Mathew</h4>
                            <div style="color: #FBC02D; font-size: 12px;">★★★★★</div>
                        </div>
                    </div>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; font-style: italic;">"The Fresh Rewards program is amazing! I've already earned enough points for free delivery. A wonderful supermarket that truly cares for its customers."</p>
                </div>
            </div>
        </section>
    `;

    // Top Approved Offer Banner
    let topOfferBannerHTML = '';
    if (typeof mockOffers !== 'undefined') {
        const approvedOffers = mockOffers.filter(o => o.status === 'Approved');
        if (approvedOffers.length > 0) {
            approvedOffers.sort((a, b) => {
                const matchA = a.suggestion.match(/\d+/) || [0];
                const matchB = b.suggestion.match(/\d+/) || [0];
                return parseInt(matchB[0], 10) - parseInt(matchA[0], 10);
            });
            const bestOffer = approvedOffers[0];
            const offerProduct = loadedProducts.find(p => p.id === bestOffer.productId);
            
            if (offerProduct) {
                topOfferBannerHTML = `
                    <section class="container" style="margin-top: -20px; margin-bottom: 24px;">
                        <div style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); padding: 20px 30px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; box-shadow: 0 4px 15px rgba(255, 154, 158, 0.4); border: 1px solid rgba(255,255,255,0.5);">
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div style="background: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                    <span class="material-symbols-outlined" style="color: #E91E63; font-size: 32px;">local_fire_department</span>
                                </div>
                                <div>
                                    <div style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; font-weight: 700; color: #d81b60;">Top Approved Offer</div>
                                    <h2 style="margin: 0; font-size: 1.8rem; color: #333;">${bestOffer.suggestion}</h2>
                                    <p style="margin: 4px 0 0; color: #666; font-size: 1.1rem; font-weight: 500;">On ${offerProduct.name}</p>
                                </div>
                            </div>
                            <button class="btn" style="background: #E91E63; color: white; border: none; font-weight: bold; font-size: 1.1rem; padding: 12px 28px; border-radius: 50px; box-shadow: 0 4px 12px rgba(233, 30, 99, 0.4); transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(233, 30, 99, 0.6)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(233, 30, 99, 0.4)';" onclick="document.querySelector('[data-route=\\'catalog\\']').click(); setTimeout(() => { const searchInput = document.getElementById('search-input'); if(searchInput) { searchInput.value = '${offerProduct.name}'; searchInput.dispatchEvent(new Event('input')); } }, 100);">Shop Deal</button>
                        </div>
                    </section>
                `;
            }
        }
    }

    appContainer.innerHTML = heroHTML + topOfferBannerHTML + categoriesHTML + offersHTML + reviewsHTML + contactHTML;
}

window.renderCategoryPage = function(categoryId, categoryName, color = '#7CB342') {
    appContainer.innerHTML = `
        <section class="container" style="padding-top: 0;">
            <div style="background: linear-gradient(135deg, ${color}20 0%, ${color}60 100%); padding: 40px 20px; border-radius: 0 0 20px 20px; margin-bottom: 24px; text-align: center; border-bottom: 4px solid ${color};">
                <h1 style="color: ${color}; font-size: 2.5rem; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">${categoryName}</h1>
                <p style="color: #555; font-weight: 500; font-size: 1.1rem;">Explore our curated selection of ${categoryName.toLowerCase()}</p>
            </div>
            <div class="section-header">
                <button class="btn btn-outline" style="border-color: ${color}; color: ${color};" onclick="renderRoute('home')">
                    <span class="material-symbols-outlined">arrow_back</span> Back
                </button>
            </div>
            <div class="product-grid">
                ${loadedProducts.filter(p => {
                    if (categoryId === 'all') return true;
                    return p.category === categoryId;
                }).map(p => createProductCard(p)).join('')}
            </div>
        </section>
    `;
};

function createProductCard(product) {
    const t = translations[currentLang];
    const color = product.color || '#9E9E9E';
    let badgeHTML = '';
    if (product.badge) {
        badgeHTML = `<span class="product-badge" style="background-color: ${color}; box-shadow: 0 2px 4px ${color}60;">${product.badge} ${product.discount || ''}</span>`;
    }

    let stockHTML = '';
    let btnHTML = '';
    
    if (product.stock > 10) {
        stockHTML = `<div style="font-size: 0.8rem; color: #4CAF50; font-weight: 600; margin-bottom: 8px;">${product.stock} in stock</div>`;
        btnHTML = `<button class="btn add-to-cart-btn" style="background-color: ${color}15; color: ${color};" onmouseover="this.style.backgroundColor='${color}30';" onmouseout="this.style.backgroundColor='${color}15';" onclick="addToCart(${product.id})">
                    <span class="material-symbols-outlined" style="font-size: 18px;">add_shopping_cart</span>
                    ${t['btn.addToCart'] || "Add"}
                </button>`;
    } else if (product.stock > 0) {
        stockHTML = `<div style="font-size: 0.8rem; color: #FF9800; font-weight: 600; margin-bottom: 8px;">Only ${product.stock} left! Restocking tomorrow.</div>`;
        btnHTML = `<button class="btn add-to-cart-btn" style="background-color: ${color}15; color: ${color};" onmouseover="this.style.backgroundColor='${color}30';" onmouseout="this.style.backgroundColor='${color}15';" onclick="addToCart(${product.id})">
                    <span class="material-symbols-outlined" style="font-size: 18px;">add_shopping_cart</span>
                    ${t['btn.addToCart'] || "Add"}
                </button>`;
    } else {
        stockHTML = `<div style="font-size: 0.8rem; color: #F44336; font-weight: 600; margin-bottom: 8px;">Out of Stock. Expected in 2 days.</div>`;
        btnHTML = `<button class="btn add-to-cart-btn" style="background-color: #F5F5F5; color: #9E9E9E; cursor: not-allowed;" disabled>
                    Out of Stock
                </button>`;
    }

    return `
        <div class="product-card" style="border-bottom: 3px solid ${color};" onmouseover="this.style.boxShadow='0 6px 16px ${color}40'; this.style.transform='translateY(-4px)';" onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)';">
            ${badgeHTML}
            <div class="product-img-wrap">
                <img src="${product.img}" alt="${product.name}" class="product-img" loading="lazy">
            </div>
            <div class="product-info">
                <span class="product-brand" style="color: ${color}; font-weight: 700;">${product.brand}</span>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price-wrap" style="margin-bottom: 4px;">
                    <span class="product-price">₹${product.price}</span>
                    ${product.mrp > product.price ? `<span class="product-mrp">₹${product.mrp}</span>` : ''}
                </div>
                ${stockHTML}
                ${btnHTML}
            </div>
        </div>
    `;
}



// Start
init();
