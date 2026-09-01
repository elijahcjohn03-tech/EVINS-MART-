from flask import Flask
from models import db, Product, RestaurantItem, Bundle
import json
import os

app = Flask(__name__)
database_url = os.environ.get('DATABASE_URL', 'sqlite:///database.db')
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def run_migration():
    with app.app_context():
        # Create all tables
        db.create_all()
        print("Created database tables.")
        
        # Clear existing to avoid duplicates if run multiple times
        Product.query.delete()
        RestaurantItem.query.delete()
        Bundle.query.delete()
        
        # 1. Migrate Products
        if os.path.exists('products.json'):
            with open('products.json', 'r', encoding='utf-8') as f:
                products_data = json.load(f)
                for p in products_data:
                    new_product = Product(
                        id=p.get('id'),
                        name=p.get('name'),
                        category=p.get('category'),
                        brand=p.get('brand'),
                        mrp=float(p['mrp']) if p.get('mrp') else None,
                        price=float(p.get('price', 0)),
                        stock=int(p.get('stock', 0)),
                        img=p.get('img'),
                        discount=p.get('discount'),
                        badge=p.get('badge')
                    )
                    db.session.add(new_product)
            print(f"Migrated {len(products_data)} products.")
            
        # 2. Migrate Restaurant
        if os.path.exists('restaurant.json'):
            with open('restaurant.json', 'r', encoding='utf-8') as f:
                rest_data = json.load(f)
                for item in rest_data:
                    new_item = RestaurantItem(
                        id=item.get('id'),
                        name=item.get('name'),
                        category=item.get('category'),
                        price=float(item.get('price', 0)),
                        mrp=float(item['mrp']) if item.get('mrp') else None,
                        stock=int(item.get('stock', 0)),
                        description=item.get('description'),
                        img=item.get('img'),
                        badge=item.get('badge')
                    )
                    db.session.add(new_item)
            print(f"Migrated {len(rest_data)} restaurant items.")
            
        # 3. Migrate Bundles
        if os.path.exists('bundles.json'):
            with open('bundles.json', 'r', encoding='utf-8') as f:
                bundles_data = json.load(f)
                for bundle in bundles_data.get('bundles', []):
                    new_bundle = Bundle(
                        id=bundle.get('id'),
                        name=bundle.get('name'),
                        description=bundle.get('description'),
                        price=float(bundle.get('price', 0)),
                        discountText=bundle.get('discountText'),
                        color=bundle.get('color'),
                        productIds=json.dumps(bundle.get('productIds', []))
                    )
                    db.session.add(new_bundle)
            print(f"Migrated bundles.")
            
        db.session.commit()
        print("Migration complete!")

if __name__ == "__main__":
    run_migration()
