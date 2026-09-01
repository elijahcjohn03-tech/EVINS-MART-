import re
import json
import sys

try:
    from PyPDF2 import PdfReader
except ImportError:
    print("PyPDF2 is not installed.")
    sys.exit(1)

def parse_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    products = []
    
    categories_def = {
        'Baby Care': {'color': '#87CEEB', 'keywords': ['diaper', 'wipe', 'baby', 'pampers', 'mamy', 'johnson']},
        'Feminine Care': {'color': '#FF69B4', 'keywords': ['sanitary', 'pad', 'liner', 'whisper', 'sofy', 'stayfree']},
        "Men's Grooming": {'color': '#34495E', 'keywords': ['razor', 'blade', 'shaving', 'aftershave', 'gillette', 'old spice', 'shave', 'after shave']},
        'Hair Care': {'color': '#8E44AD', 'keywords': ['shampoo', 'conditioner', 'hair oil', 'hair treatment', 'pantene', 'head & shoulder', 'indulekha', 'h&s']},
        'Skin Care & Beauty': {'color': '#F7B6D2', 'keywords': ['face wash', 'moisturiser', 'cream', 'serum', 'body lotion', 'nivea', 'olay', 'sebamed', 'fair & lovely', 'glow & lovely', 'talc', 'powder', 'kajal', 'nail', 'lip']},
        'Bath & Body': {'color': '#5BC0EB', 'keywords': ['soap', 'body wash', 'shower gel', 'hand wash', 'liril', 'pears', 'dove', 'cinthol', 'sandal', 'medimix', 'fiama', 'handwash', 'vivel']},
        'Oral Care': {'color': '#00BCD4', 'keywords': ['toothbrush', 'toothpaste', 'mouthwash', 'oral-b', 'oral b', 'colgate', 'pepsodent', 'closeup', 'brush']},
        'Health & Wellness': {'color': '#D32F2F', 'keywords': ['pain', 'cold', 'inhaler', 'vapor rub', 'ayurvedic', 'vicks', 'iodex', 'balm', 'moov', 'churna', 'eno']},
        'Beverages & Energy Drinks': {'color': '#00AEEF', 'keywords': ['juice', 'drink', 'energy', 'soda', 'coke', 'pepsi', 'sprite', 'monster', 'predator', 'fanta', 'maaza', 'appy', 'frooti']},
        'Tea, Coffee & Health Drinks': {'color': '#7B4F28', 'keywords': ['tea', 'coffee', 'nescafe', 'davidoff', 'bru', 'malt', 'horlicks', 'boost', 'bournvita']},
        'Dairy & Breakfast': {'color': '#FFF4CC', 'keywords': ['milk', 'butter', 'cheese', 'yogurt', 'oats', 'cereal', 'corn', 'chocos', 'muesli', 'paneer', 'ghee']},
        'Snacks & Biscuits': {'color': '#F5C242', 'keywords': ['chip', 'biscuit', 'cookie', 'chocolate', 'candy', 'mint', 'gum', 'orbit', 'polo', 'wrigley', 'lays', 'kurkure', 'snack', 'murukku', 'mixture', 'popcorn', 'diarymilk', 'oreo', 'snickers', 'britannia']},
        'Spices & Cooking Essentials': {'color': '#E67E22', 'keywords': ['masala', 'spice', 'salt', 'sugar', 'oil', 'vinegar', 'sauce', 'chutney', 'ketchup', 'mayonnaise', 'paste', 'pickle']},
        'Rice, Atta & Staples': {'color': '#C8A165', 'keywords': ['rice', 'wheat', 'flour', 'atta', 'rava', 'vermicelli', 'grain', 'pulse', 'dal', 'poha', 'podi']},
        'Laundry & Fabric Care': {'color': '#2980B9', 'keywords': ['detergent', 'fabric', 'washing', 'ariel', 'tide', 'surf', 'rin', 'ujala', 'comfort']},
        'Household Cleaning': {'color': '#16A085', 'keywords': ['surface', 'dishwash', 'floor', 'cleaner', 'vim', 'harpic', 'lizol', 'colin', 'pril']},
        'Air Fresheners': {'color': '#9B59B6', 'keywords': ['freshener', 'refill', 'ambi pur', 'odonil', 'godrej aer', 'freshner']},
        'Fragrances & Deodorants': {'color': '#E91E63', 'keywords': ['perfume', 'body spray', 'roll on', 'yardley', 'marquis', 'engage', 'fogg', 'deo']},
        'Fresh Produce': {'color': '#7BC043', 'keywords': ['apple', 'banana', 'mango', 'grape', 'fruit', 'veg', 'coconut', 'produce', 'herb', 'onion', 'tomato', 'potato']},
        'Organic & Health Foods': {'color': '#2ECC71', 'keywords': ['seed', 'chia', 'protein', 'organic', 'superfood']},
        'Stationery & Miscellaneous': {'color': '#607D8B', 'keywords': ['calculator', 'stationery', 'casio', 'pen', 'pencil', 'eraser', 'sharpener', 'file', 'folder', 'notebook']}
    }

    def get_category(name):
        name_lower = name.lower()
        for cat_name, details in categories_def.items():
            # Use regex to match exact words, not substrings (e.g. "oil" shouldn't match "foil")
            if any(re.search(r'\b' + kw + r'\b', name_lower) for kw in details['keywords']):
                return cat_name
        return 'Stationery & Miscellaneous'
        
    for page in reader.pages:
        text = page.extract_text()
        if not text: continue
        lines = text.split('\n')
        for line in lines:
            match = re.search(r'(NOS|KGS|GM|ML|LTR|MTR|PCS|PAC)\s+(-?\d+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)', line)
            if match:
                stock = int(match.group(2))
                ccp = float(match.group(5))
                mrp = float(match.group(6))
                
                prefix = line[:match.start()]
                tokens = prefix.split()
                if len(tokens) >= 3:
                    name_tokens = []
                    for t in tokens[2:]:
                        if t.isdigit() and len(t) > 4: continue
                        if t.isdigit() and len(t) <= 2: continue
                        name_tokens.append(t)
                    
                    name = " ".join(name_tokens).strip()
                    if name:
                        cat = get_category(name)
                        product = {
                            "id": len(products) + 1,
                            "name": name,
                            "category": cat,
                            "color": categories_def[cat]['color'],
                            "brand": name.split()[0] if name else "Generic",
                            "mrp": mrp,
                            "price": ccp,
                            "stock": stock,
                            "img": "https://placehold.co/300x300?text=" + name.split()[0],
                        }
                        
                        if ccp < mrp:
                            discount_pct = int(((mrp - ccp) / mrp) * 100)
                            product["discount"] = f"{discount_pct}%"
                            if discount_pct >= 20:
                                product["badge"] = "Best Before Savings"
                            elif discount_pct > 0:
                                product["badge"] = "Smart Value"
                                
                        products.append(product)

    print(f"Extracted {len(products)} products from PDF.")
    
    grouped = {}
    for p in products:
        grouped.setdefault(p['category'], []).append(p)
    
    final_products = []
    # Mix categories evenly
    for cat, items in grouped.items():
        final_products.extend(items[:20])
    
    with open('products.json', 'w', encoding='utf-8') as f:
        json.dump(final_products, f, indent=4)
        
    print(f"Saved {len(final_products)} products to products.json.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python parse_pdf.py <path_to_pdf>")
    else:
        parse_pdf(sys.argv[1])
