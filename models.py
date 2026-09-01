from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(50))
    brand = db.Column(db.String(100))
    mrp = db.Column(db.Float)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, default=0)
    img = db.Column(db.String(500))
    discount = db.Column(db.String(50))
    badge = db.Column(db.String(100))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'color': self.color,
            'brand': self.brand,
            'mrp': self.mrp,
            'price': self.price,
            'stock': self.stock,
            'img': self.img,
            'discount': self.discount,
            'badge': self.badge
        }

class RestaurantItem(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    mrp = db.Column(db.Float)
    stock = db.Column(db.Integer, default=0)
    description = db.Column(db.Text)
    img = db.Column(db.String(500))
    badge = db.Column(db.String(100))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'price': self.price,
            'mrp': self.mrp,
            'stock': self.stock,
            'description': self.description,
            'img': self.img,
            'badge': self.badge
        }

class Bundle(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    discountText = db.Column(db.String(100))
    color = db.Column(db.String(50))
    productIds = db.Column(db.Text) # JSON list
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'discountText': self.discountText,
            'color': self.color,
            'productIds': json.loads(self.productIds) if self.productIds else []
        }

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100))
    loyalty_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'phone_number': self.phone_number,
            'name': self.name,
            'loyalty_points': self.loyalty_points,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'))
    total_amount = db.Column(db.Float, nullable=False)
    points_earned = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='pending')
    
class CustomerReward(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    reward_type = db.Column(db.String(50)) # 'discount', 'free_product'
    reward_value = db.Column(db.String(200)) # e.g. '5.00' (amount) or '123' (product ID)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'reward_type': self.reward_type,
            'reward_value': self.reward_value,
            'is_used': self.is_used
        }
