import json
import time
import urllib.request
import os
import concurrent.futures
from duckduckgo_search import DDGS

def process_product(args):
    i, p, total = args
    # Skip if it already has a real image (not default_product.jpg)
    img_val = p.get('img', '')
    if img_val and 'default_product.jpg' not in img_val and 'pdf_img' not in img_val and 'placehold.co' not in img_val:
        return i, p, False
        
    query = p['name'] + ' product white background'
    print(f"[{i+1}/{total}] Searching for: {query}")
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=1))
            if results:
                img_url = results[0].get('image')
                if img_url:
                    p['img'] = img_url
                    print(f"Found: {img_url}")
                    return i, p, True
    except Exception as e:
        print(f"Error searching for {query}: {e}")
        
    return i, p, False

def fetch_images():
    print("Loading products.json...")
    with open('products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
        
    total = len(products)
    print(f"Loaded {total} products.")
    
    args_list = [(i, p, total) for i, p in enumerate(products)]
    updated_count = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for i, updated_p, changed in executor.map(process_product, args_list):
            products[i] = updated_p
            if changed:
                updated_count += 1
                
            if updated_count > 0 and updated_count % 10 == 0:
                with open('products.json', 'w', encoding='utf-8') as f:
                    json.dump(products, f, indent=4)
                
    # Final save
    with open('products.json', 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=4)
    print("Finished updating images!")

if __name__ == "__main__":
    fetch_images()
