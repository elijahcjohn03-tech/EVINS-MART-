import json
import urllib.request
import os
import ssl
from urllib.parse import quote

# Disable SSL verification just in case sandbox has issues
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_wiki_image(keyword):
    # Try to find a Wikipedia page for the keyword and get its main image
    url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={quote(keyword)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                if "original" in page_data:
                    return page_data["original"]["source"]
    except Exception as e:
        print(f"Error fetching wiki info for {keyword}: {e}")
    return None

def main():
    if not os.path.exists('images'):
        os.makedirs('images')
        
    with open('products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
        
    # Find unique categories or generic keywords to search
    # Instead of all 400 products, let's just get 1 image per category
    category_images = {}
    
    # Mapping of category to a good wiki search term
    wiki_terms = {
        'Baby Care': 'Baby',
        'Feminine Care': 'Sanitary napkin',
        "Men's Grooming": 'Shaving',
        'Hair Care': 'Shampoo',
        'Skin Care & Beauty': 'Cosmetics',
        'Bath & Body': 'Soap',
        'Oral Care': 'Toothbrush',
        'Health & Wellness': 'Medicine',
        'Beverages & Energy Drinks': 'Soft drink',
        'Tea, Coffee & Health Drinks': 'Coffee',
        'Dairy & Breakfast': 'Milk',
        'Snacks & Biscuits': 'Biscuit',
        'Spices & Cooking Essentials': 'Spice',
        'Rice, Atta & Staples': 'Rice',
        'Laundry & Fabric Care': 'Laundry detergent',
        'Household Cleaning': 'Cleaning product',
        'Air Fresheners': 'Air freshener',
        'Fragrances & Deodorants': 'Perfume',
        'Fresh Produce': 'Fruit',
        'Organic & Health Foods': 'Organic food',
        'Stationery & Miscellaneous': 'Stationery'
    }
    
    print("Fetching images from Wikipedia...")
    for cat, term in wiki_terms.items():
        print(f"Fetching for category {cat} ({term})...")
        img_url = fetch_wiki_image(term)
        if img_url:
            print(f"Found image for {cat}: {img_url}")
            ext = img_url.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'gif', 'svg']:
                ext = 'jpg'
            local_path = f"images/cat_{term.replace(' ', '_')}.{ext}"
            
            if not os.path.exists(local_path):
                try:
                    req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, context=ctx) as response, open(local_path, 'wb') as out_file:
                        out_file.write(response.read())
                    category_images[cat] = local_path
                except Exception as e:
                    print(f"Error downloading {img_url}: {e}")
            else:
                category_images[cat] = local_path
                
    # Now assign these images to the products based on category
    updated = 0
    for p in products:
        cat = p.get('category', 'Stationery & Miscellaneous')
        if cat in category_images:
            p['img'] = category_images[cat]
            updated += 1
            
    with open('products.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=4)
        
    print(f"Updated {updated} products with category images!")

if __name__ == "__main__":
    main()
