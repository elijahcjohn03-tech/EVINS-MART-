import { mockUsers, mockOffers } from './data.js';
const mockOrders = window.mockOrders;

window.adminState = {
    activeTab: 'dashboard',
    isAuthenticated: false
};

let currentCropper = null;
let currentCropProductId = null;
let currentCropFilename = null;
let cropEventsSetup = false;

function setupCropEvents() {
    if (cropEventsSetup) return;
    const cropModal = document.getElementById('crop-modal');
    const closeBtn = document.getElementById('close-crop-btn');
    const cancelBtn = document.getElementById('cancel-crop-btn');
    const saveBtn = document.getElementById('save-crop-btn');
    
    if (!cropModal) return;

    const closeModal = () => {
        cropModal.classList.remove('open');
        if (currentCropper) {
            currentCropper.destroy();
            currentCropper = null;
        }
        currentCropProductId = null;
        currentCropFilename = null;
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    saveBtn.onclick = async () => {
        if (!currentCropper || (!currentCropProductId && !currentCropFilename)) return;
        
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        const canvas = currentCropper.getCroppedCanvas({
            width: 500,
            height: 500
        });
        
        const base64Img = canvas.toDataURL('image/jpeg', 0.8);
        const payload = { image_base64: base64Img };
        if (currentCropFilename) {
            payload.filename = currentCropFilename;
        } else {
            payload.productId = currentCropProductId;
        }
        
        try {
            const res = await fetch('/api/upload_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.url) {
                if (currentCropFilename) {
                    if (currentCropFilename === 'images/about_1.jpg') {
                        window.aboutData.img1 = data.url + '?t=' + new Date().getTime();
                    } else if (currentCropFilename === 'images/about_2.jpg') {
                        window.aboutData.img2 = data.url + '?t=' + new Date().getTime();
                    }
                    alert('About Us image updated locally! Don\'t forget to click "Save About Us Changes" below to write it permanently.');
                    renderAdmin();
                } else {
                    const prod = window.loadedProducts.find(p => p.id === currentCropProductId);
                    if (prod) {
                        prod.img = data.url + '?t=' + new Date().getTime();
                        await saveProducts();
                        alert('Image updated and saved successfully!');
                        renderAdmin();
                    }
                }
            }
        } catch (e) {
            alert('Failed to upload image.');
        }
        
        saveBtn.disabled = false;
        saveBtn.textContent = 'Crop & Save';
        closeModal();
    };
    cropEventsSetup = true;
}

window.handleImageSelection = function(event, productId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const cropModal = document.getElementById('crop-modal');
            const targetImg = document.getElementById('crop-image-target');
            
            targetImg.src = e.target.result;
            currentCropProductId = productId;
            currentCropFilename = null;
            cropModal.classList.add('open');
            
            if (currentCropper) {
                currentCropper.destroy();
            }
            
            currentCropper = new Cropper(targetImg, {
                aspectRatio: 1,
                viewMode: 1,
                background: false
            });
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
};

window.handleAboutImageSelection = function(event, imgIndex) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const cropModal = document.getElementById('crop-modal');
            const targetImg = document.getElementById('crop-image-target');
            
            targetImg.src = e.target.result;
            currentCropProductId = null;
            currentCropFilename = `images/about_${imgIndex}.jpg`;
            cropModal.classList.add('open');
            
            if (currentCropper) {
                currentCropper.destroy();
            }
            
            currentCropper = new Cropper(targetImg, {
                aspectRatio: 1,
                viewMode: 1,
                background: false
            });
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
};

async function saveProducts() {
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.loadedProducts)
        });
        console.log("Products saved securely.");
    } catch (err) {
        console.error("Failed to save products:", err);
    }
}

window.renderAdmin = function() {
    setupCropEvents();
    const appContainer = document.getElementById('app-container');
    
    if (!adminState.isAuthenticated) {
        appContainer.innerHTML = `
            <div class="container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; max-width: 400px; padding: 24px; text-align: center;">
                <div style="background: white; padding: 32px; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); width: 100%; border: 1px solid var(--color-border);">
                    <span class="material-symbols-outlined" style="font-size: 4rem; color: var(--color-primary); margin-bottom: 16px;">admin_panel_settings</span>
                    <h2 style="margin-bottom: var(--space-xs); font-size: 1.8rem; font-weight: 700;">Admin Access</h2>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 24px;">Please enter the administrator password to proceed.</p>
                    
                    <div class="input-group" style="text-align: left; margin-bottom: 20px;">
                        <label for="admin-pwd-input" style="font-weight: 600;">Password</label>
                        <input type="password" id="admin-pwd-input" placeholder="••••••••" style="width: 100%; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit; font-size: 1rem; box-sizing: border-box;" autocomplete="off">
                    </div>
                    
                    <button class="btn btn-primary" style="width: 100%; border-radius: var(--radius-md); font-size: 1rem; padding: 12px;" onclick="window.verifyAdminPassword()">Login as Admin</button>
                    <button class="btn btn-outline" style="width: 100%; border-radius: var(--radius-md); font-size: 1rem; padding: 12px; margin-top: 12px;" onclick="window.renderRoute('home')">Return Home</button>
                </div>
            </div>
        `;
        
        // Focus and Enter key handler
        setTimeout(() => {
            const pwdInput = document.getElementById('admin-pwd-input');
            if (pwdInput) {
                pwdInput.focus();
                pwdInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        window.verifyAdminPassword();
                    }
                });
            }
        }, 100);
        return;
    }
    
    const tabsHTML = `
        <div style="background: var(--color-primary-dark); padding: 10px 20px; display: flex; gap: 10px; overflow-x: auto;">
            <button class="btn ${adminState.activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'dashboard' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('dashboard')">Dashboard</button>
            <button class="btn ${adminState.activeTab === 'restaurant' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'restaurant' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('restaurant')">Restaurant Menu</button>
            <button class="btn ${adminState.activeTab === 'bundles' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'bundles' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('bundles')">Bundles</button>
            <button class="btn ${adminState.activeTab === 'categories' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'categories' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('categories')">Categories</button>
            <button class="btn ${adminState.activeTab === 'users' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'users' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('users')">Users</button>
            <button class="btn ${adminState.activeTab === 'offers' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'offers' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('offers')">Offers</button>
            <button class="btn ${adminState.activeTab === 'inventory' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'inventory' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('inventory')">Inventory</button>
            <button class="btn ${adminState.activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'orders' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('orders')">Orders</button>
            <button class="btn ${adminState.activeTab === 'about' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'about' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('about')">About Us</button>
            <button class="btn ${adminState.activeTab === 'bulk_import' ? 'btn-primary' : 'btn-outline'}" style="${adminState.activeTab !== 'bulk_import' ? 'color: white; border-color: white;' : ''}" onclick="switchAdminTab('bulk_import')">Bulk Import</button>
            <button class="btn btn-secondary" style="margin-left: auto;" onclick="window.adminSignOut()">Exit Admin</button>
        </div>
    `;

    let contentHTML = '';
    
    if (adminState.activeTab === 'dashboard') {
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Admin Dashboard</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px;">
                    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow-sm); text-align: center;">
                        <h3>Total Orders</h3>
                        <p style="font-size: 2rem; color: var(--color-primary); font-weight: bold;">1,248</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow-sm); text-align: center;">
                        <h3>Active Users</h3>
                        <p style="font-size: 2rem; color: #2196F3; font-weight: bold;">3,492</p>
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow-sm); text-align: center;">
                        <h3>Total Products</h3>
                        <p style="font-size: 2rem; color: #FF9800; font-weight: bold;">${window.loadedProducts.length}</p>
                    </div>
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'users') {
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Manage Customers & Loyalty</h2>
                <div id="admin-customers-container">Loading...</div>
            </div>
        `;
        
        // Fetch real customers from Flask API
        fetch('/api/admin/customers')
            .then(res => {
                if (res.status === 401) {
                    adminState.isAuthenticated = false;
                    renderAdmin();
                    throw new Error("Unauthorized");
                }
                return res.json();
            })
            .then(customers => {
                const container = document.getElementById('admin-customers-container');
                if (!container) return;
                
                let tableHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: white; box-shadow: var(--shadow-sm); border-radius: 8px; overflow: hidden;">
                    <tr style="background: var(--color-light-grey); text-align: left;">
                        <th style="padding: 12px;">ID</th>
                        <th style="padding: 12px;">Phone</th>
                        <th style="padding: 12px;">Joined</th>
                        <th style="padding: 12px;">Loyalty Points</th>
                        <th style="padding: 12px;">Action</th>
                    </tr>
                `;
                
                customers.forEach(c => {
                    const date = new Date(c.created_at).toLocaleDateString();
                    tableHTML += `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">${c.id}</td>
                            <td style="padding: 12px; font-weight: bold;">${c.phone_number}</td>
                            <td style="padding: 12px;">${date}</td>
                            <td style="padding: 12px;">
                                <strong style="color: var(--color-primary-dark); font-size: 1.1rem;">${c.loyalty_points || 0} pts</strong>
                            </td>
                            <td style="padding: 12px; display: flex; gap: 8px; align-items: center;">
                                <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: #1E88E5; border-color: #90CAF9;" onclick="window.editCustomerPoints(${c.id}, ${c.loyalty_points || 0})">Set Points</button>
                                <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.8rem; color: #E91E63; border-color: #F48FB1;" onclick="window.grantCustomerReward(${c.id})">Grant Reward</button>
                            </td>
                        </tr>
                    `;
                });
                
                tableHTML += `</table>`;
                container.innerHTML = tableHTML;
            })
            .catch(e => {
                const container = document.getElementById('admin-customers-container');
                if (container) container.innerHTML = "Error loading customers.";
                console.error(e);
            });
    } else if (adminState.activeTab === 'offers') {
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Suggested Offers</h2>
                <p>Algorithmically suggested offers to move slow inventory or highlight products.</p>
                <div style="display: grid; gap: 16px; margin-top: 20px;">
                    ${mockOffers.map(o => {
                        const prod = window.loadedProducts.find(p => p.id === o.productId) || window.loadedProducts[0];
                        return `
                        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 16px; align-items: center;">
                                <img src="${prod.img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                                <div>
                                    <h4 style="margin: 0;">${prod.name}</h4>
                                    <p style="margin: 4px 0 0 0; color: var(--color-primary); font-weight: bold;">Suggestion: ${o.suggestion}</p>
                                    <span style="font-size: 0.8rem; color: #888;">Status: ${o.status}</span>
                                </div>
                            </div>
                            ${o.status === 'Pending' ? `
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn btn-primary" onclick="approveOffer(${o.id}, ${prod.id}, '${o.suggestion}')">Approve</button>
                                    <button class="btn btn-outline" onclick="rejectOffer(${o.id})">Reject</button>
                                </div>
                            ` : `<span style="color: #4CAF50; font-weight: bold;">Actioned</span>`}
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'inventory') {
        const categoriesList = window.categories || [];
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Inventory & Catalog</h2>
                
                <!-- Add Custom Product Form -->
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border); margin-bottom: 30px;">
                    <h3 style="color: #212121; margin-top: 0;">Add Custom Product</h3>
                    <p style="color: #666; margin-bottom: 16px;">Create a new supermarket product card in the storefront catalog.</p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Product Name *</label>
                            <input type="text" id="new-prod-name" placeholder="e.g. Premium Basmati Rice" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Brand Name *</label>
                            <input type="text" id="new-prod-brand" placeholder="e.g. India Gate" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Price (₹) *</label>
                            <input type="number" id="new-prod-price" placeholder="120" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">MRP (₹) *</label>
                            <input type="number" id="new-prod-mrp" placeholder="130" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Stock (Quantity) *</label>
                            <input type="number" id="new-prod-stock" placeholder="25" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Category *</label>
                            <select id="new-prod-category" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; box-sizing: border-box; height: 44px;">
                                ${categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Color Theme Hex (Optional)</label>
                            <input type="color" id="new-prod-color" value="#7CB342" style="width: 100%; height: 44px; border: 1px solid var(--color-border); border-radius: 6px; padding: 2px;">
                        </div>
                    </div>

                    <div class="input-group" style="margin-bottom: 20px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Product Image Upload *</label>
                        <input type="file" id="new-prod-image-file" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: 6px; background: #f9f9f9; box-sizing: border-box;">
                        <div style="font-size: 0.8rem; color: #888; margin-top: 4px;">OR paste an image URL directly:</div>
                        <input type="url" id="new-prod-image-url" placeholder="https://example.com/product.jpg" style="width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: 6px; margin-top: 4px; box-sizing: border-box;">
                    </div>
                    
                    <button class="btn btn-primary" onclick="window.createAdminProduct()">Create and Add Product</button>
                </div>
                
                <div style="background: #E3F2FD; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px dashed #2196F3;">
                    <h3 style="color: #1565C0; margin-top: 0;">CSV Bulk Upload</h3>
                    <p style="margin-bottom: 12px;">Upload a CSV file (exported from Excel) to update prices, stock, and imagery. <br><em>Note: If a product already has a picture, the upload will not overwrite it.</em></p>
                    <input type="file" id="csvUpload" accept=".csv" style="margin-bottom: 12px;" />
                    <button class="btn btn-primary" onclick="processCSV()">Upload & Sync</button>
                </div>

                <h3>Edit Products Manually</h3>
                <div style="display: grid; gap: 16px; margin-top: 16px; max-height: 800px; overflow-y: auto; padding-right: 10px;">
                    ${window.loadedProducts.map(p => `
                        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm); display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                            <img src="${p.img}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.src='https://placehold.co/300x300?text=Product'">
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="margin: 0; color: #212121;">${p.name}</h4>
                                <div style="font-size: 0.9rem; color: #666;">MRP: ₹${p.mrp} | Price: ₹${p.price} | Stock: ${p.stock}</div>
                            </div>
                            
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <select onchange="changeCategory(${p.id}, this.value)" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                                    ${categoriesList.map(c => `<option value="${c.id}" ${c.id === p.category ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                                <input type="file" id="img-file-${p.id}" accept="image/*" style="display: none;" onchange="handleImageSelection(event, ${p.id})">
                                <button class="btn btn-secondary" onclick="document.getElementById('img-file-${p.id}').click()">Upload File</button>
                                <span style="color: #999; font-size: 0.8rem; margin: 0 4px;">OR</span>
                                <input type="text" id="img-input-${p.id}" placeholder="Paste URL..." style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 120px;">
                                <button class="btn btn-outline" onclick="updateImageURL(${p.id})">Save URL</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'orders') {
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Pending Orders</h2>
                <div style="display: grid; gap: 16px; margin-top: 20px;">
                    ${mockOrders.map(o => `
                        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: var(--shadow-sm); border-left: 4px solid ${o.status === 'Pending' ? '#FF9800' : o.status === 'Delivered' ? '#4CAF50' : '#F44336'};">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                                <div>
                                    <h3 style="margin: 0;">Order #${o.id}</h3>
                                    <p style="margin: 4px 0; color: #555;">Customer: <strong>${o.customer}</strong> (${o.phone || 'No Phone'})</p>
                                    <p style="margin: 4px 0; color: #555;">Address: <em>${o.address || 'No Address'}</em></p>
                                    <p style="margin: 4px 0; color: #555;">Scheduled: <strong>${o.deliveryDate || 'N/A'}</strong> | Slot: <strong>${o.slot || 'N/A'}</strong></p>
                                    <p style="margin: 4px 0; color: #555;">Items: ${o.items} | Total: ₹${o.total} | Ordered: ${o.date}</p>
                                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px;">
                                        <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; background: #f0f0f0; font-weight: bold;">Status: ${o.status}</span>
                                        ${o.locationUrl ? `
                                            <a href="${o.locationUrl}" target="_blank" class="btn btn-outline" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.8rem; text-decoration: none; border-color: #4CAF50; color: #4CAF50;">
                                                <span class="material-symbols-outlined" style="font-size: 16px;">directions</span> Open GPS Route
                                            </a>
                                        ` : ''}
                                    </div>
                                    ${o.reason ? `<p style="margin-top: 8px; color: #D32F2F; font-size: 0.9rem;"><em>Reason: ${o.reason}</em></p>` : ''}
                                </div>
                                ${o.status === 'Pending' ? `
                                    <div style="display: flex; gap: 8px;">
                                        <button class="btn btn-primary" style="background: #4CAF50;" onclick="deliverOrder('${o.id}')">Mark Delivered</button>
                                        <button class="btn btn-outline" style="color: #F44336; border-color: #F44336;" onclick="abortOrder('${o.id}')">Abort Order</button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'about') {
        if (!window.aboutData) {
            window.aboutData = { title: "Welcome to Evin's Mart", description: "Loading...", img1: "", img2: "" };
            fetch('about.json')
                .then(res => res.json())
                .then(data => {
                    window.aboutData = data;
                    renderAdmin();
                })
                .catch(() => {
                    // fallback
                });
        }
        const aboutData = window.aboutData || { title: '', description: '', img1: '', img2: '' };
        contentHTML = `
            <div class="container" style="padding-top: 40px; max-width: 800px;">
                <h2>Edit About Us Section</h2>
                <p>Modify the storefront About page texts and upload 2 custom cropped images.</p>
                
                <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: var(--shadow-sm); margin-top: 20px; display: flex; flex-direction: column; gap: 16px;">
                    <div class="input-group">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">About Us Title</label>
                        <input type="text" id="about-title-input" value="${aboutData.title}" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit; font-size: 1rem; box-sizing: border-box;">
                    </div>
                    
                    <div class="input-group">
                        <label style="font-weight: 600; margin-bottom: 6px; display: block;">Description Story</label>
                        <textarea id="about-desc-input" rows="6" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: inherit; font-size: 1rem; resize: vertical; box-sizing: border-box;">${aboutData.description}</textarea>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 10px;">
                        <!-- Image 1 -->
                        <div style="border: 1px solid var(--color-border); padding: 16px; border-radius: 8px; text-align: center; background: #fafafa;">
                            <h4 style="margin: 0;">Image 1</h4>
                            <img src="${aboutData.img1 ? aboutData.img1 : 'https://placehold.co/300x300'}" id="about-img1-preview" style="max-width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin: 12px 0; border: 1px solid #ddd;">
                            <input type="file" id="about-img1-file" accept="image/*" style="display: none;" onchange="window.handleAboutImageSelection(event, 1)">
                            <button class="btn btn-outline" style="width: 100%; font-size: 0.9rem;" onclick="document.getElementById('about-img1-file').click()">Upload & Crop Image 1</button>
                        </div>
                        
                        <!-- Image 2 -->
                        <div style="border: 1px solid var(--color-border); padding: 16px; border-radius: 8px; text-align: center; background: #fafafa;">
                            <h4 style="margin: 0;">Image 2</h4>
                            <img src="${aboutData.img2 ? aboutData.img2 : 'https://placehold.co/300x300'}" id="about-img2-preview" style="max-width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin: 12px 0; border: 1px solid #ddd;">
                            <input type="file" id="about-img2-file" accept="image/*" style="display: none;" onchange="window.handleAboutImageSelection(event, 2)">
                            <button class="btn btn-outline" style="width: 100%; font-size: 0.9rem;" onclick="document.getElementById('about-img2-file').click()">Upload & Crop Image 2</button>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary" style="margin-top: 12px; padding: 12px; font-size: 1.05rem;" onclick="window.saveAboutUsDetails()">Save About Us Changes</button>
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'restaurant') {
        const dishes = window.restaurantDishes || [];
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
                    <div>
                        <h2 style="margin: 0;">Restaurant Menu Management</h2>
                        <p style="margin: 4px 0 0 0; color: #666;">View, add or remove dishes from Evin's Restaurant menu.</p>
                    </div>
                    <button class="btn btn-primary" style="background: #e65100;" onclick="window.openAddDishModal()">+ Add New Dish</button>
                </div>
                
                <div style="display: grid; gap: 16px; margin-top: 16px;">
                    ${dishes.length === 0 ? `<p>No restaurant dishes available.</p>` : dishes.map(d => `
                        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: var(--shadow-sm); display: flex; gap: 16px; align-items: center; flex-wrap: wrap; ${d.unavailable ? 'opacity: 0.75;' : ''}">
                            <img src="${d.img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'">
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="margin: 0; color: #212121;">${d.name} <span style="font-size: 0.8rem; background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${d.category}</span></h4>
                                <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">Price: <strong>₹${d.price}</strong> ${d.mrp ? `| MRP: <span style="text-decoration: line-through;">₹${d.mrp}</span>` : ''}</div>
                                <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">${d.description || ''}</div>
                                <div style="font-size: 0.85rem; margin-top: 6px;">
                                    Status: <span style="padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; ${d.unavailable ? 'background: #ffebee; color: #c62828;' : 'background: #e8f5e9; color: #2e7d32;'}">
                                        ${d.unavailable ? 'Unavailable' : 'Available'}
                                    </span>
                                </div>
                            </div>
                            
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-outline" style="${d.unavailable ? 'color: #2e7d32; border-color: #a5d6a7;' : 'color: #e65100; border-color: #ffcc80;'}" onclick="window.toggleRestaurantAvailability('${d.id}')">
                                    ${d.unavailable ? 'Mark Available' : 'Mark Unavailable'}
                                </button>
                                <button class="btn btn-outline" style="color: #c62828; border-color: #ef9a9a;" onclick="window.deleteRestaurantDish('${d.id}')">Delete Dish</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'bundles') {
        const bundlesData = window.bundlesData || { banner: {}, bundles: [] };
        const banner = bundlesData.banner || { title: "", description: "", bgGradientStart: "#f5f7fa", bgGradientEnd: "#c3cfe2" };
        const bundlesList = bundlesData.bundles || [];
        const loadedProducts = window.loadedProducts || [];

        contentHTML = `
            <div class="container" style="padding-top: 40px; max-width: 900px;">
                <h2>Bundles Page Settings (Admin Only)</h2>
                
                <!-- Banner Customisation -->
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border); margin-bottom: 30px;">
                    <h3 style="color: #212121;">Customise Page Banner & Styling</h3>
                    <p style="color: #666; margin-bottom: 16px;">Set banner text, and the background gradient colors.</p>
                    
                    <div class="input-group" style="margin-bottom: 12px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Banner Title</label>
                        <input type="text" id="bundle-banner-title" value="${banner.title || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                    </div>
                    <div class="input-group" style="margin-bottom: 12px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Banner Description</label>
                        <textarea id="bundle-banner-desc" rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">${banner.description || ''}</textarea>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Gradient Start Color (Hex)</label>
                            <input type="color" id="bundle-banner-grad-start" value="${banner.bgGradientStart || '#f5f7fa'}" style="width: 100%; height: 40px; border: 1px solid var(--color-border); border-radius: 6px; padding: 2px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Gradient End Color (Hex)</label>
                            <input type="color" id="bundle-banner-grad-end" value="${banner.bgGradientEnd || '#c3cfe2'}" style="width: 100%; height: 40px; border: 1px solid var(--color-border); border-radius: 6px; padding: 2px;">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="window.saveBundleBannerConfig()">Save Banner Configuration</button>
                </div>

                <!-- Add New Bundle -->
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border); margin-bottom: 30px;">
                    <h3 style="color: #212121;">Create Curated Bundle</h3>
                    <p style="color: #666; margin-bottom: 16px;">Combine real supermarket products into a discount bundle.</p>
                    
                    <div class="input-group" style="margin-bottom: 12px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Bundle Name</label>
                        <input type="text" id="new-bundle-name" placeholder="e.g. Baking Essentials Pack" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                    </div>
                    <div class="input-group" style="margin-bottom: 12px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Description</label>
                        <input type="text" id="new-bundle-desc" placeholder="Everything you need for home baking..." style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Bundle Price (₹)</label>
                            <input type="number" id="new-bundle-price" placeholder="450" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Discount Badge Text</label>
                            <input type="text" id="new-bundle-badge" placeholder="Save 15%" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                        </div>
                        <div class="input-group">
                            <label style="font-weight: 600; display: block; margin-bottom: 4px;">Bundle Theme Color</label>
                            <input type="color" id="new-bundle-color" value="#4CAF50" style="width: 100%; height: 44px; border: 1px solid var(--color-border); border-radius: 6px; padding: 2px;">
                        </div>
                    </div>
                    
                    <!-- Product Selection -->
                    <div class="input-group" style="margin-bottom: 20px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Select Products to Include:</label>
                        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); padding: 12px; border-radius: 6px; background: #fafafa;">
                            ${loadedProducts.map(p => `
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                                    <input type="checkbox" name="bundle-products-checkbox" value="${p.id}" id="chk-p-${p.id}">
                                    <img src="${p.img}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px;">
                                    <label for="chk-p-${p.id}" style="font-size: 0.9rem; cursor: pointer; color: #212121;">${p.name} (₹${p.price})</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <button class="btn btn-primary" onclick="window.createAdminBundle()">Create and Publish Bundle</button>
                </div>

                <!-- Existing Bundles -->
                <h3 style="color: #212121;">Active Curated Bundles</h3>
                <div style="display: grid; gap: 16px; margin-top: 12px; margin-bottom: 40px;">
                    ${bundlesList.length === 0 ? `<p>No active bundles. Create one above!</p>` : bundlesList.map(b => {
                        const bProds = (b.productIds || []).map(id => loadedProducts.find(p => p.id === id || String(p.id) === String(id))).filter(Boolean);
                        return `
                            <div style="background: white; border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${b.color || '#4CAF50'}; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.2);"></div>
                                <div style="flex: 1; min-width: 200px;">
                                    <h4 style="margin: 0; color: #212121;">${b.name} <span style="font-size: 0.75rem; background: #e0f2f1; color: #00796b; padding: 2px 8px; border-radius: 12px;">${b.discountText || ''}</span></h4>
                                    <p style="margin: 4px 0; font-size: 0.85rem; color: #666;">${b.description || ''}</p>
                                    <div style="font-size: 0.85rem; color: var(--color-primary-dark); font-weight: bold; margin-top: 4px;">Price: ₹${b.price || ''} | Included: ${bProds.map(p => p.name).join(', ')}</div>
                                </div>
                                <button class="btn btn-outline" style="color: #c62828; border-color: #ef9a9a;" onclick="window.deleteAdminBundle('${b.id}')">Delete Bundle</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'bulk_import') {
        contentHTML = `
            <div class="container" style="padding-top: 40px;">
                <h2>Bulk Product Import</h2>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow-sm); margin-top: 20px;">
                    <p>Upload a CSV file containing your products. Ensure columns match: <strong>barcode/sku, product name, brand, category, price, mrp, stock, description, image</strong>.</p>
                    <input type="file" id="csvFileInput" accept=".csv" class="form-control" style="margin-bottom: 16px;">
                    <button class="btn btn-primary" onclick="startBulkImport()">Start Import</button>
                    
                    <div id="importProgressContainer" style="display: none; margin-top: 20px;">
                        <h4>Import Progress</h4>
                        <div style="width: 100%; background: #eee; border-radius: 8px; height: 20px; overflow: hidden; margin-top: 8px;">
                            <div id="importProgressBar" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 0.3s ease;"></div>
                        </div>
                        <p id="importProgressText" style="margin-top: 8px; font-weight: 500;">0 / 0</p>
                    </div>
                </div>

                <div id="importReportContainer" style="display: none; margin-top: 30px;">
                    <h3>Import Report</h3>
                    <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                        <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; flex: 1;">
                            <h4 style="color: #2e7d32; margin-top: 0;">Valid Products</h4>
                            <p id="repValid" style="font-size: 1.5rem; font-weight: bold; margin: 0;"></p>
                        </div>
                        <div style="background: #ffebee; padding: 16px; border-radius: 8px; flex: 1;">
                            <h4 style="color: #c62828; margin-top: 0;">Failed Rows</h4>
                            <p id="repFailed" style="font-size: 1.5rem; font-weight: bold; margin: 0;"></p>
                        </div>
                        <div style="background: #fff3e0; padding: 16px; border-radius: 8px; flex: 1;">
                            <h4 style="color: #ef6c00; margin-top: 0;">Duplicate SKUs</h4>
                            <p id="repDuplicates" style="font-size: 1.5rem; font-weight: bold; margin: 0;"></p>
                        </div>
                        <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; flex: 1;">
                            <h4 style="color: #1565c0; margin-top: 0;">Missing Images</h4>
                            <p id="repMissingImages" style="font-size: 1.5rem; font-weight: bold; margin: 0;"></p>
                        </div>
                    </div>
                    
                    <h4>Error Details</h4>
                    <div id="repErrorList" style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #ffcdd2; color: #c62828; max-height: 200px; overflow-y: auto;">
                    </div>
                    
                    <h4 style="margin-top: 20px;">Products Missing Images</h4>
                    <div id="repMissingImageList" style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #bbdefb; color: #1565c0; max-height: 200px; overflow-y: auto;">
                    </div>
                </div>
            </div>
        `;
    } else if (adminState.activeTab === 'categories') {
        const categoriesList = window.categories || [];
        contentHTML = `
            <div class="container" style="padding-top: 40px; max-width: 800px;">
                <h2>Categories & Tiles Management (Admin Only)</h2>
                
                <!-- Add New Category -->
                <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border); margin-bottom: 30px;">
                    <h3 style="color: #212121; margin-top: 0;">Create New Category Tile</h3>
                    <p style="color: #666; margin-bottom: 16px;">Make a custom category tile that displays on the homepage storefront.</p>
                    
                    <div class="input-group" style="margin-bottom: 12px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Category Name</label>
                        <input type="text" id="new-cat-name" placeholder="e.g. Icecreams" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px;">
                    </div>
                    
                    <div class="input-group" style="margin-bottom: 20px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; color: #212121;">Choose Icon for Tile (Material Symbol name)</label>
                        <input type="text" id="new-cat-icon" placeholder="e.g. icecream" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; margin-bottom: 8px;">
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 0.85rem; color: #666; align-self: center;">Quick Picks:</span>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='icecream'">🍦 Icecream</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='local_pizza'">🍕 Pizza</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='cake'">🎂 Cake</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='lunch_dining'">🍔 Burger</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='sports_bar'">🍺 Beer</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='coffee'">☕ Coffee</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='bakery_dining'">🍞 Bakery</button>
                            <button type="button" class="btn btn-outline" style="padding: 4px 10px; font-size: 0.8rem;" onclick="document.getElementById('new-cat-icon').value='eggplant'">🍆 Veggies</button>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary" onclick="window.createAdminCategory()">Create Category Tile</button>
                </div>

                <!-- Existing Categories Tiles -->
                <h3 style="color: #212121;">Active Storefront Category Tiles</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-top: 12px; margin-bottom: 40px;">
                    ${categoriesList.map(c => `
                        <div style="background: white; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; text-align: center; position: relative; box-shadow: var(--shadow-sm);">
                            <span class="material-symbols-outlined" style="font-size: 40px; color: var(--color-primary);">${c.icon}</span>
                            <h4 style="margin: 8px 0 0 0; color: #212121;">${c.name}</h4>
                            <button class="btn btn-outline" style="color: #c62828; border-color: #ef9a9a; font-size: 0.8rem; padding: 4px 8px; margin-top: 12px; width: 100%;" onclick="window.deleteAdminCategory('${c.id}')">Delete Tile</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    appContainer.innerHTML = tabsHTML + contentHTML;
};

window.deleteRestaurantDish = async function(dishId) {
    if (!confirm("Are you sure you want to delete this dish from the menu?")) return;
    window.restaurantDishes = (window.restaurantDishes || []).filter(d => d.id !== dishId && String(d.id) !== String(dishId));
    try {
        await fetch('/api/save_restaurant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.restaurantDishes)
        });
        alert("Dish deleted!");
        renderAdmin();
    } catch (e) {
        alert("Failed to delete dish.");
    }
};

window.switchAdminTab = function(tab) {
    adminState.activeTab = tab;
    renderAdmin();
};

window.editCustomerPoints = async function(id, currentPoints) {
    const newPts = prompt("Enter new loyalty point balance for this customer:", currentPoints);
    if (newPts !== null) {
        try {
            const res = await fetch(`/api/admin/customers/${id}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: parseInt(newPts, 10) })
            });
            if (res.ok) renderAdmin();
            else alert("Failed to update points");
        } catch (e) { alert(e.message); }
    }
};

window.grantCustomerReward = async function(id) {
    const rewardType = prompt("Enter reward type (e.g. 'discount' or 'free_product'):", "discount");
    if (!rewardType) return;
    const rewardValue = prompt("Enter reward value (e.g. '5.00' for $5 off):");
    if (!rewardValue) return;
    
    try {
        const res = await fetch(`/api/admin/customers/${id}/reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reward_type: rewardType, reward_value: rewardValue })
        });
        if (res.ok) {
            alert("Reward granted successfully!");
            renderAdmin();
        } else alert("Failed to grant reward");
    } catch (e) { alert(e.message); }
};

window.approveOffer = function(offerId, productId, suggestion) {
    const offer = mockOffers.find(o => o.id === offerId);
    const prod = window.loadedProducts.find(p => p.id === productId);
    if (offer && prod) {
        offer.status = 'Approved';
        prod.badge = suggestion;
        saveProducts().then(() => {
            alert(`Offer approved! Product updated in catalog.`);
            renderAdmin();
        });
    }
};

window.rejectOffer = function(offerId) {
    const offer = mockOffers.find(o => o.id === offerId);
    if (offer) {
        offer.status = 'Rejected';
        renderAdmin();
    }
};

window.updateImageURL = function(productId) {
    const input = document.getElementById(`img-input-${productId}`);
    const prod = window.loadedProducts.find(p => p.id === productId);
    if (prod && input.value) {
        prod.img = input.value;
        saveProducts().then(() => {
            alert('Image URL saved successfully!');
            renderAdmin();
        });
    }
};

window.changeCategory = function(productId, newCatId) {
    const prod = window.loadedProducts.find(p => p.id === productId);
    const cat = categories.find(c => c.id === newCatId);
    if (prod && cat) {
        prod.category = cat.id;
        // Also update color
        const colorSource = window.loadedProducts.find(p => p.category === cat.id && p.id !== productId);
        if (colorSource && colorSource.color) {
            prod.color = colorSource.color;
        }
        saveProducts().then(() => {
            alert(`Moved to ${cat.name}!`);
            renderAdmin();
        });
    }
};

window.processCSV = function() {
    const fileInput = document.getElementById('csvUpload');
    if (!fileInput.files.length) {
        alert("Please select a CSV file first.");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        // Very simple mock CSV parser for demonstration
        const rows = text.split(/\r?\n/);
        let updatedCount = 0;
        
        // Expected format: ID, Name, MRP, Price, Stock, ImageURL
        rows.slice(1).forEach(row => {
            if (!row.trim()) return;
            const cols = row.split(',');
            if (cols.length >= 6) {
                const id = parseInt(cols[0]);
                const img = cols[5].trim();
                
                const prod = window.loadedProducts.find(p => p.id === id);
                if (prod) {
                    prod.mrp = parseFloat(cols[2]) || prod.mrp;
                    prod.price = parseFloat(cols[3]) || prod.price;
                    prod.stock = parseInt(cols[4]) || prod.stock;
                    
                    // IF picture already existed (not placehold.co), DO NOT overwrite.
                    if (!prod.img.includes('placehold.co') && img) {
                        // Keep existing image
                    } else if (img) {
                        prod.img = img;
                    }
                    updatedCount++;
                }
            }
        });
        
        saveProducts().then(() => {
            alert(`Successfully synchronized ${updatedCount} products from CSV!`);
            renderAdmin();
        });
    };
    reader.readAsText(file);
};

window.deliverOrder = function(orderId) {
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
        order.status = 'Delivered';
        renderAdmin();
    }
};

window.abortOrder = function(orderId) {
    const reason = prompt("Speculator Reason for aborting this order:");
    if (reason === null) return; // cancelled
    if (reason.trim() === "") {
        alert("A reason is required to abort an order.");
        return;
    }
    
    const order = mockOrders.find(o => o.id === orderId);
    if (order) {
        order.status = 'Aborted';
        order.reason = reason;
        renderAdmin();
    }
};

window.verifyAdminPassword = async function() {
    const pwdInput = document.getElementById('admin-pwd-input');
    const pwd = pwdInput ? pwdInput.value : '';
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: pwd })
        });
        
        if (res.ok) {
            adminState.isAuthenticated = true;
            renderAdmin();
        } else {
            alert("Incorrect password! Access denied.");
            if (pwdInput) {
                pwdInput.value = '';
                pwdInput.focus();
            }
        }
    } catch (e) {
        alert("Login failed: " + e.message);
    }
};

window.adminSignOut = async function() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    adminState.isAuthenticated = false;
    renderRoute('home');
};

window.saveAboutUsDetails = async function() {
    const titleVal = document.getElementById('about-title-input').value;
    const descVal = document.getElementById('about-desc-input').value;
    
    if (!window.aboutData) {
        window.aboutData = { img1: '', img2: '' };
    }
    
    window.aboutData.title = titleVal;
    window.aboutData.description = descVal;
    
    try {
        const res = await fetch('/api/save_about', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.aboutData)
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert('About Us changes saved successfully!');
            renderAdmin();
        } else {
            alert('Error saving changes: ' + (data.error || 'unknown'));
        }
    } catch(e) {
        alert('Failed to connect to server API: ' + e.message);
    }
};

window.saveBundleBannerConfig = async function() {
    const title = document.getElementById('bundle-banner-title').value.trim();
    const desc = document.getElementById('bundle-banner-desc').value.trim();
    const startColor = document.getElementById('bundle-banner-grad-start').value;
    const endColor = document.getElementById('bundle-banner-grad-end').value;

    if (!title) {
        alert("Banner Title is required.");
        return;
    }

    if (!window.bundlesData) {
        window.bundlesData = { banner: {}, bundles: [] };
    }
    window.bundlesData.banner = {
        title: title,
        description: desc,
        bgGradientStart: startColor,
        bgGradientEnd: endColor
    };

    try {
        await fetch('/api/save_bundles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.bundlesData)
        });
        alert("Banner configuration saved successfully!");
        renderAdmin();
    } catch (e) {
        alert("Failed to save banner configurations.");
    }
};

window.createAdminBundle = async function() {
    const name = document.getElementById('new-bundle-name').value.trim();
    const desc = document.getElementById('new-bundle-desc').value.trim();
    const price = parseFloat(document.getElementById('new-bundle-price').value);
    const badge = document.getElementById('new-bundle-badge').value.trim();
    const color = document.getElementById('new-bundle-color').value;

    const checkedBoxes = document.querySelectorAll('input[name="bundle-products-checkbox"]:checked');
    const productIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));

    if (!name || isNaN(price) || price <= 0) {
        alert("Please enter a valid bundle name and price.");
        return;
    }

    if (productIds.length === 0) {
        alert("Please select at least one product to include in the bundle.");
        return;
    }

    if (!window.bundlesData) {
        window.bundlesData = { banner: {}, bundles: [] };
    }
    if (!window.bundlesData.bundles) {
        window.bundlesData.bundles = [];
    }

    const newBundle = {
        id: "bundle-" + Date.now(),
        name: name,
        description: desc,
        price: price,
        discountText: badge || "Special Combo",
        color: color,
        productIds: productIds
    };

    window.bundlesData.bundles.push(newBundle);

    try {
        await fetch('/api/save_bundles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.bundlesData)
        });
        alert("Bundle created and saved!");
        renderAdmin();
    } catch (e) {
        alert("Failed to save new bundle.");
    }
};

window.deleteAdminBundle = async function(bundleId) {
    if (!confirm("Are you sure you want to delete this bundle?")) return;
    if (!window.bundlesData || !window.bundlesData.bundles) return;

    window.bundlesData.bundles = window.bundlesData.bundles.filter(b => b.id !== bundleId);

    try {
        await fetch('/api/save_bundles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.bundlesData)
        });
        alert("Bundle deleted!");
        renderAdmin();
    } catch (e) {
        alert("Failed to delete bundle.");
    }
};

window.toggleRestaurantAvailability = async function(dishId) {
    const dish = window.restaurantDishes.find(d => d.id === dishId || String(d.id) === String(dishId));
    if (dish) {
        dish.unavailable = !dish.unavailable;
        try {
            await fetch('/api/save_restaurant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.restaurantDishes)
            });
            renderAdmin();
        } catch (e) {
            alert("Failed to toggle availability status.");
        }
    }
};

window.createAdminProduct = async function() {
    const nameInput = document.getElementById('new-prod-name');
    const brandInput = document.getElementById('new-prod-brand');
    const priceInput = document.getElementById('new-prod-price');
    const mrpInput = document.getElementById('new-prod-mrp');
    const stockInput = document.getElementById('new-prod-stock');
    const catInput = document.getElementById('new-prod-category');
    const colorInput = document.getElementById('new-prod-color');
    const fileInput = document.getElementById('new-prod-image-file');
    const urlInput = document.getElementById('new-prod-image-url');

    const name = nameInput.value.trim();
    const brand = brandInput.value.trim();
    const price = parseFloat(priceInput.value);
    const mrp = parseFloat(mrpInput.value);
    const stock = parseInt(stockInput.value);
    const category = catInput.value;
    const color = colorInput.value;

    if (!name || !brand || isNaN(price) || isNaN(mrp) || isNaN(stock)) {
        alert("Please fill in all required fields marked with *");
        return;
    }

    let imageUrl = urlInput.value.trim();

    // Image Upload
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
                    filename: `images/product_${Date.now()}.jpg`,
                    image_base64: base64Str
                })
            });
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
                imageUrl = uploadData.url;
            }
        } catch (e) {
            console.error("Product image upload error:", e);
        }
    }

    if (!imageUrl) {
        imageUrl = "https://placehold.co/300x300?text=" + encodeURIComponent(name);
    }

    // Calculate discount %
    const discountPercent = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const discountStr = discountPercent > 0 ? `${discountPercent}%` : undefined;
    const badgeStr = discountPercent > 5 ? "Smart Value" : undefined;

    // Generate product ID
    const nextId = window.loadedProducts.length ? Math.max(...window.loadedProducts.map(p => typeof p.id === 'number' ? p.id : 0)) + 1 : 10001;

    const newProduct = {
        id: nextId,
        name: name,
        category: category,
        color: color,
        brand: brand,
        mrp: mrp,
        price: price,
        stock: stock,
        img: imageUrl,
        discount: discountStr,
        badge: badgeStr
    };

    window.loadedProducts.unshift(newProduct);

    try {
        await saveProducts();
        alert(`Product "${name}" created and added successfully!`);
        renderAdmin();
    } catch (e) {
        alert("Failed to save new product to server.");
    }
};

window.createAdminCategory = async function() {
    const nameInput = document.getElementById('new-cat-name');
    const iconInput = document.getElementById('new-cat-icon');

    const name = nameInput.value.trim();
    const icon = iconInput.value.trim();

    if (!name || !icon) {
        alert("Please enter a category name and select or type an icon name.");
        return;
    }

    const categoriesList = window.categories || [];
    if (categoriesList.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert("A category with this name already exists!");
        return;
    }

    const newCategory = {
        id: name,
        name: name,
        icon: icon
    };

    categoriesList.push(newCategory);
    window.categories = categoriesList;

    try {
        await fetch('/api/save_categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoriesList)
        });
        alert(`Category tile "${name}" created successfully!`);
        renderAdmin();
    } catch (e) {
        alert("Failed to save new category to server.");
    }
};

window.deleteAdminCategory = async function(catId) {
    if (!confirm("Are you sure you want to delete this category tile?")) return;
    window.categories = (window.categories || []).filter(c => c.id !== catId);

    try {
        await fetch('/api/save_categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.categories)
        });
        alert("Category tile deleted!");
        renderAdmin();
    } catch (e) {
        alert("Failed to delete category tile.");
    }
};

window.startBulkImport = async function() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files.length) {
        alert('Please select a CSV file first.');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n').filter(r => r.trim());
        if (rows.length < 2) {
            alert('No data found in CSV');
            return;
        }
        
        const headers = rows[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const products = [];
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols.length === 0 || rows[i].trim() === '') continue;
            
            const p = {};
            headers.forEach((h, idx) => {
                let val = cols[idx] || '';
                val = val.replace(/^"|"$/g, '').trim();
                if (h === 'barcode/sku' || h === 'sku' || h === 'barcode') p.sku = val;
                else if (h === 'product name' || h === 'name') p.name = val;
                else p[h] = val;
            });
            products.push(p);
        }
        
        if (products.length === 0) return;
        
        document.getElementById('importProgressContainer').style.display = 'block';
        document.getElementById('importReportContainer').style.display = 'none';
        
        const batchSize = 100;
        let valid = 0, failed = 0, duplicates = 0, missingImages = 0;
        let errors = [], missingImageList = [];
        
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            
            try {
                const res = await fetch('/api/import_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ products: batch })
                });
                
                const report = await res.json();
                valid += report.valid || 0;
                failed += report.failed || 0;
                duplicates += report.duplicate_skus || 0;
                missingImages += report.missing_images || 0;
                if (report.errors) errors = errors.concat(report.errors);
                if (report.missing_image_list) missingImageList = missingImageList.concat(report.missing_image_list);
                
            } catch (err) {
                console.error('Batch error', err);
                failed += batch.length;
                errors.push('Failed to process batch starting at index ' + i);
            }
            
            const processed = Math.min(i + batchSize, products.length);
            const pct = (processed / products.length) * 100;
            document.getElementById('importProgressBar').style.width = pct + '%';
            document.getElementById('importProgressText').textContent = processed + ' / ' + products.length;
        }
        
        document.getElementById('importReportContainer').style.display = 'block';
        document.getElementById('repValid').textContent = valid;
        document.getElementById('repFailed').textContent = failed;
        document.getElementById('repDuplicates').textContent = duplicates;
        document.getElementById('repMissingImages').textContent = missingImages;
        
        const errList = document.getElementById('repErrorList');
        if (errors.length > 0) {
            errList.innerHTML = errors.map(e => '<div>' + e + '</div>').join('');
        } else {
            errList.innerHTML = '<div style="color: #2e7d32;">No errors!</div>';
        }
        
        const missImgList = document.getElementById('repMissingImageList');
        if (missingImageList.length > 0) {
            missImgList.innerHTML = missingImageList.map(m => '<div>' + m + '</div>').join('');
        } else {
            missImgList.innerHTML = '<div style="color: #2e7d32;">No missing images!</div>';
        }
    };
    
    reader.readAsText(file);
};

window.editUserPoints = function(userId) {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
        const val = prompt(`Edit points for ${user.name}:`, user.points || 0);
        if (val === null) return;
        const newPoints = parseInt(val);
        if (isNaN(newPoints) || newPoints < 0) {
            alert("Please enter a valid points value!");
            return;
        }
        user.points = newPoints;
        alert(`Successfully updated loyalty points balance!`);
        renderAdmin();
    }
};
