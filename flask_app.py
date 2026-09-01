from flask import Flask, jsonify, request, session, send_from_directory, send_file
from flask_cors import CORS
from models import db, Product, RestaurantItem, Bundle, Customer, CustomerReward
import json
import os
import firebase_admin
from firebase_admin import credentials, auth
from functools import wraps

app = Flask(__name__, static_folder='.', static_url_path='')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///database.db')
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'super-secret-key-change-in-production' # For session management
CORS(app, supports_credentials=True)
db.init_app(app)

# Initialize Firebase Admin (requires serviceAccountKey.json later)
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'evinssmart-62841.firebasestorage.app'
    })
    FIREBASE_ENABLED = True
except Exception as e:
    print(f"Firebase Admin SDK not initialized: {e}")
    FIREBASE_ENABLED = False

# --- Auth Middleware ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Static File Serving ---
@app.route('/')
def serve_index():
    return send_file('index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(path):
        return send_file(path)
    return jsonify({"error": "Not Found"}), 404

# --- Public API Routes ---
@app.route('/api/products', methods=['GET'])
def get_products():
    products = Product.query.all()
    return jsonify([p.to_dict() for p in products])

@app.route('/api/restaurant', methods=['GET'])
def get_restaurant():
    items = RestaurantItem.query.all()
    return jsonify([i.to_dict() for i in items])

@app.route('/api/bundles', methods=['GET'])
def get_bundles():
    bundles = Bundle.query.all()
    banner = {}
    if os.path.exists('bundles.json'):
        with open('bundles.json', 'r') as f:
            data = json.load(f)
            banner = data.get('banner', {})
    
    return jsonify({
        "banner": banner,
        "bundles": [b.to_dict() for b in bundles]
    })

@app.route('/api/about', methods=['GET'])
def get_about():
    if os.path.exists('about.json'):
        with open('about.json', 'r') as f:
            return jsonify(json.load(f))
    return jsonify({})

@app.route('/api/offers', methods=['GET'])
def get_offers():
    if os.path.exists('offers.json'):
        with open('offers.json', 'r') as f:
            return jsonify(json.load(f))
    return jsonify([])

@app.route('/api/categories', methods=['GET'])
def get_categories():
    if os.path.exists('categories.json'):
        with open('categories.json', 'r') as f:
            return jsonify(json.load(f))
    return jsonify([])

# --- Customer Auth & Loyalty ---
@app.route('/api/auth/verify_firebase_token', methods=['POST'])
def verify_firebase_token():
    data = request.json
    id_token = data.get('idToken')
    
    if not id_token:
        return jsonify({"error": "No token provided"}), 400
        
    if not FIREBASE_ENABLED:
        # Mock logic for testing before Firebase is fully set up
        phone = data.get('phoneNumber', '+1234567890')
        customer = Customer.query.filter_by(phone_number=phone).first()
        if not customer:
            customer = Customer(phone_number=phone)
            db.session.add(customer)
            db.session.commit()
        
        session['customer_id'] = customer.id
        return jsonify({"status": "success", "customer": customer.to_dict()})

    try:
        decoded_token = auth.verify_id_token(id_token)
        phone = decoded_token.get('phone_number')
        
        customer = Customer.query.filter_by(phone_number=phone).first()
        if not customer:
            customer = Customer(phone_number=phone)
            db.session.add(customer)
            db.session.commit()
            
        session['customer_id'] = customer.id
        return jsonify({"status": "success", "customer": customer.to_dict()})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

@app.route('/api/customer/me', methods=['GET'])
def get_customer_profile():
    customer_id = session.get('customer_id')
    if not customer_id:
        return jsonify({"error": "Not logged in"}), 401
    
    customer = Customer.query.get(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
        
    rewards = CustomerReward.query.filter_by(customer_id=customer_id, is_used=False).all()
    
    res = customer.to_dict()
    res['rewards'] = [r.to_dict() for r in rewards]
    return jsonify(res)

@app.route('/api/auth/logout', methods=['POST'])
def customer_logout():
    session.pop('customer_id', None)
    return jsonify({"status": "success"})

# --- Admin Routes ---
@app.route('/api/login', methods=['POST'])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    # Default admin credentials
    if username == 'admin' and password == 'admin123':
        session['is_admin'] = True
        return jsonify({"status": "success"})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('is_admin', None)
    return jsonify({"status": "success"})

@app.route('/api/admin/customers', methods=['GET'])
@login_required
def get_customers():
    customers = Customer.query.all()
    res = []
    for c in customers:
        c_dict = c.to_dict()
        rewards = CustomerReward.query.filter_by(customer_id=c.id).all()
        c_dict['rewards'] = [r.to_dict() for r in rewards]
        res.append(c_dict)
    return jsonify(res)

@app.route('/api/admin/customers/<int:customer_id>/reward', methods=['POST'])
@login_required
def grant_reward(customer_id):
    data = request.json
    reward_type = data.get('reward_type')
    reward_value = data.get('reward_value')
    
    reward = CustomerReward(
        customer_id=customer_id,
        reward_type=reward_type,
        reward_value=reward_value
    )
    db.session.add(reward)
    db.session.commit()
    
    return jsonify({"status": "success", "reward": reward.to_dict()})

@app.route('/api/admin/customers/<int:customer_id>/points', methods=['POST'])
@login_required
def adjust_points(customer_id):
    data = request.json
    points = data.get('points', 0)
    customer = Customer.query.get(customer_id)
    if customer:
        customer.loyalty_points = points
        db.session.commit()
        return jsonify({"status": "success", "customer": customer.to_dict()})
    return jsonify({"error": "Not found"}), 404

import base64
@app.route('/api/import_batch', methods=['POST'])
@login_required
def import_batch():
    data = request.json
    products = data.get('products', [])
    
    report = {
        'valid': 0,
        'failed': 0,
        'duplicate_skus': 0,
        'missing_images': 0,
        'errors': [],
        'missing_image_list': []
    }
    
    for p in products:
        sku = str(p.get('sku') or p.get('barcode') or '').strip()
        name = str(p.get('name', '')).strip()
        price = p.get('price')
        
        if not sku or not name or price is None or str(price).strip() == '':
            report['failed'] += 1
            report['errors'].append(f"Row missing required fields (SKU/Name/Price): {name or sku}")
            continue
            
        try:
            price_val = float(price)
            if price_val <= 0:
                raise ValueError()
        except:
            report['failed'] += 1
            report['errors'].append(f"Invalid price for SKU {sku}: {price}")
            continue
            
        # Check duplicate
        existing = Product.query.get(sku)
        if existing:
            report['duplicate_skus'] += 1
            report['errors'].append(f"Duplicate SKU {sku} skipped")
            continue
            
        img_url = str(p.get('img', '') or p.get('image', '')).strip()
        if not img_url:
            img_path = f"images/product_{sku}.jpg"
            img_path_png = f"images/product_{sku}.png"
            if os.path.exists(img_path):
                img_url = img_path
            elif os.path.exists(img_path_png):
                img_url = img_path_png
            else:
                report['missing_images'] += 1
                report['missing_image_list'].append(name)
                img_url = f"images/default_product.jpg"
        else:
            if img_url.startswith('data:image'):
                base64_str = img_url.split(',')[1] if ',' in img_url else img_url
                img_data = base64.b64decode(base64_str)
                img_filename = f"images/product_{sku}.jpg"
                if not os.path.exists('images'):
                    os.makedirs('images')
                with open(img_filename, 'wb') as f:
                    f.write(img_data)
                img_url = img_filename
            
        mrp = p.get('mrp')
        discount_str = p.get('discount', '')
        badge_str = p.get('badge', '')
        try:
            mrp_val = float(mrp)
            if mrp_val > price_val:
                discount_pct = int(((mrp_val - price_val) / mrp_val) * 100)
                discount_str = f"{discount_pct}%"
                if discount_pct >= 20:
                    badge_str = "Best Before Savings"
                elif discount_pct > 0:
                    badge_str = "Smart Value"
        except:
            mrp_val = price_val
            
        stock = p.get('stock', 10)
        try:
            stock = int(stock)
        except:
            stock = 10
            
        new_prod = Product(
            id=sku,
            name=name,
            brand=p.get('brand', 'Generic'),
            category=p.get('category', 'Stationery & Miscellaneous'),
            price=price_val,
            mrp=mrp_val,
            stock=stock,
            img=img_url,
            discount=discount_str,
            badge=badge_str
        )
        db.session.add(new_prod)
        report['valid'] += 1
        
    db.session.commit()
    return jsonify(report)

@app.route('/api/save', methods=['POST'])
@login_required
def save_products_db():
    try:
        products = request.json
        for p in products:
            prod = Product.query.get(p.get('id'))
            if prod:
                prod.name = p.get('name')
                prod.category = p.get('category')
                prod.brand = p.get('brand')
                prod.mrp = float(p['mrp']) if p.get('mrp') is not None else None
                prod.price = float(p.get('price', 0))
                prod.stock = int(p.get('stock', 0))
                prod.img = p.get('img')
                prod.discount = p.get('discount')
                prod.badge = p.get('badge')
        db.session.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save_about', methods=['POST'])
@login_required
def save_about():
    try:
        data = request.json
        with open('about.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload_image', methods=['POST'])
@login_required
def upload_image():
    try:
        data = request.json
        filename = data.get('filename')
        if not filename:
            product_id = data.get('productId')
            filename = f"images/product_{product_id}.jpg"
        
        base64_str = data.get('image_base64')
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        
        img_data = base64.b64decode(base64_str)
        
        if FIREBASE_ENABLED:
            from firebase_admin import storage as firebase_storage
            bucket = firebase_storage.bucket()
            blob = bucket.blob(filename)
            blob.upload_from_string(img_data, content_type='image/jpeg')
            blob.make_public()
            public_url = blob.public_url
            
            product_id = data.get('productId')
            if product_id:
                prod = Product.query.get(product_id)
                if prod:
                    prod.img = public_url
                    db.session.commit()
            return jsonify({"url": public_url})
        else:
            if not os.path.exists('images'):
                os.makedirs('images')
            with open(filename, 'wb') as f:
                f.write(img_data)
            return jsonify({"url": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
