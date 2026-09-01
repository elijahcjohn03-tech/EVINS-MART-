import csv
import re
from PyPDF2 import PdfReader
import sys

def generate_csv(pdf_path):
    reader = PdfReader(pdf_path)
    
    categories_def = {
        'Baby Care': ['diaper', 'wipe', 'baby', 'pampers', 'mamy', 'johnson'],
        'Feminine Care': ['sanitary', 'pad', 'liner', 'whisper', 'sofy', 'stayfree'],
        "Men's Grooming": ['razor', 'blade', 'shaving', 'aftershave', 'gillette', 'old spice', 'shave', 'after shave'],
        'Hair Care': ['shampoo', 'conditioner', 'hair oil', 'hair treatment', 'pantene', 'head & shoulder', 'indulekha', 'h&s'],
        'Skin Care & Beauty': ['face wash', 'moisturiser', 'cream', 'serum', 'body lotion', 'nivea', 'olay', 'sebamed', 'fair & lovely', 'glow & lovely', 'talc', 'powder', 'kajal', 'nail', 'lip'],
        'Bath & Body': ['soap', 'body wash', 'shower gel', 'hand wash', 'liril', 'pears', 'dove', 'cinthol', 'sandal', 'medimix', 'fiama', 'handwash', 'vivel'],
        'Oral Care': ['toothbrush', 'toothpaste', 'mouthwash', 'oral-b', 'oral b', 'colgate', 'pepsodent', 'closeup', 'brush'],
        'Health & Wellness': ['pain', 'cold', 'inhaler', 'vapor rub', 'ayurvedic', 'vicks', 'iodex', 'balm', 'moov', 'churna', 'eno'],
        'Beverages & Energy Drinks': ['juice', 'drink', 'energy', 'soda', 'coke', 'pepsi', 'sprite', 'monster', 'predator', 'fanta', 'maaza', 'appy', 'frooti'],
        'Tea, Coffee & Health Drinks': ['tea', 'coffee', 'nescafe', 'davidoff', 'bru', 'malt', 'horlicks', 'boost', 'bournvita'],
        'Dairy & Breakfast': ['milk', 'butter', 'cheese', 'yogurt', 'oats', 'cereal', 'corn', 'chocos', 'muesli', 'paneer', 'ghee'],
        'Snacks & Biscuits': ['chip', 'biscuit', 'cookie', 'chocolate', 'candy', 'mint', 'gum', 'orbit', 'polo', 'wrigley', 'lays', 'kurkure', 'snack', 'murukku', 'mixture', 'popcorn', 'diarymilk', 'oreo', 'snickers', 'britannia'],
        'Spices & Cooking Essentials': ['masala', 'spice', 'salt', 'sugar', 'oil', 'vinegar', 'sauce', 'chutney', 'ketchup', 'mayonnaise', 'paste', 'pickle'],
        'Rice, Atta & Staples': ['rice', 'wheat', 'flour', 'atta', 'rava', 'vermicelli', 'grain', 'pulse', 'dal', 'poha', 'podi'],
        'Laundry & Fabric Care': ['detergent', 'fabric', 'washing', 'ariel', 'tide', 'surf', 'rin', 'ujala', 'comfort'],
        'Household Cleaning': ['surface', 'dishwash', 'floor', 'cleaner', 'vim', 'harpic', 'lizol', 'colin', 'pril'],
        'Air Fresheners': ['freshener', 'refill', 'ambi pur', 'odonil', 'godrej aer', 'freshner'],
        'Fragrances & Deodorants': ['perfume', 'body spray', 'roll on', 'yardley', 'marquis', 'engage', 'fogg', 'deo'],
        'Fresh Produce': ['apple', 'banana', 'mango', 'grape', 'fruit', 'veg', 'coconut', 'produce', 'herb', 'onion', 'tomato', 'potato'],
        'Organic & Health Foods': ['seed', 'chia', 'protein', 'organic', 'superfood'],
    }

    def get_category(name):
        name_lower = name.lower()
        for cat_name, keywords in categories_def.items():
            if any(re.search(r'\b' + kw + r'\b', name_lower) for kw in keywords):
                return cat_name
        return 'Stationery & Miscellaneous'

    rows = []
    headers = ['barcode', 'product name', 'brand', 'category', 'price', 'mrp', 'stock', 'description', 'image']
    
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
                    # PID is tokens[0]
                    pid = tokens[0]
                    code = tokens[1]
                    name_tokens = []
                    for t in tokens[2:]:
                        # ignore hsn code
                        if t.isdigit() and len(t) > 4: continue
                        name_tokens.append(t)
                    
                    name = " ".join(name_tokens).strip()
                    if name:
                        brand = name.split()[0] if name else "Generic"
                        category = get_category(name)
                        img = ""
                        desc = f"Premium quality {name.lower()}"
                        
                        rows.append({
                            'barcode': pid, # use PID since code has E notation
                            'product name': name,
                            'brand': brand,
                            'category': category,
                            'price': ccp,
                            'mrp': mrp,
                            'stock': stock,
                            'description': desc,
                            'image': img
                        })
    
    with open('products.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
            
    print(f"Generated products.csv with {len(rows)} products.")

if __name__ == '__main__':
    generate_csv(sys.argv[1])
